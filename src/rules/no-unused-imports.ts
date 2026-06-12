// oxlint-disable small-rules/prevent-abbreviations -- `jsdoc` is valid.

import { defineRule } from "oxlint-plugin-utilities";

import type { Comment, ESTree, Fix, Fixer, SourceCode, Visitor } from "oxlint-plugin-utilities";

type AnyImportSpecifier = ESTree.ImportDefaultSpecifier | ESTree.ImportNamespaceSpecifier | ESTree.ImportSpecifier;

interface ImportInfo {
	readonly identifierName: string;
	readonly parent: ESTree.ImportDeclaration;
	readonly specifier: AnyImportSpecifier;
}

const JSDOC_LINK_IDENTIFIER_PATTERN = /@(?:link|linkcode|linkplain|see)\s+\{?(?<identifier>\w+)/gu;
const JSDOC_INLINE_LINK_IDENTIFIER_PATTERN = /\{@(?:link|linkcode|linkplain|see)\s+(?<identifier>\w+)/gu;
const JSDOC_TYPE_IDENTIFIER_PATTERN =
	/[@{](?:type|typedef|param|returns?|template|augments|extends|implements)\s+(?<annotation>[^}]*)/gu;
const JSDOC_ANNOTATION_IDENTIFIER_PATTERN = /\b(?<identifier>\w+)\b/gu;

function isImportSpecifier(node: ESTree.Node): node is AnyImportSpecifier {
	return (
		node.type === "ImportDefaultSpecifier" ||
		node.type === "ImportNamespaceSpecifier" ||
		node.type === "ImportSpecifier"
	);
}

function collectJsDocIdentifiers(comments: ReadonlyArray<Comment>): Set<string> {
	const identifiers = new Set<string>();
	for (const comment of comments) {
		if (comment.type !== "Block") continue;
		collectJsDocLinkIdentifiers(comment.value, identifiers);
		collectJsDocTypeIdentifiers(comment.value, identifiers);
	}
	return identifiers;
}

function collectJsDocLinkIdentifiers(value: string, identifiers: Set<string>): void {
	for (const pattern of [JSDOC_LINK_IDENTIFIER_PATTERN, JSDOC_INLINE_LINK_IDENTIFIER_PATTERN]) {
		for (const match of value.matchAll(pattern)) {
			const identifier = match.groups?.identifier;
			if (identifier !== undefined) identifiers.add(identifier);
		}
	}
}

function collectJsDocTypeIdentifiers(value: string, identifiers: Set<string>): void {
	for (const match of value.matchAll(JSDOC_TYPE_IDENTIFIER_PATTERN)) {
		const annotation = match.groups?.annotation;
		if (annotation === undefined) continue;

		for (const annotationMatch of annotation.matchAll(JSDOC_ANNOTATION_IDENTIFIER_PATTERN)) {
			const identifier = annotationMatch.groups?.identifier;
			if (identifier !== undefined) identifiers.add(identifier);
		}
	}
}

function removeImportSpecifier(
	sourceCode: SourceCode,
	parent: ESTree.ImportDeclaration,
	specifierNode: AnyImportSpecifier,
	fixer: Fixer,
): Array<Fix> | Fix {
	if (parent.specifiers.length === 1) return fixer.remove(parent);

	const nextToken = sourceCode.getTokenAfter(specifierNode);
	const isFirstSpecifier = parent.specifiers[0] === specifierNode;
	if (isFirstSpecifier && nextToken?.value === ",") {
		const previousToken = sourceCode.getTokenBefore(specifierNode);
		if (previousToken !== null) {
			return [
				fixer.removeRange([previousToken.range[1], specifierNode.range[0]]),
				fixer.remove(specifierNode),
				fixer.remove(nextToken),
			];
		}
	}

	if (nextToken?.value === ",") {
		return fixer.removeRange([specifierNode.range[0], nextToken.range[1]]);
	}

	const previousToken = sourceCode.getTokenBefore(specifierNode);
	if (previousToken?.value === ",") {
		return fixer.removeRange([previousToken.range[0], specifierNode.range[1]]);
	}

	return fixer.remove(specifierNode);
}

const noUnusedImports = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		const checkJsDoc = context.options[0]?.checkJSDoc ?? true;
		const jsdocIdentifiers = checkJsDoc ? collectJsDocIdentifiers(sourceCode.getAllComments()) : new Set<string>();

		const imports = new Array<ImportInfo>();
		let scopeReference: ESTree.ImportDeclaration | undefined;

		return {
			ImportDeclaration(node): void {
				scopeReference ??= node;
				for (const specifier of node.specifiers) {
					if (!isImportSpecifier(specifier)) continue;
					imports.push({
						identifierName: specifier.local.name,
						parent: node,
						specifier,
					});
				}
			},

			"Program:exit"(): void {
				if (scopeReference === undefined) return;
				const moduleScope = sourceCode.getScope(scopeReference);

				for (const { identifierName, parent, specifier: specifierNode } of imports) {
					const variable = moduleScope.set.get(identifierName);
					if (variable !== undefined && variable.references.length > 0) continue;
					if (checkJsDoc && jsdocIdentifiers.has(identifierName)) continue;

					context.report({
						data: { identifierName },
						fix(fixer) {
							return removeImportSpecifier(sourceCode, parent, specifierNode, fixer);
						},
						messageId: "unusedImport",
						node: specifierNode,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Disallow unused imports",
		},
		fixable: "code",
		messages: {
			unusedImport: "Import '{{identifierName}}' is defined but never used.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkJSDoc: {
						default: true,
						description: "Check if imports are referenced in JSDoc comments",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noUnusedImports;
