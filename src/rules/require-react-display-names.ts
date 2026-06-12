import { getImportedName } from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA, getReactSourcesFromOptions, isReactImport } from "$oxc-utilities/react-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

interface TrackedVariable {
	hasDisplayName: boolean;
	kind: "context" | "memo";
	node: ESTree.VariableDeclarator;
}

interface DisplayNameReport {
	readonly data: { readonly variableName: string };
	readonly messageId: "missingContextDisplayName" | "missingMemoDisplayName";
	readonly node: ESTree.VariableDeclarator;
}

interface DisplayNameReportContext {
	report: (report: DisplayNameReport) => void;
}

function getVariableName(node: ESTree.VariableDeclarator): string | undefined {
	if (node.id.type !== "Identifier") return undefined;
	return node.id.name;
}

function isMemoCall(
	node: ESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	if (node.callee.type === "Identifier") return memoIdentifiers.has(node.callee.name);
	if (node.callee.type !== "MemberExpression") return false;
	if (node.callee.property.type !== "Identifier") return false;
	if (node.callee.property.name !== "memo") return false;
	if (node.callee.object.type !== "Identifier") return false;
	return reactNamespaces.has(node.callee.object.name);
}

function isCreateContextCall(
	node: ESTree.CallExpression,
	createContextIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	if (node.callee.type === "Identifier") return createContextIdentifiers.has(node.callee.name);
	if (node.callee.type !== "MemberExpression") return false;
	if (node.callee.property.type !== "Identifier") return false;
	if (node.callee.property.name !== "createContext") return false;
	if (node.callee.object.type !== "Identifier") return false;
	return reactNamespaces.has(node.callee.object.name);
}

function isNodeInExport(node: ESTree.Node): boolean {
	let current: ESTree.Node | null | undefined = node;

	while (current !== null) {
		if (current.type === "ExportNamedDeclaration" || current.type === "ExportDefaultDeclaration") return true;
		current = current.parent;
	}

	return false;
}

function isVariableDeclarationExported(node: ESTree.VariableDeclarator): boolean {
	if (node.parent.type !== "VariableDeclaration") return false;
	return (
		node.parent.parent.type === "ExportNamedDeclaration" || node.parent.parent.type === "ExportDefaultDeclaration"
	);
}

function hasExportReference(sourceCode: SourceCode, node: ESTree.VariableDeclarator, variableName: string): boolean {
	for (const variable of sourceCode.getDeclaredVariables(node)) {
		if (variable.name !== variableName) continue;
		for (const { identifier } of variable.references) if (isNodeInExport(identifier)) return true;
		return false;
	}

	return false;
}

function isExportedTrackedVariable(
	sourceCode: SourceCode,
	variableName: string,
	node: ESTree.VariableDeclarator,
	defaultExportedNames: ReadonlySet<string>,
): boolean {
	if (defaultExportedNames.has(variableName)) return true;
	if (isVariableDeclarationExported(node)) return true;
	return hasExportReference(sourceCode, node, variableName);
}

function reportMissingDisplayName(
	context: DisplayNameReportContext,
	trackedVariable: TrackedVariable,
	variableName: string,
): void {
	context.report({
		data: { variableName },
		messageId: trackedVariable.kind === "context" ? "missingContextDisplayName" : "missingMemoDisplayName",
		node: trackedVariable.node,
	});
}

const requireReactDisplayNames = defineRule({
	create(context): Visitor {
		const reactSources = getReactSourcesFromOptions(context.options[0]);
		const memoIdentifiers = new Set<string>();
		const createContextIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const trackedVariables = new Map<string, TrackedVariable>();
		const defaultExportedNames = new Set<string>();

		return {
			'AssignmentExpression[left.type="MemberExpression"]'(node: ESTree.AssignmentExpression): void {
				const { left } = node;
				if (left.type !== "MemberExpression") return;
				if (left.property.type !== "Identifier") return;
				if (left.property.name !== "displayName") return;
				if (left.object.type !== "Identifier") return;

				const trackedVariable = trackedVariables.get(left.object.name);
				if (trackedVariable === undefined) return;

				trackedVariable.hasDisplayName = true;
			},
			ExportDefaultDeclaration(node): void {
				if (node.declaration.type === "CallExpression") {
					if (isMemoCall(node.declaration, memoIdentifiers, reactNamespaces)) {
						context.report({
							messageId: "directMemoExport",
							node,
						});
						return;
					}

					if (isCreateContextCall(node.declaration, createContextIdentifiers, reactNamespaces)) {
						context.report({
							messageId: "directContextExport",
							node,
						});
					}

					return;
				}

				if (node.declaration.type !== "Identifier") return;
				defaultExportedNames.add(node.declaration.name);
			},
			ExportNamedDeclaration(node): void {
				for (const specifier of node.specifiers) {
					if (
						specifier.exported.type !== "Identifier" ||
						specifier.exported.name !== "default" ||
						specifier.local.type !== "Identifier"
					) {
						continue;
					}

					defaultExportedNames.add(specifier.local.name);
				}
			},
			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportSpecifier") {
						const importedName = getImportedName(specifier);
						if (importedName === "memo") memoIdentifiers.add(specifier.local.name);
						if (importedName === "createContext") createContextIdentifiers.add(specifier.local.name);
						continue;
					}

					reactNamespaces.add(specifier.local.name);
				}
			},
			"Program:exit"(): void {
				for (const [variableName, trackedVariable] of trackedVariables) {
					if (trackedVariable.hasDisplayName) continue;
					if (
						!isExportedTrackedVariable(
							context.sourceCode,
							variableName,
							trackedVariable.node,
							defaultExportedNames,
						)
					) {
						continue;
					}

					reportMissingDisplayName(context, trackedVariable, variableName);
				}
			},
			VariableDeclarator(node): void {
				if (node.init?.type !== "CallExpression") return;

				const variableName = getVariableName(node);
				if (variableName === undefined) return;

				if (isMemoCall(node.init, memoIdentifiers, reactNamespaces)) {
					trackedVariables.set(variableName, {
						hasDisplayName: false,
						kind: "memo",
						node,
					});
					return;
				}

				if (!isCreateContextCall(node.init, createContextIdentifiers, reactNamespaces)) return;

				trackedVariables.set(variableName, {
					hasDisplayName: false,
					kind: "context",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require displayName on exported memo components and contexts.",
		},
		messages: {
			directContextExport: "Directly exporting createContext() result prevents setting displayName.",
			directMemoExport: "Directly exporting memo() result prevents setting displayName.",
			missingContextDisplayName: "Context '{{variableName}}' must have a displayName assigned.",
			missingMemoDisplayName: "Memo component '{{variableName}}' must have a displayName assigned.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: ENVIRONMENT_SCHEMA,
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default requireReactDisplayNames;
