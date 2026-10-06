import {
	isCallExpression,
	isIdentifier,
	isLogicalExpression,
	isMemberExpression,
	isNode,
	isUnaryExpression,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import type { ESTree } from "oxlint-plugin-utilities";

import type { SharedGuard } from "./utilities-index.ts";

export interface GuardMatch {
	/** What the code passes for each guard parameter, in order. */
	readonly arguments: ReadonlyArray<ESTree.Node>;
	/** Whether the code checks the opposite: `!a || !b` for a guard `a && b`. */
	readonly negated: boolean;
}

type GetText = (node: ESTree.Node) => string;
type Leaf = bigint | boolean | number | string | symbol | undefined;
type FieldValue = ESTree.Node | Leaf | ReadonlyArray<ESTree.Node | undefined>;

interface MatchState {
	readonly bindings: Map<string, ESTree.Node>;
	readonly getText: GetText;
	readonly parameters: ReadonlySet<string>;
}

interface ChainOperators {
	readonly candidate: string;
	readonly negated: boolean;
	readonly pattern: string;
}

const OPPOSITE_OPERATORS = new Map<string, string>([
	["&&", "||"],
	["||", "&&"],
]);

/** Position and parser bookkeeping rather than syntax. */
const IGNORED_KEYS = new Set<string>(["end", "loc", "parent", "range", "raw", "start"]);

/**
 * A guard parameter stands for whatever expression the code passes, as long
 * as every use of the parameter gets the same expression.
 *
 * @param name - Parameter name.
 * @param candidate - Expression in the code.
 * @param state - Bindings so far.
 * @returns Whether the expression is consistent with earlier uses.
 */
function bind(name: string, candidate: ESTree.Node, state: MatchState): boolean {
	const bound = state.bindings.get(name);
	if (bound === undefined) {
		state.bindings.set(name, candidate);
		return true;
	}
	return state.getText(bound) === state.getText(candidate);
}

function isNodeList(value: unknown): value is ReadonlyArray<ESTree.Node | null> {
	return Array.isArray(value) && value.every((item) => Predicate.isNull(item) || isNode(item));
}

function isLeaf(value: unknown): value is Leaf | null {
	return !Predicate.isObject(value);
}

/**
 * A node's syntax fields: child nodes, lists of them, and primitives. Any
 * other object, such as a regular expression's `regex`, gets a value that
 * never matches.
 *
 * @param node - Node to read.
 * @returns Field values by key.
 */
function readFields(node: ESTree.Node): ReadonlyMap<string, FieldValue> {
	const fields = new Map<string, FieldValue>();
	const entries: ReadonlyArray<readonly [string, unknown]> = Object.entries(node);
	for (const [key, value] of entries) {
		if (IGNORED_KEYS.has(key)) continue;
		if (isNode(value)) {
			fields.set(key, value);
		} else if (isNodeList(value)) {
			fields.set(
				key,
				value.map((item) => item ?? undefined),
			);
		} else if (isLeaf(value)) {
			fields.set(key, value ?? undefined);
		} else {
			fields.set(key, Symbol(key));
		}
	}
	return fields;
}

function isFieldList(value: FieldValue): value is ReadonlyArray<ESTree.Node | undefined> {
	return Array.isArray(value);
}

function matchValues(pattern: FieldValue, candidate: FieldValue, state: MatchState): boolean {
	if (isFieldList(pattern) && isFieldList(candidate)) {
		return (
			pattern.length === candidate.length &&
			pattern.every((item, index) => matchValues(item, candidate.at(index), state))
		);
	}
	if (isNode(pattern) && isNode(candidate)) return matchNodes(pattern, candidate, state);
	return pattern === candidate;
}

function matchNodes(pattern: ESTree.Node, candidate: ESTree.Node, state: MatchState): boolean {
	if (isIdentifier(pattern) && state.parameters.has(pattern.name)) return bind(pattern.name, candidate, state);
	if (pattern.type !== candidate.type) return false;

	// `node.name` names a property, not the guard's `name` parameter.
	if (isMemberExpression(pattern) && !pattern.computed && isMemberExpression(candidate)) {
		return (
			!candidate.computed &&
			pattern.optional === candidate.optional &&
			pattern.property.type === candidate.property.type &&
			pattern.property.name === candidate.property.name &&
			matchNodes(pattern.object, candidate.object, state)
		);
	}

	const candidateFields = readFields(candidate);
	for (const [key, value] of readFields(pattern)) {
		if (!matchValues(value, candidateFields.get(key), state)) return false;
	}
	return true;
}

/**
 * One term of the chain; when negated, the code's term is `!` of the guard's.
 *
 * @param pattern - Term of the guard's body.
 * @param candidate - Term of the code's chain.
 * @param negated - Whether the code checks the opposite.
 * @param state - Bindings so far.
 * @returns Whether the terms match.
 */
function matchTerm(
	pattern: ESTree.Expression,
	candidate: ESTree.Expression,
	negated: boolean,
	state: MatchState,
): boolean {
	if (!negated) return matchNodes(pattern, candidate, state);
	return isUnaryExpression(candidate) && candidate.operator === "!" && matchNodes(pattern, candidate.argument, state);
}

function matchChain(
	pattern: ESTree.Expression,
	candidate: ESTree.Expression,
	operators: ChainOperators,
	state: MatchState,
): boolean {
	if (isLogicalExpression(pattern) && pattern.operator === operators.pattern) {
		return (
			isLogicalExpression(candidate) &&
			candidate.operator === operators.candidate &&
			matchChain(pattern.left, candidate.left, operators, state) &&
			matchChain(pattern.right, candidate.right, operators, state)
		);
	}
	return matchTerm(pattern, candidate, operators.negated, state);
}

function flattenChain(node: ESTree.Expression, operator: string, terms: Array<ESTree.Expression>): void {
	if (isLogicalExpression(node) && node.operator === operator) {
		flattenChain(node.left, operator, terms);
		flattenChain(node.right, operator, terms);
		return;
	}
	terms.push(node);
}

/**
 * A term that only passes the guard's parameters to a call, like
 * `isTsAsExpression(node)`, cannot depend on an earlier term having passed,
 * so the chain's terms may appear in any order.
 *
 * @param term - Term of the guard's body.
 * @param parameters - The guard's parameters.
 * @returns Whether the term can move within its chain.
 */
function isMovableTerm(term: ESTree.Expression, parameters: ReadonlySet<string>): boolean {
	return (
		isCallExpression(term) &&
		term.arguments.every((argument) => isIdentifier(argument) && parameters.has(argument.name))
	);
}

/**
 * Matches each code term to a different guard term, trying every pairing and
 * undoing the bindings of a pairing that leads nowhere.
 *
 * @param patterns - Guard terms not yet paired.
 * @param candidates - Code terms not yet paired.
 * @param negated - Whether the code checks the opposite.
 * @param state - Bindings so far.
 * @returns Whether every code term pairs with a guard term.
 */
function matchTermsInAnyOrder(
	patterns: ReadonlyArray<ESTree.Expression>,
	candidates: ReadonlyArray<ESTree.Expression>,
	negated: boolean,
	state: MatchState,
): boolean {
	const [candidate, ...remainingCandidates] = candidates;
	if (candidate === undefined) return true;

	for (const [index, pattern] of patterns.entries()) {
		const saved = new Map(state.bindings);
		const remainingPatterns = patterns.toSpliced(index, 1);
		if (
			matchTerm(pattern, candidate, negated, state) &&
			matchTermsInAnyOrder(remainingPatterns, remainingCandidates, negated, state)
		) {
			return true;
		}

		state.bindings.clear();
		for (const [name, node] of saved) state.bindings.set(name, node);
	}
	return false;
}

function matchBody(
	guard: SharedGuard,
	candidate: ESTree.LogicalExpression,
	operators: ChainOperators,
	state: MatchState,
): boolean {
	const patterns = new Array<ESTree.Expression>();
	flattenChain(guard.body, operators.pattern, patterns);
	if (patterns.some((term) => !isMovableTerm(term, state.parameters))) {
		return matchChain(guard.body, candidate, operators, state);
	}

	const candidates = new Array<ESTree.Expression>();
	flattenChain(candidate, operators.candidate, candidates);
	return (
		patterns.length === candidates.length && matchTermsInAnyOrder(patterns, candidates, operators.negated, state)
	);
}

/**
 * Whether a logical chain repeats a guard's body, either as written or as its
 * negation by De Morgan's law.
 *
 * @param guard - Guard whose body is a logical chain.
 * @param candidate - Top of a logical chain in the code.
 * @param getText - Source text of a node, to compare repeated arguments.
 * @returns The guard's arguments when the chain repeats it.
 */
export function matchGuard(
	guard: SharedGuard,
	candidate: ESTree.LogicalExpression,
	getText: GetText,
): GuardMatch | undefined {
	const patternOperator = guard.body.operator;
	const negated = candidate.operator !== patternOperator;
	if (negated && OPPOSITE_OPERATORS.get(patternOperator) !== candidate.operator) return undefined;

	const state: MatchState = { bindings: new Map(), getText, parameters: new Set(guard.parameters) };
	const operators: ChainOperators = { candidate: candidate.operator, negated, pattern: patternOperator };
	if (!matchBody(guard, candidate, operators, state)) return undefined;

	const matchedArguments = new Array<ESTree.Node>();
	for (const parameter of guard.parameters) {
		const bound = state.bindings.get(parameter);
		if (bound === undefined) return undefined;
		matchedArguments.push(bound);
	}
	return { arguments: matchedArguments, negated };
}
