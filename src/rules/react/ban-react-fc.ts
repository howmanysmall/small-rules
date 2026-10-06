import {
	isArrowFunctionExpression,
	isIdentifier,
	isTsQualifiedName,
	isTsTypeAnnotationUnknown,
	isTsTypeReference,
} from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const BANNED_FC_NAMES = new Set(["FC", "FunctionComponent", "VFC", "VoidFunctionComponent"]);

function getBannedTypeName(typeName: ESTree.Node): string | undefined {
	if (isIdentifier(typeName) && BANNED_FC_NAMES.has(typeName.name)) return typeName.name;
	if (isTsQualifiedName(typeName) && BANNED_FC_NAMES.has(typeName.right.name)) return typeName.right.name;
	return undefined;
}

function getTypeAnnotationFromId(node: ESTree.VariableDeclarator): ESTree.TSTypeAnnotation | undefined {
	const { typeAnnotation } = node.id;
	return isTsTypeAnnotationUnknown(typeAnnotation) ? typeAnnotation : undefined;
}

const banReactFc = createRule("ban-react-fc", "react", {
	createOnce(context): Visitor {
		return {
			VariableDeclarator(node): void {
				const typeAnnotation = getTypeAnnotationFromId(node);
				if (typeAnnotation === undefined) return;

				const inner = typeAnnotation.typeAnnotation;
				if (
					!isTsTypeReference(inner) ||
					getBannedTypeName(inner.typeName) === undefined ||
					!isArrowFunctionExpression(node.init)
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
