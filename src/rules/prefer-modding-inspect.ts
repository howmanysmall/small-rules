import { getTypeAnnotationFromBinding } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Fix, Visitor } from "oxlint-plugin-utilities";

const RECORD_TYPE_NAMES = new Set(["ReadonlyRecord", "Record"]);

function isRecordTypeReference(typeRef: ESTree.TSType): typeRef is ESTree.TSTypeReference {
	return (
		typeRef.type === "TSTypeReference" &&
		typeRef.typeName.type === "Identifier" &&
		RECORD_TYPE_NAMES.has(typeRef.typeName.name)
	);
}

function getRecordEnumTypeParameter(node: ESTree.VariableDeclarator): ESTree.TSType | undefined {
	if (node.id.type !== "Identifier") return undefined;

	const bindingAnnotation = getTypeAnnotationFromBinding(node.id);
	if (bindingAnnotation === undefined) return undefined;

	const { typeAnnotation: typeRef } = bindingAnnotation;
	if (!isRecordTypeReference(typeRef)) return undefined;

	const { typeArguments } = typeRef;
	if (typeArguments?.params.length !== 2) return undefined;

	const [enumType, secondParameter] = typeArguments.params;
	if (enumType === undefined || secondParameter === undefined) return undefined;
	if (secondParameter.type !== "TSLiteralType") return undefined;
	if (secondParameter.literal.type !== "Literal" || secondParameter.literal.value !== true) return undefined;

	return enumType;
}

function isTrueObjectExpression(node: ESTree.Expression | null | undefined): boolean {
	if (node?.type !== "ObjectExpression") return false;

	for (const property of node.properties) {
		if (property.type !== "Property") return false;
		if (property.value.type !== "Literal" || property.value.value !== true) return false;
	}

	return true;
}

const preferModdingInspect = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			VariableDeclarator(node): void {
				if (node.id.type !== "Identifier") return;
				const idName = node.id.name;
				if (!isTrueObjectExpression(node.init)) return;

				const enumType = getRecordEnumTypeParameter(node);
				if (enumType === undefined) return;

				const enumTypeText = sourceCode.getText(enumType);

				context.report({
					data: { enumType: enumTypeText },
					fix(fixer): Fix {
						return fixer.replaceTextRange(
							[node.range[0], node.range[1]],
							`${idName} = Modding.inspect<Record<${enumTypeText}, true>>()`,
						);
					},
					messageId: "preferModdingInspect",
					node: node.id,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer Modding.inspect over manually enumerating every enum member in a Record<Enum, true>.",
			recommended: true,
		},
		fixable: "code",
		messages: {
			preferModdingInspect:
				"Replace manual {{enumType}} enumeration with Modding.inspect<Record<{{enumType}}, true>>().",
		},
		schema: [],
		type: "suggestion",
	},
});

export default preferModdingInspect;
