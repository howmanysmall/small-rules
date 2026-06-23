import { getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isImportBinding } from "$oxc-utilities/static-expression-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

const NATIVE_PROPERTIES_SUFFIX = "NativeProperties";

type SpreadReportTarget =
	| {
			readonly messageId: "noElementSpread";
	  }
	| {
			readonly messageId: "noNativePropertiesSpread";
			readonly propertyName: string;
	  };

function getJsxAttributeName(name: ESTree.JSXAttributeName): string | undefined {
	return name.type === "JSXIdentifier" ? name.name : name.name.name;
}

function isNativePropertiesPropertyName(name: string): boolean {
	return name === "nativeProperties" || name.endsWith(NATIVE_PROPERTIES_SUFFIX);
}

function getVariableInitializer(definition: ScopeVariable["defs"][number]): ESTree.Expression | undefined {
	if (definition.type !== "Variable" || definition.node.type !== "VariableDeclarator") return undefined;
	return definition.node.init ?? undefined;
}

function isModuleLevelScope(scope: Scope): boolean {
	return scope.type === "module" || scope.type === "global";
}

function getRootIdentifier(expression: ESTree.Expression): ESTree.IdentifierReference | undefined {
	let currentExpression = unwrapExpression(expression);

	while (currentExpression.type === "MemberExpression") {
		const objectExpression = unwrapExpression(currentExpression.object);
		if (objectExpression.type === "Identifier") return objectExpression;
		if (objectExpression.type !== "MemberExpression") return undefined;
		currentExpression = objectExpression;
	}

	/* v8 ignore next -- @preserve unwrapExpression yields identifiers only for non-member roots here. */
	return currentExpression.type === "Identifier" ? currentExpression : undefined;
}

function shouldReportSpreadArgument(sourceCode: SourceCode, argument: ESTree.Expression): boolean {
	const unwrappedArgument = unwrapExpression(argument);
	/* v8 ignore next -- @preserve parser spread arguments are identifiers or member expressions in targeted JSX cases. */
	if (unwrappedArgument.type === "ObjectExpression") return true;

	const rootIdentifier = getRootIdentifier(unwrappedArgument);
	if (rootIdentifier === undefined) return false;

	const variable = getVariableByName(sourceCode.getScope(rootIdentifier), rootIdentifier.name);
	if (variable === undefined) return false;

	return isImportBinding(variable) || isModuleLevelScope(variable.scope);
}

function resolveObjectExpression(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
	seen: Set<ESTree.Node>,
): ESTree.ObjectExpression | undefined {
	const unwrappedExpression = unwrapExpression(expression);
	if (seen.has(unwrappedExpression)) return undefined;
	seen.add(unwrappedExpression);

	if (unwrappedExpression.type === "ObjectExpression") return unwrappedExpression;
	if (unwrappedExpression.type !== "Identifier") return undefined;

	const variable = getVariableByName(sourceCode.getScope(unwrappedExpression), unwrappedExpression.name);
	if (variable === undefined || isModuleLevelScope(variable.scope)) return undefined;

	for (const definition of variable.defs) {
		const initializer = getVariableInitializer(definition);
		if (initializer === undefined) continue;

		const resolvedObjectExpression = resolveObjectExpression(sourceCode, initializer, seen);
		if (resolvedObjectExpression !== undefined) return resolvedObjectExpression;
	}

	return undefined;
}

const noNativePropertiesSpread = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		function reportStaticSpreads(objectExpression: ESTree.ObjectExpression, target: SpreadReportTarget): void {
			for (const property of objectExpression.properties) {
				if (property.type !== "SpreadElement") continue;
				if (!shouldReportSpreadArgument(sourceCode, property.argument)) continue;

				const source = sourceCode.getText(property.argument);
				context.report({
					data: "propertyName" in target ? { prop: target.propertyName, source } : { source },
					messageId: target.messageId,
					node: property,
				});
			}
		}

		return {
			JSXAttribute(node): void {
				const propertyName = getJsxAttributeName(node.name);
				if (propertyName === undefined || !isNativePropertiesPropertyName(propertyName)) return;

				const { value } = node;
				if (value?.type !== "JSXExpressionContainer") return;

				const { expression } = value;
				if (expression.type === "JSXEmptyExpression") return;

				const objectExpression = resolveObjectExpression(sourceCode, expression, new Set<ESTree.Node>());
				if (objectExpression === undefined) return;

				reportStaticSpreads(objectExpression, { messageId: "noNativePropertiesSpread", propertyName });
			},
			JSXSpreadAttribute(node): void {
				const objectExpression = resolveObjectExpression(sourceCode, node.argument, new Set<ESTree.Node>());
				if (objectExpression === undefined) return;

				reportStaticSpreads(objectExpression, { messageId: "noElementSpread" });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow spreading static property bags into nativeProperties/*NativeProperties props and onto JSX elements via intermediate objects, because the spread creates a new copied table every render.",
			recommended: true,
		},
		messages: {
			noElementSpread:
				"Spreading static property bag {{source}} through an intermediate object creates a new table every render. Inline the full object properties directly on the JSX element.",
			noNativePropertiesSpread:
				"Spreading static property bag {{source}} into {{prop}} creates a new table every render. Pass it directly or inline the full object instead.",
		},
		schema: [],
		type: "problem",
	},
});

export default noNativePropertiesSpread;
