import { hasShadowedBinding, unwrapExpression } from "$oxc-utilities/ast-utilities";
import {
	isAssignmentExpression,
	isExpressionStatement,
	isMemberExpression,
	isNewExpression,
	isNumericLiteral,
	isVariableDeclaration,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Fixer, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ProgramStatement = ESTree.ModuleDeclaration | ESTree.Statement;

interface FoundAssignment {
	readonly expression: ESTree.AssignmentExpression;
	readonly statement: ESTree.ExpressionStatement;
}

interface IndexAssignment {
	readonly statement: ESTree.ExpressionStatement;
	readonly valueText: string;
}

interface Candidate {
	readonly assignments: ReadonlyArray<IndexAssignment>;
	readonly declaration: ESTree.VariableDeclaration;
	readonly declarator: ESTree.VariableDeclarator;
	readonly firstAssignmentStatement: ESTree.ExpressionStatement;
	readonly lastAssignmentStatement: ESTree.ExpressionStatement;
}

const VISITOR_KEYS_TO_SKIP = new Set(["parent", "range", "loc", "tokens", "comments"]);

function isIdentifierReference(node: ESTree.Node): node is ESTree.IdentifierReference {
	return node.type === "Identifier";
}

function isBindingIdentifier(node: ESTree.Node): node is ESTree.BindingIdentifier {
	return node.type === "Identifier";
}

function isNode(value: object): value is ESTree.Node {
	return "type" in value && typeof value.type === "string";
}

function pushNodeChildren(node: ESTree.Node, stack: Array<unknown>): void {
	for (const key of Object.keys(node)) {
		if (VISITOR_KEYS_TO_SKIP.has(key)) continue;
		const value: unknown = Reflect.get(node, key);
		if (value !== null && value !== undefined) {
			stack.push(value);
		}
	}
}

function containsArrayReference(node: ESTree.Node, arrayIdentifierName: string): boolean {
	const stack: Array<unknown> = [node];

	while (stack.length > 0) {
		const current = stack.pop();
		if (current === undefined || current === null || typeof current !== "object") continue;

		if (Array.isArray(current)) {
			for (const child of current) {
				stack.push(child);
			}

			continue;
		}

		if (!isNode(current)) continue;
		if (current.type === "Identifier" && current.name === arrayIdentifierName) return true;
		pushNodeChildren(current, stack);
	}

	return false;
}

function isGlobalArrayConstructor(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
	const callee = unwrapExpression(node.callee);
	if (!isIdentifierReference(callee) || callee.name !== "Array") return false;
	return !hasShadowedBinding(sourceCode, callee, "Array");
}

function getArrayIndexAssignment(
	statement: ProgramStatement,
	arrayIdentifierName: string,
	expectedIndex: number,
): FoundAssignment | undefined {
	if (!isExpressionStatement(statement)) return undefined;

	const { expression } = statement;
	if (!isAssignmentExpression(expression) || expression.operator !== "=") return undefined;

	const { left } = expression;
	if (!isMemberExpression(left) || left.optional || !left.computed) return undefined;

	const { object, property } = left;
	if (!isIdentifierReference(object) || object.name !== arrayIdentifierName) return undefined;
	if (!isNumericLiteral(property) || property.value !== expectedIndex) return undefined;

	return { expression, statement };
}

function getCandidate(
	sourceCode: SourceCode,
	statements: ReadonlyArray<ProgramStatement>,
	index: number,
): Candidate | undefined {
	const declaration = statements[index];
	if (declaration === undefined || !isVariableDeclaration(declaration) || declaration.declarations.length !== 1) {
		return undefined;
	}

	const [declarator] = declaration.declarations;
	if (declarator === undefined || !isVariableDeclarator(declarator) || declarator.init === null) {
		return undefined;
	}

	const { init } = declarator;
	if (!isNewExpression(init) || init.arguments.length > 0 || !isGlobalArrayConstructor(sourceCode, init)) {
		return undefined;
	}

	if (!isBindingIdentifier(declarator.id)) return undefined;
	const arrayIdentifierName = declarator.id.name;

	const foundAssignments = new Array<FoundAssignment>();
	let scanIndex = index + 1;
	let expectedIndex = 0;

	while (scanIndex < statements.length) {
		const statement = statements[scanIndex];
		if (statement === undefined) break;

		const assignment = getArrayIndexAssignment(statement, arrayIdentifierName, expectedIndex);
		if (assignment !== undefined) {
			foundAssignments.push(assignment);
			expectedIndex += 1;
			scanIndex += 1;
			continue;
		}

		if (containsArrayReference(statement, arrayIdentifierName)) break;

		scanIndex += 1;
	}

	if (foundAssignments.length === 0) return undefined;

	const [firstFound] = foundAssignments;
	const lastFound = foundAssignments.at(-1);
	if (firstFound === undefined || lastFound === undefined) return undefined;

	return {
		assignments: foundAssignments.map((found) => ({
			statement: found.statement,
			valueText: sourceCode.getText(found.expression.right),
		})),
		declaration,
		declarator,
		firstAssignmentStatement: firstFound.statement,
		lastAssignmentStatement: lastFound.statement,
	};
}

function createFix(
	fixer: Fixer,
	sourceCode: SourceCode,
	candidate: Candidate,
): Array<ReturnType<Fixer["replaceText"] | Fixer["removeRange"]>> {
	const { declaration, declarator, assignments, firstAssignmentStatement, lastAssignmentStatement } = candidate;
	const { init } = declarator;
	if (init === null) return [];

	const literalText = `[${assignments.map((assignment) => assignment.valueText).join(", ")}]`;
	const fixes: Array<ReturnType<Fixer["replaceText"] | Fixer["removeRange"]>> = [
		fixer.replaceText(init, literalText),
	];

	const [declarationStart] = declaration.range;
	const [, declarationEnd] = declaration.range;
	const [firstAssignmentStart] = firstAssignmentStatement.range;
	const [, lastAssignmentEnd] = lastAssignmentStatement.range;

	const textBetween = sourceCode.text.slice(declarationEnd, firstAssignmentStart);
	if (textBetween.trim().length > 0) {
		let moveStart = declarationStart;
		if (moveStart > 0 && sourceCode.text[moveStart - 1] === "\n") {
			moveStart -= 1;
		}

		let textAfterDeclaration = textBetween;
		if (moveStart === declarationStart && textAfterDeclaration.startsWith("\n")) {
			textAfterDeclaration = textAfterDeclaration.slice(1);
		}

		const declarationText = sourceCode.getText(declaration);
		const initText = sourceCode.getText(init);
		const initOffset = declarationText.indexOf(initText);
		const newDeclarationText =
			initOffset === -1
				? declarationText
				: `${declarationText.slice(0, initOffset)}${literalText}${declarationText.slice(initOffset + initText.length)}`;

		return [fixer.replaceTextRange([moveStart, lastAssignmentEnd], `${textAfterDeclaration}${newDeclarationText}`)];
	}

	let removeStart = firstAssignmentStart;
	while (removeStart > declarationEnd) {
		const previousCharacter = sourceCode.text[removeStart - 1];
		if (previousCharacter === " " || previousCharacter === "\t") {
			removeStart -= 1;
			continue;
		}

		if (previousCharacter === "\n") removeStart -= 1;
		break;
	}

	fixes.push(fixer.removeRange([removeStart, lastAssignmentEnd]));

	return fixes;
}

const noArrayConstructorIndexAssignment = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		function inspect(statements: ReadonlyArray<ProgramStatement>): void {
			let index = 0;
			while (index < statements.length) {
				const candidate = getCandidate(sourceCode, statements, index);
				if (candidate === undefined) {
					index += 1;
					continue;
				}

				context.report({
					fix(fixer) {
						return createFix(fixer, sourceCode, candidate);
					},
					messageId: "preferArrayLiteral",
					node: candidate.declaration,
				});

				index = statements.indexOf(candidate.lastAssignmentStatement) + 1;
			}
		}

		return {
			BlockStatement(node): void {
				inspect(node.body);
			},
			Program(node): void {
				inspect(node.body);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow new Array<T>() followed by contiguous index assignments; use an array literal instead.",
		},
		fixable: "code",
		messages: {
			preferArrayLiteral: "Use an array literal instead of new Array<T>() followed by index assignments.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default noArrayConstructorIndexAssignment;
