import {
	getTypeAnnotationFromBinding,
	isAnyLiteral,
	isIdentifier,
	isObjectExpression,
	isProperty,
	isTsLiteralType,
	isTsTypeReference,
	isTsUnionType,
} from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { stripParenthesizedType } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Fix, Visitor } from "oxlint-plugin-utilities";

const RECORD_TYPE_NAMES = new Set(["ReadonlyRecord", "Record"]);

function isRecordTypeReference(typeRef: ESTree.TSType): typeRef is ESTree.TSTypeReference {
	return isTsTypeReference(typeRef) && isIdentifier(typeRef.typeName) && RECORD_TYPE_NAMES.has(typeRef.typeName.name);
}

function getRecordEnumTypeParameter(node: ESTree.VariableDeclarator): ESTree.TSType | undefined {
	/* v8 ignore next -- @preserve VariableDeclarator visitor checks Identifier before calling this helper. */
	if (!isIdentifier(node.id)) return undefined;

	const bindingAnnotation = getTypeAnnotationFromBinding(node.id);
	if (bindingAnnotation === undefined) return undefined;

	const { typeAnnotation: typeRef } = bindingAnnotation;
	if (!isRecordTypeReference(typeRef)) return undefined;

	const { typeArguments } = typeRef;
	if (typeArguments?.params.length !== 2) return undefined;

	const [enumType, secondParameter] = typeArguments.params;
	/* v8 ignore next -- @preserve the length check above guarantees both Record parameters exist. @preserve */
	if (
		enumType === undefined ||
		secondParameter === undefined ||
		!isTsLiteralType(secondParameter) ||
		!isAnyLiteral(secondParameter.literal) ||
		secondParameter.literal.value !== true
	) {
		return undefined;
	}

	return enumType;
}

// Names that always stand for an open set of keys.
const OPEN_KEY_TYPE_NAMES = new Set(["PropertyKey"]);

/**
 * Whether the key type has a finite list of members that `Modding.inspect`
 * can enumerate. Anything else would lose the hand-written keys, so only a
 * literal, a plain type reference such as an enum, or a union of those counts.
 *
 * @param keyType - The first type argument of the `Record`.
 * @returns `true` for a literal, a plain type reference, or a union of those.
 */
function isClosedKeyType(keyType: ESTree.TSType): boolean {
	const unwrapped = stripParenthesizedType(keyType);
	if (isTsLiteralType(unwrapped)) return true;
	if (isTsUnionType(unwrapped)) return unwrapped.types.every(isClosedKeyType);

	return (
		isTsTypeReference(unwrapped) &&
		unwrapped.typeArguments === null &&
		(!isIdentifier(unwrapped.typeName) || !OPEN_KEY_TYPE_NAMES.has(unwrapped.typeName.name))
	);
}

function isTrueObjectExpression(node?: ESTree.Expression | null): boolean {
	if (!isObjectExpression(node)) return false;

	for (const property of node.properties) {
		if (!isProperty(property) || !isAnyLiteral(property.value) || property.value.value !== true) return false;
	}

	return true;
}

const preferModdingInspect = createRule("prefer-modding-inspect", "roblox", {
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			VariableDeclarator(node): void {
				if (!isIdentifier(node.id)) return;
				const idName = node.id.name;

				if (!isTrueObjectExpression(node.init)) return;

				const enumType = getRecordEnumTypeParameter(node);
				if (enumType === undefined) return;

				const enumTypeText = sourceCode.getText(enumType);
				const isFixWithheld = sourceCode.getCommentsInside(node).length > 0 || !isClosedKeyType(enumType);

				context.report({
					data: { enumType: enumTypeText },
					fix(fixer): Fix | undefined {
						if (isFixWithheld) return undefined;

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
