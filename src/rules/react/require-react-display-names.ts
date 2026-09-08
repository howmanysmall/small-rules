import { createRule } from "$oxc-utilities/create-rule";
import {
	getImportedName,
	isCallExpression,
	isExportDefaultDeclaration,
	isExportNamedDeclaration,
	isIdentifierName,
	isImportSpecifier,
	isMemberExpression,
	isReactNamedCall,
	isVariableDeclaration,
} from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA, getReactSourcesFromOptions, isReactImport } from "$oxc-utilities/react-utilities";

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
	return isIdentifierName(node.id) ? node.id.name : undefined;
}

function isMemoCall(
	node: ESTree.CallExpression,
	memoIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	return isReactNamedCall(node, memoIdentifiers, reactNamespaces, "memo");
}

function isCreateContextCall(
	node: ESTree.CallExpression,
	createContextIdentifiers: ReadonlySet<string>,
	reactNamespaces: ReadonlySet<string>,
): boolean {
	if (isIdentifierName(node.callee)) return createContextIdentifiers.has(node.callee.name);
	if (
		!isMemberExpression(node.callee) ||
		!isIdentifierName(node.callee.property) ||
		node.callee.property.name !== "createContext" ||
		!isIdentifierName(node.callee.object)
	) {
		return false;
	}
	return reactNamespaces.has(node.callee.object.name);
}

function isNodeInExport(node: ESTree.Node): boolean {
	let current: ESTree.Node | null | undefined = node;

	while (current !== null) {
		if (isExportNamedDeclaration(current) || isExportDefaultDeclaration(current)) return true;
		current = current.parent;
	}

	return false;
}

function isVariableDeclarationExported(node: ESTree.VariableDeclarator): boolean {
	/* v8 ignore next -- @preserve VariableDeclarator nodes always have VariableDeclaration parents in parser output. */
	if (!isVariableDeclaration(node.parent)) return false;
	return isExportNamedDeclaration(node.parent.parent) || isExportDefaultDeclaration(node.parent.parent);
}

function hasExportReference(sourceCode: SourceCode, node: ESTree.VariableDeclarator, variableName: string): boolean {
	for (const variable of sourceCode.getDeclaredVariables(node)) {
		/* v8 ignore next -- @preserve declared variables for an identifier declarator match the declarator name. */
		if (variable.name !== variableName) continue;
		for (const { identifier } of variable.references) if (isNodeInExport(identifier)) return true;
		return false;
	}

	/* v8 ignore next -- @preserve identifier variable declarators always declare one variable. */
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

const requireReactDisplayNames = createRule("require-react-display-names", "react", {
	create(context): Visitor {
		const reactSources = getReactSourcesFromOptions(context.options[0]);
		const memoIdentifiers = new Set<string>();
		const createContextIdentifiers = new Set<string>();
		const reactNamespaces = new Set<string>();
		const trackedVariables = new Map<string, TrackedVariable>();
		const defaultExportedNames = new Set<string>();

		return {
			'AssignmentExpression[left.type="MemberExpression"]'({ left }: ESTree.AssignmentExpression): void {
				/* v8 ignore next -- @preserve visitor selector restricts left to MemberExpression. */
				if (!isMemberExpression(left)) return;

				const { property } = left;
				if (!isIdentifierName(property) || property.name !== "displayName") return;

				const { object } = left;
				if (!isIdentifierName(object)) return;

				const trackedVariable = trackedVariables.get(object.name);
				if (trackedVariable === undefined) return;

				trackedVariable.hasDisplayName = true;
			},
			ExportDefaultDeclaration(node): void {
				if (isCallExpression(node.declaration)) {
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

				if (isIdentifierName(node.declaration)) defaultExportedNames.add(node.declaration.name);
			},
			ExportNamedDeclaration(node): void {
				for (const specifier of node.specifiers) {
					if (
						!isIdentifierName(specifier.exported) ||
						specifier.exported.name !== "default" ||
						!isIdentifierName(specifier.local)
					) {
						continue;
					}

					defaultExportedNames.add(specifier.local.name);
				}
			},
			ImportDeclaration(node): void {
				if (!isReactImport(node, reactSources)) return;

				for (const specifier of node.specifiers) {
					const { name } = specifier.local;
					if (isImportSpecifier(specifier)) {
						const importedName = getImportedName(specifier);
						if (importedName === "memo") memoIdentifiers.add(name);
						else if (importedName === "createContext") createContextIdentifiers.add(name);
						continue;
					}

					reactNamespaces.add(name);
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
				if (!isCallExpression(node.init)) return;

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
