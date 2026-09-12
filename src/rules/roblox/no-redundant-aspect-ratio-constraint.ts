import { readFileSync } from "node:fs";
import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	isAnyLiteral,
	isBlockStatement,
	isCallbackFunction,
	isFunctionDeclarationRaw,
	isIdentifierName,
	isImportDeclaration,
	isJsxAttribute,
	isJsxElement,
	isJsxExpressionContainer,
	isJsxFragment,
	isJsxIdentifier,
	isReturnStatement,
	isVariableDeclarator,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";
import { walkAst } from "$oxc-utilities/react-hook-utilities";
import { resolveRelativeImport } from "$oxc-utilities/resolve-import";
import { isImportBinding } from "$oxc-utilities/static-expression-utilities";

import type { ESTree, Scope, Variable, Visitor } from "oxlint-plugin-utilities";

const REDUNDANT_ELEMENT_NAME = "uiaspectratioconstraint";
const REDUNDANT_CONSTANT_NAME = "UI_ASPECT_RATIO_CONSTRAINT";

const KNOWN_COMPONENTS = new Set(["ButtonSpritesheet", "GenericSpritesheet", "LabelSpritesheet"]);

function getJSXElementName({ openingElement }: ESTree.JSXElement): string | undefined {
	const { name } = openingElement;
	return isJsxIdentifier(name) ? name.name : undefined;
}

function hasAspectRatioConstraintInSubtree(node: ESTree.Node): boolean {
	let found = false;
	walkAst(node, (child) => {
		if (found) return;
		if (isJsxElement(child) && getJSXElementName(child) === REDUNDANT_ELEMENT_NAME) found = true;
	});
	return found;
}

function getFunctionComponentName(node: ESTree.Node): string | undefined {
	if (isFunctionDeclarationRaw(node)) return node.id?.name;

	/* v8 ignore next -- @preserve only named declarations and assigned function expressions are inspected as components. */
	if (isCallbackFunction(node)) {
		const { parent } = node;
		/* v8 ignore next -- @preserve assigned function components have identifier variable declarator parents. */
		if (isVariableDeclarator(parent) && isIdentifierName(parent.id)) return parent.id.name;
	}

	/* v8 ignore next -- @preserve only named function declarations and assigned arrow functions can reach this helper. */
	return undefined;
}

function getArrowExpressionBody(node: ESTree.ArrowFunctionExpression): ESTree.Expression | undefined {
	return isBlockStatement(node.body) ? undefined : unwrapExpression(node.body);
}

function getImportSourceFromVariable(variable: Variable): string | undefined {
	for (const definition of variable.defs) {
		/* v8 ignore start -- @preserve imported component variables only carry import binding definitions here. */
		if (definition.type !== "ImportBinding") continue;
		/* v8 ignore stop -- @preserve */
		const { parent } = definition.node;
		/* v8 ignore start -- @preserve import binding definitions have ImportDeclaration parents. */
		if (isImportDeclaration(parent) && Predicate.isString(parent.source.value)) return parent.source.value;
		/* v8 ignore stop -- @preserve */
	}

	/* v8 ignore next -- @preserve imported component variables always have import binding definitions. */
	return undefined;
}

const importedFileCache = new Map<string, boolean>();

function importedFileHasConstraint(importSource: string, sourceFile: string): boolean {
	if (!importSource.startsWith(".")) return false;

	const resolved = resolveRelativeImport(importSource, sourceFile);
	if (!resolved.found) return false;

	const cached = importedFileCache.get(resolved.path);
	if (cached !== undefined) return cached;

	try {
		const text = readFileSync(resolved.path, "utf8");
		const hasConstraint = text.includes("<uiaspectratioconstraint");
		importedFileCache.set(resolved.path, hasConstraint);
		return hasConstraint;
	} catch {
		/* v8 ignore start -- @preserve resolved project files are readable during lint runs. */
		importedFileCache.set(resolved.path, false);
		return false;
		/* v8 ignore stop -- @preserve */
	}
}

function hasScaledFalseAttribute(node: ESTree.JSXElement): boolean {
	for (const attribute of node.openingElement.attributes) {
		if (!isJsxAttribute(attribute) || !isJsxIdentifier(attribute.name) || attribute.name.name !== "scaled") {
			continue;
		}

		if (
			isJsxExpressionContainer(attribute.value) &&
			isAnyLiteral(attribute.value.expression) &&
			attribute.value.expression.value === false
		) {
			return true;
		}
	}

	return false;
}

function isRedundantAspectRatioChild(node: ESTree.JSXChild): boolean {
	if (isJsxElement(node)) return getJSXElementName(node) === REDUNDANT_ELEMENT_NAME;
	if (isJsxExpressionContainer(node) && isIdentifierName(node.expression)) {
		return node.expression.name === REDUNDANT_CONSTANT_NAME;
	}

	return false;
}

function isProtectedComponentUsage(
	componentName: string,
	protectedComponents: ReadonlySet<string>,
	moduleScope: Scope | undefined,
	filename: string,
): boolean {
	if (protectedComponents.has(componentName)) return true;
	if (moduleScope === undefined) return false;

	const variable = moduleScope.set.get(componentName);
	if (variable === undefined || !isImportBinding(variable)) return false;

	const importSource = getImportSourceFromVariable(variable);
	return (
		importSource !== undefined &&
		(importedFileHasConstraint(importSource, filename) || KNOWN_COMPONENTS.has(componentName))
	);
}

function isReportableUsageElement(
	usage: ESTree.JSXElement,
	protectedComponents: ReadonlySet<string>,
	moduleScope: Scope | undefined,
	filename: string,
): boolean {
	const componentName = getJSXElementName(usage);
	if (componentName === undefined) return false;
	if (!isProtectedComponentUsage(componentName, protectedComponents, moduleScope, filename)) return false;
	return !hasScaledFalseAttribute(usage);
}

const noRedundantAspectRatioConstraint = createRule("no-redundant-aspect-ratio-constraint", "roblox", {
	create(context): Visitor {
		const { filename, sourceCode } = context;
		const protectedComponents = new Set<string>();
		const jsxUsages = new Array<ESTree.JSXElement>();
		let scopeReference: ESTree.ImportDeclaration | undefined;

		function reportRedundantChildren(usage: ESTree.JSXElement): void {
			for (const child of usage.children) {
				if (isRedundantAspectRatioChild(child)) {
					context.report({
						messageId: "redundantAspectRatioConstraint",
						node: child,
					});
				}
			}
		}

		return {
			ArrowFunctionExpression(node): void {
				const name = getFunctionComponentName(node);
				const body = getArrowExpressionBody(node);
				if (name === undefined || body === undefined || (!isJsxElement(body) && !isJsxFragment(body))) {
					return;
				}

				if (!hasAspectRatioConstraintInSubtree(body)) return;
				protectedComponents.add(name);
			},

			FunctionDeclaration(node): void {
				const name = getFunctionComponentName(node);
				if (name === undefined || node.body?.body.length !== 1) return;

				const [statement] = node.body.body;
				if (!isReturnStatement(statement) || statement.argument === null) return;

				const hasConstraint = hasAspectRatioConstraintInSubtree(statement.argument);
				if (hasConstraint) protectedComponents.add(name);
			},

			ImportDeclaration(node): void {
				scopeReference ??= node;
			},

			JSXElement(node): void {
				jsxUsages.push(node);
			},

			"Program:exit"(): void {
				let moduleScope: Scope | undefined;
				if (scopeReference !== undefined) moduleScope = sourceCode.getScope(scopeReference);

				for (const usage of jsxUsages) {
					if (!isReportableUsageElement(usage, protectedComponents, moduleScope, filename)) continue;
					reportRedundantChildren(usage);
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow redundant uiaspectratioconstraint children inside components that already manage their own aspect ratio internally.",
		},
		messages: {
			redundantAspectRatioConstraint:
				"This component already renders a uiaspectratioconstraint internally. Passing one as a child is redundant and will cause layout issues.",
		},
		schema: [],
		type: "problem",
	},
});

export default noRedundantAspectRatioConstraint;
