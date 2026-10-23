import {
	isCallbackFunction,
	isCallExpression,
	isIdentifier,
	isIdentifierNamed,
	isMemberExpression,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";

import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

import type { ESTree, Reference, SourceCode } from "oxlint-plugin-utilities";

import type { ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

const noResetAllStateOnPropertyChange = createReactEffectRule("no-reset-all-state-on-property-change", {
	checkEffect(context, analysis, effect): void {
		if (effect.dependencyReferences === undefined) return;
		// Skip custom hooks because they can't receive `key` like
		// components can.
		const containingNode = analysis.findEnclosingReactNode(effect.node);
		if (containingNode !== undefined && analysis.isCustomHook(containingNode)) return;

		const propertyUsedToResetAllState = findPropertyUsedToResetAllState(
			context.sourceCode,
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
	},
	description: "Disallow resetting all state in an effect when a prop changes.",
	messages: {
		avoidResettingAllStateWhenAPropChanges:
			'Avoid resetting all state when a prop changes. Instead, if "{{prop}}" is a key, pass it as "key" so React will reset the component\'s state.',
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
	componentNode?: ESTree.ArrowFunctionExpression | ESTree.Function | ESTree.VariableDeclarator,
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
			if (!memberExpression && !isIdentifier(callee)) return false;

			if (memberExpression) {
				const { object, property } = callee;
				if (
					callee.computed ||
					!isIdentifierNamed(object, "React") ||
					!isIdentifierNamed(property, "useState")
				) {
					return false;
				}
			} else if (callee.name !== "useState") {
				return false;
			}

			return true;
		}).length;
	}

	return 0;
}

export default noResetAllStateOnPropertyChange;
