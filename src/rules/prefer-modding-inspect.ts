import { getTypeAnnotationFromBinding } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { Fix, Visitor } from "oxlint-plugin-utilities";

const RECORD_TYPE_NAMES = new Set(["ReadonlyRecord", "Record"]);

const preferModdingInspect = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			VariableDeclarator(node): void {
				if (node.id.type !== "Identifier") return;
				if (node.init === undefined || node.init === null) return;
				const idName = node.id.name;

				const bindingAnnotation = getTypeAnnotationFromBinding(node.id);
				if (!bindingAnnotation) return;

				const typeRef = bindingAnnotation.typeAnnotation;
				if (typeRef.type !== "TSTypeReference") return;
				if (typeRef.typeName.type !== "Identifier") return;
				if (!RECORD_TYPE_NAMES.has(typeRef.typeName.name)) return;

				if (typeRef.typeArguments === undefined || typeRef.typeArguments === null) return;
				const { typeArguments } = typeRef;
				if (typeArguments.params.length !== 2) return;

				// biome-ignore lint/nursery/useDestructuring: produces ugly
				const secondParameter = typeArguments.params[1];
				if (secondParameter === undefined) return;
				if (secondParameter.type !== "TSLiteralType") return;
				if (secondParameter.literal.type !== "Literal" || secondParameter.literal.value !== true) return;

				if (node.init.type !== "ObjectExpression") return;

				const { properties } = node.init;
				for (const property of properties) {
					if (property.type !== "Property") return;
					if (property.value.type !== "Literal" || property.value.value !== true) return;
				}

				const enumTypeText = sourceCode.getText(typeArguments.params[0]);

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
