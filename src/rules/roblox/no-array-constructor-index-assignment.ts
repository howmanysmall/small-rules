import { forEachNode, hasShadowedBinding, STOP_NODE_TRAVERSAL } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	isAssignmentExpression,
	isBindingIdentifier,
	isExpressionStatement,
	isIdentifierNamed,
	isMemberExpression,
	isNewExpression,
	isNumericLiteral,
	isVariableDeclaration,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";

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

function containsArrayReference(node: ESTree.Node, arrayIdentifierName: string): boolean {
	let containsReference = false;
	forEachNode(node, (current) => {
		if (isIdentifierNamed(current, arrayIdentifierName)) {
			containsReference = true;
			return STOP_NODE_TRAVERSAL;
		}
		return true;
	});
	return containsReference;
}

function isGlobalArrayConstructor(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
	const callee = unwrapExpression(node.callee);
	if (!isIdentifierNamed(callee, "Array")) return false;
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
	if (!isMemberExpression(left) || !left.computed) return undefined;

	const { object, property } = left;
	if (!isIdentifierNamed(object, arrayIdentifierName)) return undefined;
	if (!isNumericLiteral(property) || property.value !== expectedIndex) return undefined;

	return { expression, statement };
}

function isEmptyArrayInitializer(
	init: ESTree.VariableDeclarator["init"],
	sourceCode: SourceCode,
): init is ESTree.NewExpression {
	if (!isNewExpression(init) || init.arguments.length > 0) return false;
	return isGlobalArrayConstructor(sourceCode, init);
}

interface SingleDeclarator {
	readonly declaration: ESTree.VariableDeclaration;
	readonly declarator: ESTree.VariableDeclarator;
}

function getSingleDeclarator(statements: ReadonlyArray<ProgramStatement>, index: number): SingleDeclarator | undefined {
	const declaration = statements[index];
	if (declaration === undefined || !isVariableDeclaration(declaration) || declaration.declarations.length !== 1) {
		return undefined;
	}

	const [declarator] = declaration.declarations;
	/* v8 ignore next -- guarded by declarations.length === 1; undefined is a parser invariant. @preserve */
	if (declarator === undefined || !isVariableDeclarator(declarator) || declarator.init === null) {
		return undefined;
	}

	return { declaration, declarator };
}

function collectSequentialAssignments(
	statements: ReadonlyArray<ProgramStatement>,
	startIndex: number,
	arrayIdentifierName: string,
): Array<FoundAssignment> {
	const foundAssignments = new Array<FoundAssignment>();
	let scanIndex = startIndex;
	let expectedIndex = 0;

	while (scanIndex < statements.length) {
		const statement = statements[scanIndex];
		/* v8 ignore next -- scanIndex is bounded by statements.length. @preserve */
		if (statement === undefined) break;

		if (collectNextAssignment(statements, scanIndex, arrayIdentifierName, expectedIndex, foundAssignments)) {
			expectedIndex += 1;
			scanIndex += 1;
			continue;
		}

		if (containsArrayReference(statement, arrayIdentifierName)) break;

		scanIndex += 1;
	}

	return foundAssignments;
}

function collectNextAssignment(
	statements: ReadonlyArray<ProgramStatement>,
	scanIndex: number,
	arrayIdentifierName: string,
	expectedIndex: number,
	foundAssignments: Array<FoundAssignment>,
): boolean {
	const statement = statements[scanIndex];
	/* v8 ignore next -- scanIndex is always below statements.length from the scanning loop. @preserve */
	if (statement === undefined) return false;

	const assignment = getArrayIndexAssignment(statement, arrayIdentifierName, expectedIndex);
	if (assignment === undefined) return false;

	foundAssignments.push(assignment);
	return true;
}

function getCandidate(
	sourceCode: SourceCode,
	statements: ReadonlyArray<ProgramStatement>,
	index: number,
): Candidate | undefined {
	const header = getSingleDeclarator(statements, index);
	if (header === undefined) return undefined;

	const { declaration, declarator } = header;
	if (!isEmptyArrayInitializer(declarator.init, sourceCode)) return undefined;
	if (!isBindingIdentifier(declarator.id)) return undefined;

	const arrayIdentifierName = declarator.id.name;

	const foundAssignments = collectSequentialAssignments(statements, index + 1, arrayIdentifierName);

	if (foundAssignments.length === 0) return undefined;

	const [firstFound] = foundAssignments;
	const lastFound = foundAssignments.at(-1);
	/* v8 ignore next -- foundAssignments.length > 0 guarantees both ends exist. @preserve */
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

function buildNewDeclarationText(declarationText: string, initText: string, literalText: string): string {
	const initOffset = declarationText.indexOf(initText);
	/* v8 ignore next -- source text for an initializer must be inside its own declaration. @preserve */
	if (initOffset === -1) return declarationText;

	return `${declarationText.slice(0, initOffset)}${literalText}${declarationText.slice(initOffset + initText.length)}`;
}

function computeMoveStart(declarationStart: number, sourceCode: SourceCode): number {
	if (declarationStart <= 0) return declarationStart;
	return sourceCode.text[declarationStart - 1] === "\n" ? declarationStart - 1 : declarationStart;
}

function stripLeadingNewline(moveStart: number, declarationStart: number, textAfterDeclaration: string): string {
	if (moveStart === declarationStart && textAfterDeclaration.startsWith("\n")) return textAfterDeclaration.slice(1);
	return textAfterDeclaration;
}

function createMovedDeclarationFix(
	fixer: Fixer,
	sourceCode: SourceCode,
	{ declaration, declarator, lastAssignmentStatement }: Candidate,
	literalText: string,
	textBetween: string,
): ReturnType<Fixer["replaceTextRange"]> {
	const { init } = declarator;
	const [declarationStart] = declaration.range;
	const [, lastAssignmentEnd] = lastAssignmentStatement.range;

	const moveStart = computeMoveStart(declarationStart, sourceCode);
	const adjustedTextBetween = stripLeadingNewline(moveStart, declarationStart, textBetween);
	const declarationText = sourceCode.getText(declaration);
	/* v8 ignore next -- candidates are only created from declarators with an initializer. @preserve */
	const initText = init === null ? "" : sourceCode.getText(init);
	const newDeclarationText = buildNewDeclarationText(declarationText, initText, literalText);

	return fixer.replaceTextRange([moveStart, lastAssignmentEnd], `${adjustedTextBetween}${newDeclarationText}`);
}

function computeRemoveStart(sourceCode: SourceCode, candidate: Candidate): number {
	const [, declarationEnd] = candidate.declaration.range;
	const [firstAssignmentStart] = candidate.firstAssignmentStatement.range;

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

	return removeStart;
}

function createFix(
	fixer: Fixer,
	sourceCode: SourceCode,
	{ assignments, declaration, declarator, firstAssignmentStatement, lastAssignmentStatement }: Candidate,
): Array<ReturnType<Fixer["removeRange"] | Fixer["replaceText"]>> {
	const { init } = declarator;
	/* v8 ignore next -- candidates are only created from declarators with an initializer. @preserve */
	if (init === null) return [];

	const literalText = `[${assignments.map((assignment) => assignment.valueText).join(", ")}]`;
	const fixes: Array<ReturnType<Fixer["removeRange"] | Fixer["replaceText"]>> = [
		fixer.replaceText(init, literalText),
	];

	const [, declarationEnd] = declaration.range;
	const [firstAssignmentStart] = firstAssignmentStatement.range;
	const [, lastAssignmentEnd] = lastAssignmentStatement.range;

	const textBetween = sourceCode.text.slice(declarationEnd, firstAssignmentStart);
	if (textBetween.trim().length > 0) {
		const candidate = { assignments, declaration, declarator, firstAssignmentStatement, lastAssignmentStatement };
		return [createMovedDeclarationFix(fixer, sourceCode, candidate, literalText, textBetween)];
	}

	const candidate = { assignments, declaration, declarator, firstAssignmentStatement, lastAssignmentStatement };
	const removeStart = computeRemoveStart(sourceCode, candidate);

	fixes.push(fixer.removeRange([removeStart, lastAssignmentEnd]));

	return fixes;
}

const noArrayConstructorIndexAssignment = createRule("no-array-constructor-index-assignment", "roblox", {
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

		function onNode(node: ESTree.BlockStatement | ESTree.Program): void {
			inspect(node.body);
		}

		return {
			BlockStatement: onNode,
			Program: onNode,
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
