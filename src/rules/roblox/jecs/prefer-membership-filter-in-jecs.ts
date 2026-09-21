import { isJecsWorldExpression } from "$oxc-utilities/api-provenance";
import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isArrayPattern,
	isCallExpression,
	isIdentifierName,
	isMemberExpression,
	isRestElement,
	isVariableDeclaration,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Fix, Fixer, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

interface QueryChain {
	readonly queryCall: ESTree.CallExpression;
	readonly withCall: ESTree.CallExpression | undefined;
}

interface StaticMethodCall {
	readonly call: ESTree.CallExpression;
	readonly method: string;
	readonly object: ESTree.Expression;
}

interface MembershipCandidate {
	readonly chain: QueryChain;
	readonly firstQueryArgument: ESTree.Argument;
	readonly lastQueryArgument: ESTree.Argument;
	readonly movedArguments: ReadonlyArray<ESTree.Expression>;
	readonly pattern: ESTree.ArrayPattern;
	readonly retainedArguments: ReadonlyArray<ESTree.Expression>;
	readonly retainedElements: ReadonlyArray<ESTree.BindingPattern>;
}

function getStaticMethodCall(expression: ESTree.Expression): StaticMethodCall | undefined {
	if (!isCallExpression(expression) || !isMemberExpression(expression.callee) || expression.callee.computed) {
		return undefined;
	}
	/* v8 ignore next -- a non-computed ESTree member property is an identifier. @preserve */
	if (!isIdentifierName(expression.callee.property)) return undefined;
	return { call: expression, method: expression.callee.property.name, object: expression.callee.object };
}

function getDirectQueryChain(sourceCode: SourceCode, expression: ESTree.Expression): QueryChain | undefined {
	let current = expression;
	let withCall: ESTree.CallExpression | undefined;
	while (true) {
		const matched = getStaticMethodCall(current);
		if (matched === undefined) return undefined;
		if (matched.method === "query") {
			return isJecsWorldExpression(sourceCode, matched.object)
				? { queryCall: matched.call, withCall }
				: undefined;
		}
		if (matched.method !== "with" && matched.method !== "without") return undefined;
		if (matched.method === "with") withCall ??= matched.call;
		current = matched.object;
	}
}

function isSafeToMove(expression: ESTree.Expression): boolean {
	return isIdentifierName(expression) || expression.type === "Literal";
}

function getBindingVariables(
	sourceCode: SourceCode,
	node: ESTree.ForOfStatement,
	pattern: ESTree.ArrayPattern,
): ReadonlyMap<string, Variable> {
	const variables = new Map<string, Variable>();
	const scope = sourceCode.getScope(node.body);
	for (const element of pattern.elements) {
		if (element === null || !isIdentifierName(element)) continue;
		const variable = getVariableByName(scope, element.name);
		/* v8 ignore next -- each identifier in the loop binding declares a scoped variable. @preserve */
		if (variable !== undefined) variables.set(element.name, variable);
	}
	return variables;
}

function isUnusedBinding(
	element: ESTree.BindingPattern | undefined,
	variables: ReadonlyMap<string, Variable>,
): boolean {
	if (element === undefined) return true;
	if (!isIdentifierName(element)) return false;
	/* v8 ignore next -- loop binding identifiers are present in the collected variable map. @preserve */
	return variables.get(element.name)?.references.every((reference) => reference.isWrite()) ?? false;
}

function collectBindings(
	pattern: ESTree.ArrayPattern,
	chain: QueryChain,
	variables: ReadonlyMap<string, Variable>,
): Pick<MembershipCandidate, "movedArguments" | "retainedArguments" | "retainedElements"> | undefined {
	const [entityElement] = pattern.elements;
	if (entityElement === null || entityElement === undefined || !isIdentifierName(entityElement)) return undefined;
	const retainedArguments = new Array<ESTree.Expression>();
	const movedArguments = new Array<ESTree.Expression>();
	const retainedElements: Array<ESTree.BindingPattern> = [entityElement];
	for (let index = 0; index < chain.queryCall.arguments.length; index += 1) {
		const argument = chain.queryCall.arguments[index];
		/* v8 ignore next -- array iteration indices always address an existing element. @preserve */
		if (argument === undefined || argument.type === "SpreadElement") return undefined;
		const binding = pattern.elements[index + 1] ?? undefined;
		/* v8 ignore next -- outer candidate validation already rejects rest bindings. @preserve */
		if (binding !== undefined && isRestElement(binding)) return undefined;
		if (isUnusedBinding(binding, variables)) {
			movedArguments.push(argument);
			continue;
		}
		/* v8 ignore next -- an absent binding is classified as unused above. @preserve */
		if (binding === undefined) return undefined;
		retainedArguments.push(argument);
		retainedElements.push(binding);
	}
	return { movedArguments, retainedArguments, retainedElements };
}

function getCandidate(sourceCode: SourceCode, node: ESTree.ForOfStatement): MembershipCandidate | undefined {
	if (!isVariableDeclaration(node.left) || node.left.declarations.length !== 1) return undefined;
	const [declarator] = node.left.declarations;
	if (declarator === undefined || !isArrayPattern(declarator.id)) return undefined;
	const pattern = declarator.id;
	if (pattern.elements.some((element) => element !== null && isRestElement(element))) return undefined;
	const chain = getDirectQueryChain(sourceCode, node.right);
	if (chain === undefined || chain.queryCall.arguments.length < 2) return undefined;
	const collected = collectBindings(pattern, chain, getBindingVariables(sourceCode, node, pattern));
	if (collected === undefined) return undefined;
	if (collected.movedArguments.length === 0 || collected.retainedArguments.length === 0) return undefined;
	const [firstQueryArgument] = chain.queryCall.arguments;
	const lastQueryArgument = chain.queryCall.arguments.at(-1);
	/* v8 ignore next -- query candidates require at least two arguments. @preserve */
	if (firstQueryArgument === undefined || lastQueryArgument === undefined) return undefined;
	return { chain, firstQueryArgument, lastQueryArgument, pattern, ...collected };
}

function argumentText(sourceCode: SourceCode, arguments_: ReadonlyArray<ESTree.Expression>): string {
	return arguments_.map((argument) => sourceCode.getText(argument)).join(", ");
}

function createFixes(candidate: MembershipCandidate, sourceCode: SourceCode, fixer: Fixer): Array<Fix> {
	const fixes = [
		fixer.replaceText(
			candidate.pattern,
			`[${candidate.retainedElements.map((element) => sourceCode.getText(element)).join(", ")}]`,
		),
		fixer.replaceTextRange(
			[candidate.firstQueryArgument.range[0], candidate.lastQueryArgument.range[1]],
			argumentText(sourceCode, candidate.retainedArguments),
		),
	];
	const movedText = argumentText(sourceCode, candidate.movedArguments);
	const { chain } = candidate;
	if (chain.withCall === undefined) fixes.push(fixer.insertTextAfter(chain.queryCall, `.with(${movedText})`));
	else {
		const [firstWithArgument] = chain.withCall.arguments;
		if (firstWithArgument === undefined) {
			fixes.push(
				fixer.replaceTextRange([chain.withCall.callee.range[1], chain.withCall.range[1]], `(${movedText})`),
			);
		} else fixes.push(fixer.insertTextBefore(firstWithArgument, `${movedText}, `));
	}
	return fixes;
}

const preferMembershipFilterInJecs = createRule("prefer-membership-filter-in-jecs", "roblox/jecs", {
	create(context): Visitor {
		const { sourceCode } = context;
		return {
			ForOfStatement(node): void {
				const candidate = getCandidate(sourceCode, node);
				if (candidate === undefined) return;
				if (candidate.movedArguments.every(isSafeToMove)) {
					context.report({
						fix: (fixer) => createFixes(candidate, sourceCode, fixer),
						messageId: "preferMembershipFilter",
						node: candidate.chain.queryCall,
					});
				} else context.report({ messageId: "preferMembershipFilter", node: candidate.chain.queryCall });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: { description: "Move discarded Jecs query component values into a membership-only with filter." },
		fixable: "code",
		messages: { preferMembershipFilter: "Move components whose values are not consumed from query() to with()." },
		schema: [] as const,
		type: "problem",
	},
});

export default preferMembershipFilterInJecs;
