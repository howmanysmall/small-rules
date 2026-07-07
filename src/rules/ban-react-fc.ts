import { isTsTypeAnnotation } from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const BANNED_FC_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);

function getBannedTypeName(typeName: ESTree.Node): string | undefined {
	if (typeName.type === "Identifier" && BANNED_FC_NAMES.has(typeName.name)) return typeName.name;
	if (typeName.type === "TSQualifiedName" && BANNED_FC_NAMES.has(typeName.right.name)) return typeName.right.name;
	return undefined;
}

function getTypeAnnotationFromId(node: ESTree.VariableDeclarator): ESTree.TSTypeAnnotation | undefined {
	const { typeAnnotation } = node.id;
	return isTsTypeAnnotation(typeAnnotation) ? typeAnnotation : undefined;
}

const banReactFc = defineRule({
	createOnce(context): Visitor {
		return {
			VariableDeclarator(node): void {
				const typeAnnotation = getTypeAnnotationFromId(node);
				if (typeAnnotation === undefined) return;

				const inner = typeAnnotation.typeAnnotation;
				if (
					inner.type !== "TSTypeReference" ||
					getBannedTypeName(inner.typeName) === undefined ||
					node.init?.type !== "ArrowFunctionExpression"
				) {
					return;
				}

				context.report({
					messageId: "banReactFC",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Ban React.FC and similar component type annotations. Use explicit function declarations instead.",
		},
		messages: {
			banReactFC:
				"Avoid React.FC/FunctionComponent/VFC/VoidFunctionComponent types. They break debug information and profiling. Use explicit function declarations instead: `function Component(props: Props) { ... }`",
		},
		schema: [] as const,
		type: "problem",
	},
});

export default banReactFc;
