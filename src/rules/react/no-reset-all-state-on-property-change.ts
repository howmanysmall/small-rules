import { createRule } from "$oxc-utilities/create-rule";
import {
	isCallbackFunction,
	isCallExpression,
	isIdentifierName,
	isIdentifierNamed,
	isMemberExpression,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { getReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment } from "$oxc-utilities/react-utilities";

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
				properties: { environment: ENVIRONMENT_SCHEMA },
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
	const stateSetterReferences = effectFunctionReferences.filter(analysis.isStateCall);

	const isAllStateReset =
		stateSetterReferences.length > 0 &&
		stateSetterReferences.every((reference) => isSetStateToInitialValue(sourceCode, analysis, reference)) &&
		stateSetterReferences.length === countUseStates(analysis, analysis.findEnclosingReactNode(useEffectNode));

	if (!isAllStateReset) return undefined;

	return dependencyReferences
		.flatMap((reference) => analysis.scope.getUpstreamReferences(reference))
		.find(analysis.isProp);
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
	/* v8 ignore next -- useState declarations always have a CallExpression init here. @preserve */
	if (!isCallExpression(useStateDeclaration?.init)) return false;

	const [stateInitialValue] = useStateDeclaration.init.arguments;
	if (isUndefined(setStateToValue) && isUndefined(stateInitialValue)) return true;
	if (setStateToValue === undefined || stateInitialValue === undefined) return false;

	return sourceCode.getText(setStateToValue) === sourceCode.getText(stateInitialValue);
}

function isUndefined(node?: ESTree.Node): boolean {
	return node === undefined || isIdentifierNamed(node, "undefined");
}

function countUseStates(
	analysis: ReactEffectAnalysis,
	componentNode: ESTree.ArrowFunctionExpression | ESTree.Function | ESTree.VariableDeclarator | undefined,
): number {
	let currentNode = componentNode;

	while (currentNode !== undefined) {
		if (isVariableDeclarator(currentNode) && isCallExpression(currentNode.init)) {
			// Because `descend` will ignore the arguments.
			const [componentArgument] = currentNode.init.arguments;
			if (!isCallbackFunction(componentArgument)) return 0;
			currentNode = componentArgument;
			continue;
		}

		return analysis.scope.getDescendantCallExpressions(currentNode).filter(({ callee }) => {
			const memberExpression = isMemberExpression(callee);
			if (!memberExpression && !isIdentifierName(callee)) return false;

			if (memberExpression) {
				const { object, property } = callee;
				if (
					callee.computed ||
					!isIdentifierNamed(object, "React") ||
					!isIdentifierNamed(property, "useState")
				) {
					return false;
				}
			} else if (callee.name !== "useState") return false;
			return true;
		}).length;
	}

	return 0;
}

export default noResetAllStateOnPropertyChange;
