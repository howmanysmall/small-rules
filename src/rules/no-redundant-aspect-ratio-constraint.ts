import { readFileSync } from "node:fs";
import { walkAst } from "$oxc-utilities/react-hook-utilities";
import { resolveRelativeImport } from "$oxc-utilities/resolve-import";
import { isImportBinding } from "$oxc-utilities/static-expression-utilities";
import { isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Scope, Visitor } from "oxlint-plugin-utilities";

const REDUNDANT_ELEMENT_NAME = "uiaspectratioconstraint";
const REDUNDANT_CONSTANT_NAME = "UI_ASPECT_RATIO_CONSTRAINT";

const KNOWN_COMPONENTS = new Set(["ButtonSpritesheet", "GenericSpritesheet", "LabelSpritesheet"]);

type ScopeVariable = Scope["set"] extends Map<string, infer VariableType> ? VariableType : never;

function getJSXElementName({ openingElement }: ESTree.JSXElement): string | undefined {
	const { name } = openingElement;
	return name.type === "JSXIdentifier" ? name.name : undefined;
}

function hasAspectRatioConstraintInSubtree(node: ESTree.Node): boolean {
	let found = false;
	walkAst(node, (child) => {
		if (found) return;
		if (child.type === "JSXElement" && getJSXElementName(child) === REDUNDANT_ELEMENT_NAME) found = true;
	});
	return found;
}

function getFunctionComponentName(node: ESTree.Node): string | undefined {
	if (node.type === "FunctionDeclaration") return node.id?.name;

	if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
		const { parent } = node;
		if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
	}

	return undefined;
}

function getImportSourceFromVariable(variable: ScopeVariable): string | undefined {
	for (const definition of variable.defs) {
		if (definition.type !== "ImportBinding") continue;
		const { parent } = definition.node;
		if (parent?.type === "ImportDeclaration" && isStringRaw(parent.source.value)) return parent.source.value;
	}
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
		importedFileCache.set(resolved.path, false);
		return false;
	}
}

function hasScaledFalseAttribute(node: ESTree.JSXElement): boolean {
	for (const attribute of node.openingElement.attributes) {
		if (
			attribute.type !== "JSXAttribute" ||
			attribute.name.type !== "JSXIdentifier" ||
			attribute.name.name !== "scaled"
		) {
			continue;
		}

		if (
			attribute.value?.type === "JSXExpressionContainer" &&
			attribute.value.expression.type === "Literal" &&
			attribute.value.expression.value === false
		) {
			return true;
		}
	}
	return false;
}

function isRedundantAspectRatioChild(node: ESTree.JSXChild): boolean {
	if (node.type === "JSXElement") return getJSXElementName(node) === REDUNDANT_ELEMENT_NAME;
	if (node.type === "JSXExpressionContainer" && node.expression.type === "Identifier") {
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

const noRedundantAspectRatioConstraint = defineRule({
	create(context): Visitor {
		const { filename, sourceCode } = context;
		const protectedComponents = new Set<string>();
		const jsxUsages = new Array<ESTree.JSXElement>();
		let scopeReference: ESTree.ImportDeclaration | undefined;

		return {
			ArrowFunctionExpression(node): void {
				const name = getFunctionComponentName(node);
				if (name === undefined || (node.body.type !== "JSXElement" && node.body.type !== "JSXFragment")) return;
				if (!hasAspectRatioConstraintInSubtree(node.body)) return;
				protectedComponents.add(name);
			},

			FunctionDeclaration(node): void {
				const name = getFunctionComponentName(node);
				if (name === undefined || node.body?.body.length !== 1) return;

				const [statement] = node.body.body;
				if (statement?.type !== "ReturnStatement" || statement.argument === null) return;

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
				let moduleScope: ReturnType<typeof sourceCode.getScope> | undefined;
				if (scopeReference !== undefined) moduleScope = sourceCode.getScope(scopeReference);

				for (const usage of jsxUsages) {
					const componentName = getJSXElementName(usage);
					if (componentName === undefined) continue;

					const protectedUsage = isProtectedComponentUsage(
						componentName,
						protectedComponents,
						moduleScope,
						filename,
					);
					if (!protectedUsage || hasScaledFalseAttribute(usage)) continue;

					for (const child of usage.children) {
						if (isRedundantAspectRatioChild(child)) {
							context.report({
								messageId: "redundantAspectRatioConstraint",
								node: child,
							});
						}
					}
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
