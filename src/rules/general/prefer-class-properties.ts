import { createRule } from "$oxc-utilities/create-rule";
import { isLiteral } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function appendSimpleArrayElements(node: ESTree.ArrayExpression, worklist: Array<ESTree.Expression>): boolean {
	for (const element of node.elements) {
		/* v8 ignore next -- @preserve array holes are covered as literal-preserving elements. */
		if (element === null) continue;
		if (element.type === "SpreadElement") return false;
		worklist.push(element);
	}
	return true;
}

function appendSimpleObjectProperties(node: ESTree.ObjectExpression, worklist: Array<ESTree.Expression>): boolean {
	for (const property of node.properties) {
		if (property.type === "SpreadElement" || property.computed) return false;
		worklist.push(property.value);
	}
	return true;
}

function appendSimpleLiteralChildren(node: ESTree.Expression, worklist: Array<ESTree.Expression>): boolean {
	switch (node.type) {
		case "ArrayExpression": {
			return appendSimpleArrayElements(node, worklist);
		}

		case "CallExpression": {
			if (node.callee.type !== "MemberExpression") return false;
			worklist.push(node.callee.object);
			return true;
		}

		case "Literal": {
			return true;
		}

		case "MemberExpression": {
			worklist.push(node.object);
			return true;
		}

		case "ObjectExpression": {
			return appendSimpleObjectProperties(node, worklist);
		}

		default: {
			return false;
		}
	}
}

function isSimpleLiteral(node: ESTree.Expression | undefined): boolean {
	/* v8 ignore next -- @preserve callers pass concrete expression nodes from parser properties. */
	if (node === undefined) return false;

	const worklist: Array<ESTree.Expression> = [node];
	let index = 0;
	while (index < worklist.length) {
		const current = worklist[index];
		/* v8 ignore next -- @preserve the index is bounded by the worklist length. */
		if (current === undefined) return false;
		index += 1;
		if (!appendSimpleLiteralChildren(current, worklist)) return false;
	}

	return true;
}

function isStaticMemberExpression(node: ESTree.MemberExpression): boolean {
	let current: ESTree.Expression = node;
	while (current.type === "MemberExpression") {
		if (current.computed && !isLiteral(current.property)) return false;
		current = current.object;
	}
	return true;
}

function isConstructor(node: ESTree.ClassElement): node is ESTree.MethodDefinition {
	return (
		node.type === "MethodDefinition" &&
		node.kind === "constructor" &&
		node.key.type === "Identifier" &&
		node.key.name === "constructor"
	);
}

function isConstructorLiteralAssignment(statement: ESTree.Statement): statement is ESTree.ExpressionStatement & {
	readonly expression: ESTree.AssignmentExpression;
} {
	if (statement.type !== "ExpressionStatement") return false;

	const { expression } = statement;
	if (expression.type !== "AssignmentExpression") return false;

	const { left } = expression;
	if (left.type !== "MemberExpression" || left.object.type !== "ThisExpression") return false;

	const { property } = left;
	return (
		(property.type === "Identifier" || isLiteral(property)) &&
		isSimpleLiteral(expression.right) &&
		isStaticMemberExpression(left)
	);
}

const preferClassProperties = createRule("prefer-class-properties", "general", {
	create(context): Visitor {
		const [mode] = context.options;

		if (mode === "never") {
			return {
				PropertyDefinition(node): void {
					if (node.static) return;

					context.report({
						messageId: "unexpectedClassProperty",
						node,
					});
				},
			} satisfies Visitor;
		}

		function reportConstructorAssignments(node: ESTree.Class): void {
			for (const member of node.body.body) {
				if (!isConstructor(member) || member.value.body === null) continue;

				for (const statement of member.value.body.body) {
					if (isConstructorLiteralAssignment(statement)) {
						context.report({
							messageId: "unexpectedAssignment",
							node: statement.expression,
						});
					}
				}
			}
		}

		return {
			ClassDeclaration(node): void {
				reportConstructorAssignments(node);
			},
			ClassExpression(node): void {
				reportConstructorAssignments(node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer class properties to assignment of literals in constructors.",
		},
		messages: {
			unexpectedAssignment:
				"Constructor assigns a literal value to this.property. Literals are static and known at class definition time. Move to a class property declaration: propertyName = value; at class level. This clarifies intent and reduces constructor complexity.",
			unexpectedClassProperty:
				"Class property declarations are disabled by rule configuration (mode: 'never'). Move initialization into the constructor: this.propertyName = value; inside constructor().",
		},
		schema: [
			{
				enum: ["always", "never"],
				type: "string",
			},
		],
		type: "suggestion",
	},
});

export default preferClassProperties;
