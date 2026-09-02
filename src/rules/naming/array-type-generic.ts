import { createRule } from "$oxc-utilities/create-rule";
import {
	isTsArrayType,
	isTsParenthesizedType,
	isTsRestType,
	isTsTupleType,
	isTsTypeOperator,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

function toGenericArrayType(typeNode: ESTree.TSType, sourceCode: SourceCode): string {
	const arrayTypeNames = new Array<string>();
	let size = 0;
	let currentType = typeNode;

	while (true) {
		if (isTsParenthesizedType(currentType)) {
			currentType = currentType.typeAnnotation;
			continue;
		}

		if (isTsArrayType(currentType)) {
			arrayTypeNames[size++] = "Array";
			currentType = currentType.elementType;
			continue;
		}

		if (
			isTsTypeOperator(currentType) &&
			currentType.operator === "readonly" &&
			isTsArrayType(currentType.typeAnnotation)
		) {
			arrayTypeNames[size++] = "ReadonlyArray";
			currentType = currentType.typeAnnotation.elementType;
			continue;
		}

		let typeText = sourceCode.getText(currentType);
		for (let index = arrayTypeNames.length - 1; index >= 0; index -= 1) {
			typeText = `${arrayTypeNames[index]}<${typeText}>`;
		}
		return typeText;
	}
}

function isTopLevelArrayType({ parent }: ESTree.TSType): boolean {
	const meaningfulParent = isTsParenthesizedType(parent) ? parent.parent : parent;
	return (
		(!isTsRestType(meaningfulParent) || !isTsTupleType(meaningfulParent.parent)) &&
		!isTsTupleType(meaningfulParent) &&
		!isTsArrayType(meaningfulParent) &&
		(!isTsTypeOperator(meaningfulParent) || meaningfulParent.operator !== "readonly")
	);
}

const arrayTypeGeneric = createRule("array-type-generic", "naming", {
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
				if (node.operator !== "readonly" || !isTsArrayType(node.typeAnnotation)) return;
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
