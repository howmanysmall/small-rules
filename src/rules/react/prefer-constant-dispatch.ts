import {
	IDENTIFIER,
	isAnyLiteral,
	isArrayPattern,
	isCallExpression,
	isIdentifier,
	isImportDeclaration,
	isMemberExpression,
	isObjectExpression,
	isProgram,
	isProperty,
	isSpreadElement,
	isVariableDeclaration,
	isVariableDeclarator,
	LITERAL,
	MEMBER_EXPRESSION,
	TEMPLATE_LITERAL,
	UNARY_EXPRESSION,
} from "@small-rules/oxlint-utilities";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isImportBinding, isModuleLevelScope } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, Fix, Fixer, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

function isModuleScopeConst(variable: ScopeVariable): boolean {
	if (!isModuleLevelScope(variable.scope)) return false;

	for (const definition of variable.defs) {
		if (definition.type !== "Variable") continue;

		const declarator = definition.node;
		/* v8 ignore next -- variable definitions are backed by VariableDeclarator nodes in parser scope data. @preserve */
		if (!isVariableDeclarator(declarator)) continue;

		const declaration = declarator.parent;
		if (isVariableDeclaration(declaration) && declaration.kind === "const") return true;
	}

	return false;
}

function resolvesToConstantIdentifier(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return false;

	return isImportBinding(variable) || isModuleScopeConst(variable);
}

function resolvesToModuleScopeBinding(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
	const variable = getVariableByName(sourceCode.getScope(identifier), identifier.name);
	if (variable === undefined) return false;

	return isImportBinding(variable) || isModuleLevelScope(variable.scope);
}

function isConstantMemberExpression(sourceCode: SourceCode, memberExpression: ESTree.MemberExpression): boolean {
	let current: ESTree.Expression = memberExpression;

	while (isMemberExpression(current)) {
		if (current.computed) return false;
		current = stripExpressionWrappers(current.object);
	}

	return isIdentifier(current) && resolvesToModuleScopeBinding(sourceCode, current);
}

function isConstantDispatchValue(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = stripExpressionWrappers(expression);

	switch (unwrapped.type) {
		case IDENTIFIER:
			return resolvesToConstantIdentifier(sourceCode, unwrapped);

		case LITERAL:
			return true;

		case MEMBER_EXPRESSION:
			return isConstantMemberExpression(sourceCode, unwrapped);

		case TEMPLATE_LITERAL:
			return unwrapped.expressions.length === 0;

		case UNARY_EXPRESSION:
			return unwrapped.operator === "-" && isAnyLiteral(stripExpressionWrappers(unwrapped.argument));

		default:
			return false;
	}
}

function shouldReportActionObject(sourceCode: SourceCode, objectExpression: ESTree.ObjectExpression): boolean {
	for (const property of objectExpression.properties) {
		if (!isProperty(property)) return false;
		if (property.kind !== "init" || property.computed) return false;
		if (!isConstantDispatchValue(sourceCode, property.value)) return false;
	}

	return true;
}

function getTrackedDispatchVariable(
	sourceCode: SourceCode,
	variableDeclarator: ESTree.VariableDeclarator,
): ScopeVariable | undefined {
	if (!isArrayPattern(variableDeclarator.id)) return undefined;
	if (!isCallExpression(variableDeclarator.init)) return undefined;
	if (getHookName(variableDeclarator.init) !== "useReducer") return undefined;

	// oxlint-disable-next-line prefer-destructuring -- ugly.
	const dispatchElement = variableDeclarator.id.elements[1];
	if (dispatchElement === undefined || dispatchElement === null) return undefined;
	if (!isIdentifier(dispatchElement)) return undefined;

	return getVariableByName(sourceCode.getScope(dispatchElement), dispatchElement.name);
}

function getProgram(node: ESTree.Node): ESTree.Program | undefined {
	let current: ESTree.Node | undefined = node;

	// oxlint-disable-next-line typescript/no-unnecessary-condition -- conflicting lint
	while (current !== undefined) {
		if (isProgram(current)) return current;
		current = current.parent;
	}

	/* v8 ignore next -- reported action objects are always attached to a Program through parser parents. @preserve */
	return undefined;
}

function getDeclarationInsertionFix(
	fixer: Fixer,
	sourceCode: SourceCode,
	actionObject: ESTree.ObjectExpression,
	constantName: string,
	program: ESTree.Program,
): Fix {
	const declarationText = `const ${constantName} = ${sourceCode.getText(actionObject)};`;
	const { body } = program;

	let lastImport: ESTree.ImportDeclaration | undefined;
	for (const statement of body) {
		if (isImportDeclaration(statement)) {
			lastImport = statement;
			continue;
		}
		break;
	}

	if (lastImport !== undefined) return fixer.insertTextAfter(lastImport, `\n\n${declarationText}`);

	const [firstStatement] = body;
	/* v8 ignore next -- dispatch calls require an existing statement, so the Program body is non-empty. @preserve */
	if (firstStatement !== undefined) return fixer.insertTextBefore(firstStatement, `${declarationText}\n\n`);

	/* v8 ignore next -- dispatch calls require an existing statement, so the Program body is non-empty. @preserve */
	return fixer.insertTextAfterRange([program.range[0], program.range[1]], declarationText);
}

const preferConstantDispatch = createRule("prefer-constant-dispatch", "react", {
	create(context): Visitor {
		const trackedDispatchVariables = new Set<ScopeVariable>();
		const { sourceCode } = context;
		let suggestionCount = 0;

		return {
			CallExpression(node): void {
				if (!isIdentifier(node.callee)) return;

				const dispatchVariable = getVariableByName(sourceCode.getScope(node.callee), node.callee.name);
				if (dispatchVariable === undefined || !trackedDispatchVariables.has(dispatchVariable)) return;

				const [firstArgument] = node.arguments;
				if (firstArgument === undefined || isSpreadElement(firstArgument)) return;

				const actionObject = stripExpressionWrappers(firstArgument);
				if (!isObjectExpression(actionObject) || !shouldReportActionObject(sourceCode, actionObject)) return;

				const program = getProgram(actionObject);
				/* v8 ignore next -- action objects are visited only after parser parent links are established. @preserve */
				if (program === undefined) return;

				const constantName = `PREFER_CONSTANT_ACTION_${suggestionCount}`;
				suggestionCount += 1;

				context.report({
					messageId: "preferConstantDispatch",
					node: actionObject,
					suggest: [
						{
							desc: `Extract to module constant \`${constantName}\``,
							fix(fixer): Array<Fix> {
								return [
									getDeclarationInsertionFix(fixer, sourceCode, actionObject, constantName, program),
									fixer.replaceText(actionObject, constantName),
								];
							},
						},
					],
				});
			},
			VariableDeclarator(node): void {
				const dispatchVariable = getTrackedDispatchVariable(sourceCode, node);
				if (dispatchVariable !== undefined) trackedDispatchVariables.add(dispatchVariable);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow inline useReducer action objects that could be module-level constants.",
			recommended: true,
		},
		hasSuggestions: true,
		messages: {
			preferConstantDispatch: "Move this inline useReducer action object to a module-level constant.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferConstantDispatch;
