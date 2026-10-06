import {
	isBinaryExpression,
	isCallExpression,
	isChainExpression,
	isIdentifier,
	isLogicalExpression,
	isMemberExpression,
	isNode,
	isSpreadElement,
	isStringLiteral,
	isUnaryExpression,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import type { ESTree } from "oxlint-plugin-utilities";

import type { SharedFunction, SharedGuard } from "./utilities-index.ts";

export interface GuardMatch {
	/** What the code passes for each guard parameter, in order. */
	readonly arguments: ReadonlyArray<ESTree.Node>;
	/** Whether the code checks the opposite: `!a || !b` for a guard `a && b`. */
	readonly negated: boolean;
}

type GetText = (node: ESTree.Node) => string;
type Leaf = bigint | boolean | number | string | symbol | undefined;
type FieldValue = ESTree.Node | Leaf | ReadonlyArray<ESTree.Node | undefined>;

export interface GuardMatchContext {
	/**
	 * The value of a shared string constant, so `IDENTIFIER` matches
	 * `"Identifier"`.
	 */
	readonly getConstantValue: (name: string) => string | undefined;
	/** Shared single-return functions, to see through their calls. */
	readonly getFunction: (name: string) => SharedFunction | undefined;
	/** Source text of a node, to compare repeated arguments. */
	readonly getText: GetText;
}

interface MatchState extends GuardMatchContext {
	readonly bindings: Map<string, ESTree.Node>;
	/** Whether the candidate is an inlined body, not the code. */
	readonly inlined: boolean;
	readonly parameters: ReadonlySet<string>;
	/** While inlined: parameters mapped to the code's arguments. */
	readonly substitutions: ReadonlyMap<string, ESTree.Node>;
}

const NO_SUBSTITUTIONS: ReadonlyMap<string, ESTree.Node> = new Map();

const OPPOSITE_OPERATORS = new Map<string, string>([
	["&&", "||"],
	["||", "&&"],
]);

/** The comparison a negated comparison denies: `===` for `!==`. */
const POSITIVE_EQUALITY = new Map<string, string>([
	["!=", "=="],
	["!==", "==="],
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

/**
 * In an inlined body, the inlined function's parameter stands for the code's
 * argument, which is matched as ordinary code from there on.
 *
 * @param candidate - Node of the inlined body.
 * @param state - Current substitutions.
 * @returns The code's argument, when `candidate` is a substituted parameter.
 */
function getSubstitution(candidate: ESTree.Node, state: MatchState): ESTree.Node | undefined {
	return state.inlined && isIdentifier(candidate) ? state.substitutions.get(candidate.name) : undefined;
}

function isGuardParameter(pattern: ESTree.Node, state: MatchState): pattern is ESTree.IdentifierName {
	return isIdentifier(pattern) && state.parameters.has(pattern.name);
}

/**
 * Inside an inlined body, a guard parameter may only stand for one of the
 * code's arguments, never for part of the inlined body itself.
 *
 * @param name - Guard parameter.
 * @param candidate - Node the parameter lines up with.
 * @param state - Bindings so far.
 * @returns Whether the binding is consistent.
 */
function bindParameter(name: string, candidate: ESTree.Node, state: MatchState): boolean {
	if (!state.inlined) return bind(name, candidate, state);
	const substitution = getSubstitution(candidate, state);
	return substitution !== undefined && bind(name, substitution, state);
}

interface NodePair {
	readonly candidate: ESTree.Node;
	readonly pattern: ESTree.Node;
	readonly state: MatchState;
}

/**
 * Lines the two sides up: a substituted parameter becomes the code's argument,
 * and a guard's `node?.type` also covers code that reads `node.type`.
 *
 * @param pattern - Node of the guard's body.
 * @param candidate - Node of the code or of an inlined body.
 * @param state - Current substitutions.
 * @returns The nodes to compare and the state to compare them in.
 */
function alignNodes(pattern: ESTree.Node, candidate: ESTree.Node, state: MatchState): NodePair {
	const substitution = getSubstitution(candidate, state);
	const aligned =
		substitution === undefined
			? { candidate, state }
			: { candidate: substitution, state: { ...state, inlined: false, substitutions: NO_SUBSTITUTIONS } };
	const unchained = isChainExpression(pattern) && !isChainExpression(aligned.candidate);
	return { ...aligned, pattern: unchained ? pattern.expression : pattern };
}

/**
 * `node.name` names a property, not a guard parameter called `name`, so the
 * property is compared by name.
 *
 * @param pattern - Non-computed member access in the guard's body.
 * @param candidate - Member access of the same shape.
 * @param state - Bindings so far.
 * @returns Whether the accesses match.
 */
function matchMembers(
	pattern: ESTree.PrivateFieldExpression | ESTree.StaticMemberExpression,
	candidate: ESTree.MemberExpression,
	state: MatchState,
): boolean {
	return (
		!candidate.computed &&
		(pattern.optional || !candidate.optional) &&
		pattern.property.type === candidate.property.type &&
		pattern.property.name === candidate.property.name &&
		matchNodes(pattern.object, candidate.object, state)
	);
}

/**
 * A string a node stands for: a string literal's value, or a shared constant's.
 *
 * @param node - Node to read.
 * @param state - Shared constants.
 * @returns The string, if the node is one.
 */
function getStringValue(node: ESTree.Node, state: MatchState): string | undefined {
	if (isStringLiteral(node)) return node.value;
	return isIdentifier(node) ? state.getConstantValue(node.name) : undefined;
}

function matchNodes(pattern: ESTree.Node, candidate: ESTree.Node, state: MatchState): boolean {
	if (isGuardParameter(pattern, state)) return bindParameter(pattern.name, candidate, state);

	const aligned = alignNodes(pattern, candidate, state);
	const patternValue = getStringValue(aligned.pattern, aligned.state);
	if (patternValue !== undefined && patternValue === getStringValue(aligned.candidate, aligned.state)) return true;
	if (aligned.pattern.type !== aligned.candidate.type) return false;
	if (isMemberExpression(aligned.pattern) && !aligned.pattern.computed && isMemberExpression(aligned.candidate)) {
		return matchMembers(aligned.pattern, aligned.candidate, aligned.state);
	}
	return matchFields(aligned.pattern, aligned.candidate, aligned.state);
}

function matchFields(pattern: ESTree.Node, candidate: ESTree.Node, state: MatchState): boolean {
	const candidateFields = readFields(candidate);
	for (const [key, value] of readFields(pattern)) {
		if (!matchValues(value, candidateFields.get(key), state)) return false;
	}
	return true;
}

/**
 * A term the code asserts as written: the guard's term itself, or a call to a
 * shared function whose body is that term.
 *
 * @param pattern - Term of the guard's body.
 * @param term - Term of the code's chain.
 * @param state - Bindings so far.
 * @returns Whether the terms match.
 */
function matchPositiveTerm(pattern: ESTree.Expression, term: ESTree.Expression, state: MatchState): boolean {
	return attempt(state, () => matchNodes(pattern, term, state)) || matchInlined(pattern, term, state);
}

/**
 * A term the code asserts the opposite of: `!term`, or `a !== b` for the
 * guard's `a === b`.
 *
 * @param pattern - Term of the guard's body.
 * @param candidate - Term of the code's chain.
 * @param state - Bindings so far.
 * @returns Whether the code's term negates the guard's.
 */
function matchNegatedTerm(pattern: ESTree.Expression, candidate: ESTree.Expression, state: MatchState): boolean {
	if (isUnaryExpression(candidate) && candidate.operator === "!") {
		return matchPositiveTerm(pattern, candidate.argument, state);
	}
	return (
		isBinaryExpression(pattern) &&
		isBinaryExpression(candidate) &&
		POSITIVE_EQUALITY.get(candidate.operator) === pattern.operator &&
		attempt(
			state,
			() => matchNodes(pattern.left, candidate.left, state) && matchNodes(pattern.right, candidate.right, state),
		)
	);
}

function matchTerm(
	pattern: ESTree.Expression,
	candidate: ESTree.Expression,
	negated: boolean,
	state: MatchState,
): boolean {
	return negated ? matchNegatedTerm(pattern, candidate, state) : matchPositiveTerm(pattern, candidate, state);
}

/**
 * Runs one matching attempt, undoing any bindings it made if it fails.
 *
 * @param state - Bindings to protect.
 * @param match - Matching step that may add bindings.
 * @returns Whether the attempt matched.
 */
function attempt(state: MatchState, match: () => boolean): boolean {
	const saved = new Map(state.bindings);
	const matched = match();
	if (!matched) {
		state.bindings.clear();
		for (const [name, node] of saved) state.bindings.set(name, node);
	}
	return matched;
}

/**
 * A call to a shared single-return function stands for that function's body,
 * so `isIdentifier(x)` matches a guard term `node?.type === IDENTIFIER`.
 *
 * @param pattern - Term of the guard's body.
 * @param term - Term of the code's chain.
 * @param state - Bindings so far.
 * @returns Whether the inlined call matches the guard's term.
 */
function matchInlined(pattern: ESTree.Expression, term: ESTree.Expression, state: MatchState): boolean {
	if (!isCallExpression(term) || !isIdentifier(term.callee)) return false;

	const inlined = state.getFunction(term.callee.name);
	if (inlined?.parameters.length !== term.arguments.length) return false;

	const substitutions = new Map<string, ESTree.Node>();
	for (const [index, parameter] of inlined.parameters.entries()) {
		const argument = term.arguments.at(index);
		if (argument === undefined || isSpreadElement(argument)) return false;
		substitutions.set(parameter, argument);
	}
	return matchNodes(pattern, inlined.body, { ...state, inlined: true, substitutions });
}

/**
 * The terms of a logical chain: `a`, `b` and `c` for `a && b && c`.
 *
 * @param node - Expression that may be a chain.
 * @param operator - Operator that joins the terms.
 * @param terms - Receives the terms in order.
 */
export function flattenChain(node: ESTree.Expression, operator: string, terms: Array<ESTree.Expression>): void {
	if (isLogicalExpression(node) && node.operator === operator) {
		flattenChain(node.left, operator, terms);
		flattenChain(node.right, operator, terms);
		return;
	}
	terms.push(node);
}

const guardTermsCache = new WeakMap<SharedGuard, ReadonlyArray<ESTree.Expression>>();

/**
 * The terms of a guard's body, flattened once per guard.
 *
 * @param guard - Guard whose body is a logical chain.
 * @returns The body's terms in order.
 */
export function getGuardTerms(guard: SharedGuard): ReadonlyArray<ESTree.Expression> {
	const cached = guardTermsCache.get(guard);
	if (cached !== undefined) return cached;

	const terms = new Array<ESTree.Expression>();
	flattenChain(guard.body, guard.body.operator, terms);
	guardTermsCache.set(guard, terms);
	return terms;
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

function matchTermsInOrder(
	patterns: ReadonlyArray<ESTree.Expression>,
	candidates: ReadonlyArray<ESTree.Expression>,
	negated: boolean,
	state: MatchState,
): boolean {
	return patterns.every((pattern, index) => {
		const candidate = candidates.at(index);
		return candidate !== undefined && matchTerm(pattern, candidate, negated, state);
	});
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
		const remainingPatterns = patterns.toSpliced(index, 1);
		const paired = attempt(
			state,
			() =>
				matchTerm(pattern, candidate, negated, state) &&
				matchTermsInAnyOrder(remainingPatterns, remainingCandidates, negated, state),
		);
		if (paired) return true;
	}
	return false;
}

/**
 * Whether consecutive terms of a chain repeat a guard's body, either as
 * written or as its negation by De Morgan's law.
 *
 * @param guard - Guard whose body is a logical chain.
 * @param candidates - As many consecutive terms of the code's chain as the guard has.
 * @param operator - The code chain's operator.
 * @param context - Lookups into the code and the shared utilities.
 * @returns The guard's arguments when the terms repeat it.
 */
export function matchGuard(
	guard: SharedGuard,
	candidates: ReadonlyArray<ESTree.Expression>,
	operator: string,
	context: GuardMatchContext,
): GuardMatch | undefined {
	const patternOperator = guard.body.operator;
	const negated = operator !== patternOperator;
	if (negated && OPPOSITE_OPERATORS.get(patternOperator) !== operator) return undefined;

	const state: MatchState = {
		...context,
		bindings: new Map(),
		inlined: false,
		parameters: new Set(guard.parameters),
		substitutions: NO_SUBSTITUTIONS,
	};
	const patterns = getGuardTerms(guard);
	const isMovable = patterns.every((term) => isMovableTerm(term, state.parameters));
	const matched = isMovable
		? matchTermsInAnyOrder(patterns, candidates, negated, state)
		: matchTermsInOrder(patterns, candidates, negated, state);
	if (!matched) return undefined;

	const matchedArguments = new Array<ESTree.Node>();
	for (const parameter of guard.parameters) {
		const bound = state.bindings.get(parameter);
		if (bound === undefined) return undefined;
		matchedArguments.push(bound);
	}
	return { arguments: matchedArguments, negated };
}
