import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function toGenericArrayType(typeNode: ESTree.TSType, sourceCode: SourceCode): string {
	if (typeNode.type === "TSParenthesizedType") return toGenericArrayType(typeNode.typeAnnotation, sourceCode);

	if (typeNode.type === "TSArrayType") {
		const elementText = toGenericArrayType(typeNode.elementType, sourceCode);
		return `Array<${elementText}>`;
	}

	if (
		typeNode.type === "TSTypeOperator" &&
		typeNode.operator === "readonly" &&
		typeNode.typeAnnotation.type === "TSArrayType"
	) {
		const elementText = toGenericArrayType(typeNode.typeAnnotation.elementType, sourceCode);
		return `ReadonlyArray<${elementText}>`;
	}

	return sourceCode.getText(typeNode);
}

function isTopLevelArrayType({ parent }: ESTree.TSType): boolean {
	const meaningfulParent = parent.type === "TSParenthesizedType" ? parent.parent : parent;
	return !(
		(meaningfulParent.type === "TSRestType" && meaningfulParent.parent.type === "TSTupleType") ||
		meaningfulParent.type === "TSTupleType" ||
		meaningfulParent.type === "TSArrayType" ||
		(meaningfulParent.type === "TSTypeOperator" && meaningfulParent.operator === "readonly")
	);
}

const arrayTypeGeneric = defineRule({
	createOnce(context): Visitor {
		function reportArrayType(node: ESTree.TSArrayType | ESTree.TSTypeOperator): void {
			context.report({
				fix(fixer) {
					return fixer.replaceText(node, toGenericArrayType(node, context.sourceCode));
				},
				messageId: "useGenericArrayType",
				node,
			});
		}

		return {
			TSArrayType(node): void {
				if (isTopLevelArrayType(node)) reportArrayType(node);
			},
			TSTypeOperator(node): void {
				if (node.operator !== "readonly" || node.typeAnnotation.type !== "TSArrayType") return;
				if (isTopLevelArrayType(node)) reportArrayType(node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow bracket array type syntax and require Array<T> / ReadonlyArray<T>.",
		},
		fixable: "code",
		messages: {
			useGenericArrayType:
				"Bracket array type syntax is not allowed. Use Array<T> or ReadonlyArray<T> generic syntax.",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default arrayTypeGeneric;
