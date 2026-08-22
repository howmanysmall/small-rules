import { createRule } from "$oxc-utilities/create-rule";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { getEnvironment } from "$oxc-utilities/react-utilities";

import type { ESTree, Reference, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

const noResetAllStateOnPropertyChange = createRule("no-reset-all-state-on-property-change", "react", {
	create(context): Visitor {
		const environment = getEnvironment(context.options[0]);
		const analysis = getReactEffectAnalysis(context.sourceCode, environment);
		const { sourceCode } = context;

		return {
			Program(): void {
				for (const effect of analysis.effects) {
					if (effect.dependencyReferences === undefined) continue;
					// Skip custom hooks because they can't receive `key` like
					// components can.
					const containingNode = analysis.findEnclosingReactNode(effect.node);
					if (containingNode !== undefined && analysis.isCustomHook(containingNode)) continue;

					const propertyUsedToResetAllState = findPropertyUsedToResetAllState(
						sourceCode,
						analysis,
						effect.functionReferences,
						effect.dependencyReferences,
						effect.node,
					);

					if (propertyUsedToResetAllState !== undefined) {
						context.report({
							data: { prop: propertyUsedToResetAllState.identifier.name },
							messageId: "avoidResettingAllStateWhenAPropChanges",
							node: effect.node,
						});
					}
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow resetting all state in an effect when a prop changes.",
			recommended: true,
		},
		messages: {
			avoidResettingAllStateWhenAPropChanges:
				'Avoid resetting all state when a prop changes. Instead, if "{{prop}}" is a key, pass it as "key" so React will reset the component\'s state.',
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: {
						default: "roblox-ts",
						description: "The React environment: 'roblox-ts' uses @rbxts/react, 'standard' uses react.",
						enum: ["roblox-ts", "standard"],
						type: "string",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

function findPropertyUsedToResetAllState(
	sourceCode: SourceCode,
	analysis: ReactEffectAnalysis,
	effectFunctionReferences: ReadonlyArray<Reference>,
	dependencyReferences: ReadonlyArray<Reference>,
	useEffectNode: ESTree.CallExpression,
): Reference | undefined {
	const stateSetterReferences = effectFunctionReferences.filter((reference) => analysis.isStateCall(reference));

	const isAllStateReset =
		stateSetterReferences.length > 0 &&
		stateSetterReferences.every((reference) => isSetStateToInitialValue(sourceCode, analysis, reference)) &&
		stateSetterReferences.length === countUseStates(analysis, analysis.findEnclosingReactNode(useEffectNode));

	if (!isAllStateReset) return undefined;

	return dependencyReferences
		.flatMap((reference) => analysis.scope.getUpstreamReferences(reference))
		.find((reference) => analysis.isProp(reference));
}

function isSetStateToInitialValue(
	sourceCode: SourceCode,
	analysis: ReactEffectAnalysis,
	setterReference: Reference,
): boolean {
	const callExpression = analysis.scope.getCallExpression(setterReference);
	if (callExpression === undefined) return false;
	const [setStateToValue] = callExpression.arguments;
	const useStateDeclaration = analysis.getUseStateDeclaration(setterReference);
	// `getUseStateDeclaration` only returns declarators whose init is the
	// `useState(...)` call (the upstream chain always reaches the setter's own
	// declaration), so a non-call init or a missing declaration can never occur
	// for the state calls this rule inspects.
	/* v8 ignore next -- useState declarations always have a CallExpression init here. @preserve */
	if (useStateDeclaration?.init?.type !== "CallExpression") {
		return false;
	}
	const [stateInitialValue] = useStateDeclaration.init.arguments;

	// `useState()` (with no args) defaults to `undefined`,
	// so omitting the arg is equivalent to passing `undefined`.
	// Technically this would false positive if they shadowed
	// `undefined` in only one of the scopes (only possible via `var`),
	// but I hope no one would do that.
	if (isUndefined(setStateToValue) && isUndefined(stateInitialValue)) {
		return true;
	}

	// `sourceCode.getText()` returns the entire file when passed null/undefined
	// - let's short circuit that
	if (setStateToValue === undefined || stateInitialValue === undefined) {
		return false;
	}

	// This is one of the few places we compare just the immediate nodes,
	// not upstream variables - that seems pretty complicated here?
	// At the least, upstream functions would have to return literals for us to
	// consider too, not just variables.
	return sourceCode.getText(setStateToValue) === sourceCode.getText(stateInitialValue);
}

function isUndefined(node?: ESTree.Node): boolean {
	return node === undefined || (node.type === "Identifier" && node.name === "undefined");
}

function countUseStates(
	analysis: ReactEffectAnalysis,
	componentNode: ESTree.ArrowFunctionExpression | ESTree.Function | ESTree.VariableDeclarator | undefined,
): number {
	let currentNode = componentNode;

	while (currentNode !== undefined) {
		if (currentNode.type === "VariableDeclarator" && currentNode.init?.type === "CallExpression") {
			// Because `descend` will ignore the arguments.
			const [componentArgument] = currentNode.init.arguments;
			/* v8 ignore next -- memo/forwardRef calls always receive the component as their first argument. @preserve */
			if (componentArgument === undefined) return 0;
			if (
				componentArgument.type !== "ArrowFunctionExpression" &&
				componentArgument.type !== "FunctionExpression"
			) {
				return 0;
			}
			currentNode = componentArgument;
			continue;
		}

		return analysis.scope.getDescendantCallExpressions(currentNode).filter(({ callee }) => {
			if (callee.type !== "Identifier" && callee.type !== "MemberExpression") return false;
			if (callee.type === "MemberExpression") {
				if (callee.computed || callee.object.type !== "Identifier" || callee.property.type !== "Identifier") {
					return false;
				}
				if (callee.object.name !== "React" || callee.property.name !== "useState") return false;
			} else if (callee.name !== "useState") return false;
			return true;
		}).length;
	}

	return 0;
}

export default noResetAllStateOnPropertyChange;
