import {
	ARRAY_EXPRESSION,
	CALL_EXPRESSION,
	isAssignmentExpression,
	isExpressionStatement,
	isIdentifier,
	isIdentifierNamed,
	isLiteral,
	isMemberExpression,
	isMethodDefinition,
	isSpreadElement,
	isThisExpression,
	LITERAL,
	MEMBER_EXPRESSION,
	OBJECT_EXPRESSION,
} from "@small-rules/oxlint-utilities";

import { pushMemberExpressionChildren } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function appendSimpleArrayElements(node: ESTree.ArrayExpression, worklist: Array<ESTree.Expression>): boolean {
	for (const element of node.elements) {
		/* v8 ignore next -- @preserve array holes are covered as literal-preserving elements. */
		if (element === null) continue;
		if (isSpreadElement(element)) return false;
		worklist.push(element);
	}

	return true;
}

function appendSimpleObjectProperties(node: ESTree.ObjectExpression, worklist: Array<ESTree.Expression>): boolean {
	for (const property of node.properties) {
		if (isSpreadElement(property) || property.computed) return false;
		worklist.push(property.value);
	}

	return true;
}

function appendSimpleCallChildren(node: ESTree.CallExpression, worklist: Array<ESTree.Expression>): boolean {
	if (!isMemberExpression(node.callee)) return false;
	worklist.push(node.callee);

	for (const argument of node.arguments) {
		worklist.push(isSpreadElement(argument) ? argument.argument : argument);
	}

	return true;
}

function appendSimpleLiteralChildren(node: ESTree.Expression, worklist: Array<ESTree.Expression>): boolean {
	switch (node.type) {
		case ARRAY_EXPRESSION:
			return appendSimpleArrayElements(node, worklist);

		case CALL_EXPRESSION:
			return appendSimpleCallChildren(node, worklist);

		case LITERAL:
			return true;

		// A computed key is part of the value, so it must be a literal too.
		case MEMBER_EXPRESSION: {
			pushMemberExpressionChildren(node, worklist);
			return true;
		}

		case OBJECT_EXPRESSION:
			return appendSimpleObjectProperties(node, worklist);

		default:
			return false;
	}
}

function isSimpleLiteral(node?: ESTree.Expression): boolean {
	/* v8 ignore next -- @preserve callers pass concrete expression nodes from parser properties. */
	if (node === undefined) return false;

	const worklist = [node];
	for (const current of worklist) {
		if (!appendSimpleLiteralChildren(current, worklist)) return false;
	}

	return true;
}

function isStaticMemberExpression(node: ESTree.MemberExpression): boolean {
	let current: ESTree.Expression = node;
	while (isMemberExpression(current)) {
		if (current.computed && !isLiteral(current.property)) return false;
		current = current.object;
	}

	return true;
}

function isConstructor(node: ESTree.ClassElement): node is ESTree.MethodDefinition {
	return isMethodDefinition(node) && node.kind === "constructor" && isIdentifierNamed(node.key, "constructor");
}

interface ConstructorLiteralAssignment extends ESTree.ExpressionStatement {
	readonly expression: ESTree.AssignmentExpression;
}

function isConstructorLiteralAssignment(statement: ESTree.Statement): statement is ConstructorLiteralAssignment {
	if (!isExpressionStatement(statement)) return false;

	const { expression } = statement;
	// `+=` and its kind read the old value, so only a plain `=` qualifies.
	if (!isAssignmentExpression(expression) || expression.operator !== "=") return false;

	const { left } = expression;
	if (!isMemberExpression(left) || !isThisExpression(left.object)) return false;

	const { property } = left;
	return (
		(isIdentifier(property) || isLiteral(property)) &&
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
			ClassDeclaration: reportConstructorAssignments,
			ClassExpression: reportConstructorAssignments,
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
