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

import { getReferencedVariable, getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { resolvesToModuleBinding } from "$oxc-utilities/module-binding-resolution";
import { getRootExpression, stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { getHookName } from "$oxc-utilities/react-hook-utilities";
import { isModuleLevelScope } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, Fix, Fixer, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

const CONSTANT_NAME_PREFIX = "PREFER_CONSTANT_ACTION_";

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

function isConstantMemberExpression(sourceCode: SourceCode, memberExpression: ESTree.MemberExpression): boolean {
	let current: ESTree.Expression = memberExpression;

	while (isMemberExpression(current)) {
		if (current.computed) return false;
		current = stripExpressionWrappers(current.object);
	}

	return isIdentifier(current) && resolvesToModuleBinding(sourceCode, current);
}

function isConstantDispatchValue(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
	const unwrapped = stripExpressionWrappers(expression);

	switch (unwrapped.type) {
		case IDENTIFIER:
			return resolvesToModuleBinding(sourceCode, unwrapped, isModuleScopeConst);

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
		if (
			!isProperty(property) ||
			property.kind !== "init" ||
			property.computed ||
			!isConstantDispatchValue(sourceCode, property.value)
		) {
			return false;
		}
	}

	return true;
}

function getTrackedDispatchVariable(
	sourceCode: SourceCode,
	variableDeclarator: ESTree.VariableDeclarator,
): ScopeVariable | undefined {
	if (
		!isArrayPattern(variableDeclarator.id) ||
		!isCallExpression(variableDeclarator.init) ||
		getHookName(variableDeclarator.init) !== "useReducer"
	) {
		return undefined;
	}

	// oxlint-disable-next-line prefer-destructuring -- ugly.
	const dispatchElement = variableDeclarator.id.elements[1];
	if (dispatchElement === undefined || dispatchElement === null || !isIdentifier(dispatchElement)) return undefined;

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

/**
 * Collects where each module binding that the action object reads is declared.
 *
 * @param sourceCode - The source code of the current file.
 * @param actionObject - A reportable action object.
 * @returns The start offset of every definition node of those bindings.
 */
function getReferencedDefinitionStarts(sourceCode: SourceCode, actionObject: ESTree.ObjectExpression): Array<number> {
	const starts = new Array<number>();

	const properties = actionObject.properties.filter(isProperty);

	for (const property of properties) {
		const root = getRootExpression(property.value);
		const variable = isIdentifier(root) ? getReferencedVariable(sourceCode, root) : undefined;

		if (variable !== undefined) {
			for (const definition of variable.defs) {
				starts.push(definition.node.range[0]);
			}
		}
	}

	return starts;
}

/**
 * Finds the last top-level statement the new constant has to follow: the
 * leading imports and every statement declaring a binding the object reads.
 *
 * @param program - The program that owns the action object.
 * @param definitionStarts - Start offsets of the referenced definitions.
 * @returns The statement to insert after, or `undefined` when none applies.
 */
function getInsertionAnchor(
	program: ESTree.Program,
	definitionStarts: ReadonlyArray<number>,
): ESTree.Program["body"][number] | undefined {
	let anchor: ESTree.Program["body"][number] | undefined;
	let inLeadingImports = true;

	for (const statement of program.body) {
		inLeadingImports &&= isImportDeclaration(statement);
		if (inLeadingImports) {
			anchor = statement;
			continue;
		}

		const [start, end] = statement.range;
		for (const definitionStart of definitionStarts) {
			if (definitionStart >= start && definitionStart < end) {
				anchor = statement;
				break;
			}
		}
	}

	return anchor;
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

	const anchor = getInsertionAnchor(program, getReferencedDefinitionStarts(sourceCode, actionObject));
	if (anchor !== undefined) return fixer.insertTextAfter(anchor, `\n\n${declarationText}`);

	const [firstStatement] = body;
	/* v8 ignore next -- dispatch calls require an existing statement, so the Program body is non-empty. @preserve */
	if (firstStatement !== undefined) return fixer.insertTextBefore(firstStatement, `${declarationText}\n\n`);

	/* v8 ignore next -- dispatch calls require an existing statement, so the Program body is non-empty. @preserve */
	return fixer.insertTextAfterRange([program.range[0], program.range[1]], declarationText);
}

/**
 * Finds the first constant index, from `startIndex` on, whose name no binding
 * visible from `node` already uses, so a second suggestion never redeclares
 * or is captured by an existing name.
 *
 * @param sourceCode - The source code of the current file.
 * @param node - The action object the constant replaces.
 * @param startIndex - The first index to try.
 * @returns An index whose constant name is unbound.
 */
function getUnboundConstantIndex(sourceCode: SourceCode, node: ESTree.Node, startIndex: number): number {
	const scope = sourceCode.getScope(node);
	let index = startIndex;

	while (getVariableByName(scope, `${CONSTANT_NAME_PREFIX}${index}`) !== undefined) {
		index += 1;
	}

	return index;
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

				const constantIndex = getUnboundConstantIndex(sourceCode, actionObject, suggestionCount);
				const constantName = `${CONSTANT_NAME_PREFIX}${constantIndex}`;
				suggestionCount = constantIndex + 1;

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
				if (dispatchVariable !== undefined) {
					trackedDispatchVariables.add(dispatchVariable);
				}
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
