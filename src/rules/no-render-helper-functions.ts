import { getTypeAnnotationFromBinding } from "$oxc-utilities/oxc-utilities";
import { walkAstSlop } from "$oxc-utilities/react-hook-utilities";
import { isUppercaseName } from "$oxc-utilities/string-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { CallbackFunction } from "$oxc-types/missing-types";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const REACT_NODE_TYPE_NAMES = new Set(["JSXElement", "ReactElement", "ReactNode"]);
const WRAPPER_PARENT_TYPES = new Set([
	"ChainExpression",
	"ParenthesizedExpression",
	"TSAsExpression",
	"TSInstantiationExpression",
	"TSNonNullExpression",
	"TSSatisfiesExpression",
	"TSTypeAssertion",
]);

const HOOK_PATTERN = /^use[A-Z]/u;

type ScopeVariable = ReturnType<SourceCode["getDeclaredVariables"]>[number];

function isHookName(name: string): boolean {
	return HOOK_PATTERN.test(name);
}

function isReactNodeTypeAnnotation(node?: ESTree.TSType): boolean {
	if (node?.type !== "TSTypeReference") return false;

	const { typeName } = node;
	if (typeName.type === "Identifier") return REACT_NODE_TYPE_NAMES.has(typeName.name);
	/* v8 ignore next -- @preserve TSTypeReference type names are identifiers or qualified names in parser output. */
	if (typeName.type === "TSQualifiedName") return REACT_NODE_TYPE_NAMES.has(typeName.right.name);

	/* v8 ignore next -- @preserve TSTypeReference type names are identifiers or qualified names in parser output. */
	return false;
}

function getReturnTypeAnnotation({ returnType }: CallbackFunction): ESTree.TSType | undefined {
	return returnType?.typeAnnotation ?? undefined;
}

function hasJsxReturn(node: CallbackFunction): boolean {
	if (
		node.type === "ArrowFunctionExpression" &&
		(node.body.type === "JSXElement" || node.body.type === "JSXFragment")
	) {
		return true;
	}

	/* v8 ignore next -- @preserve declared function overloads have no runtime body and are not visited as callbacks. */
	if (node.body === null) return false;

	let foundJsx = false;

	walkAstSlop(node.body, (child) => {
		if (foundJsx) return;
		if (child.type !== "ReturnStatement") return;

		const { argument } = child;
		if (argument !== null && (argument.type === "JSXElement" || argument.type === "JSXFragment")) foundJsx = true;
	});

	return foundJsx;
}

function isInlineCallback({ parent }: CallbackFunction): boolean {
	return (
		parent.type === "CallExpression" ||
		parent.type === "JSXExpressionContainer" ||
		parent.type === "ArrayExpression"
	);
}

function getVariableDeclaratorFunctionName(node: ESTree.Node): string | undefined {
	if (node.parent?.type !== "VariableDeclarator" || node.parent.id.type !== "Identifier") return undefined;
	return node.parent.id.name;
}

function getBindingIdentifierName(binding: ESTree.BindingPattern): string | undefined {
	/* v8 ignore next -- @preserve destructured default callback declarations are ignored by this rule. */
	return binding.type === "Identifier" ? binding.name : undefined;
}

function ascendPastWrappers(node?: ESTree.Node): ESTree.Node | undefined {
	let current = node;
	/* v8 ignore next -- @preserve wrapper parents are optional parser shapes; property references do not require them. */
	while (current !== undefined && WRAPPER_PARENT_TYPES.has(current.type)) current = current.parent ?? undefined;
	return current;
}

function isPropertyValueReference(node: ESTree.Node): boolean {
	/* v8 ignore next -- @preserve scope reference identifiers always have parents in parser-produced ASTs. */
	const parent = ascendPastWrappers(node.parent ?? undefined);
	/* v8 ignore next -- @preserve scope references always have parents in parser-produced ASTs. */
	return parent?.type === "Property" && parent.value === node;
}

function getDeclaredFunctionVariable(sourceCode: SourceCode, node: CallbackFunction): ScopeVariable | undefined {
	if (node.type === "FunctionDeclaration") {
		const declared = sourceCode.getDeclaredVariables(node);
		/* v8 ignore next -- @preserve named function declarations always declare one function variable. */
		return declared.length > 0 ? declared[0] : undefined;
	}

	const { parent } = node;
	/* v8 ignore next -- @preserve non-declaration callbacks reach this helper only from variable declarators. */
	if (parent?.type !== "VariableDeclarator") return undefined;

	const declared = sourceCode.getDeclaredVariables(parent);
	/* v8 ignore next -- @preserve identifier variable declarators always declare one variable. */
	return declared.length > 0 ? declared[0] : undefined;
}

function isCallbackPropertyFunction(node: CallbackFunction, sourceCode: SourceCode): boolean {
	const variable = getDeclaredFunctionVariable(sourceCode, node);
	/* v8 ignore next -- @preserve callers only pass declarations that have declared variables. */
	if (variable === undefined) return false;

	let hasReadReference = false;

	for (const reference of variable.references) {
		if (reference.isWrite()) continue;

		hasReadReference = true;
		if (!isPropertyValueReference(reference.identifier)) return false;
	}

	return hasReadReference;
}

const noRenderHelperFunctions = defineRule({
	create(context): Visitor {
		let componentDepth = 0;

		function reportRenderHelper(node: ESTree.Node, functionName: string): void {
			context.report({
				data: { functionName },
				messageId: "noRenderHelper",
				node,
			});
		}

		function checkVariableFunctionExit(node: CallbackFunction): void {
			const { parent } = node;
			const functionName = getVariableDeclaratorFunctionName(node);

			if (functionName !== undefined && isUppercaseName(functionName)) {
				componentDepth -= 1;
				return;
			}

			if (componentDepth > 0 || isInlineCallback(node) || parent.type !== "VariableDeclarator") return;

			const variableName = getBindingIdentifierName(parent.id);
			if (variableName === undefined || isUppercaseName(variableName) || isHookName(variableName)) return;
			if (isCallbackPropertyFunction(node, context.sourceCode)) return;

			const typeAnnotation = getTypeAnnotationFromBinding(parent.id);
			const hasReactNodeAnnotation =
				typeAnnotation !== undefined && isReactNodeTypeAnnotation(typeAnnotation.typeAnnotation);

			const returnTypeAnnotation = getReturnTypeAnnotation(node);
			const hasReturnType = isReactNodeTypeAnnotation(returnTypeAnnotation);

			if (hasReactNodeAnnotation || hasReturnType || hasJsxReturn(node)) reportRenderHelper(parent, variableName);
		}

		return {
			ArrowFunctionExpression(node): void {
				const functionName = getVariableDeclaratorFunctionName(node);
				if (functionName !== undefined && isUppercaseName(functionName)) componentDepth += 1;
			},
			"ArrowFunctionExpression:exit": checkVariableFunctionExit,
			FunctionDeclaration({ id }): void {
				if (id === null) return;
				if (isUppercaseName(id.name)) componentDepth += 1;
			},
			"FunctionDeclaration:exit"(node): void {
				if (node.id === null) return;

				const functionName = node.id.name;
				if (isUppercaseName(functionName)) {
					componentDepth -= 1;
					return;
				}

				if (componentDepth > 0) return;
				if (isHookName(functionName)) return;
				if (isCallbackPropertyFunction(node, context.sourceCode)) return;

				const returnTypeAnnotation = getReturnTypeAnnotation(node);
				const hasReturnType = isReactNodeTypeAnnotation(returnTypeAnnotation);

				if (hasReturnType || hasJsxReturn(node)) reportRenderHelper(node, functionName);
			},
			FunctionExpression(node): void {
				const functionName = getVariableDeclaratorFunctionName(node);
				if (functionName !== undefined && isUppercaseName(functionName)) componentDepth += 1;
			},
			"FunctionExpression:exit": checkVariableFunctionExit,
		};
	},
	meta: {
		docs: {
			description: "Disallow non-component functions that return JSX or React elements.",
		},
		messages: {
			noRenderHelper:
				"Convert render helper '{{functionName}}' to a React component. Functions that return JSX should be PascalCase components, not camelCase helpers.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default noRenderHelperFunctions;
