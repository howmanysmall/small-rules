import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	hasName,
	isIdentifierName,
	isJsxIdentifier,
	isMemberExpression,
	isProperty,
	isStringLiteral,
	isTsQualifiedName,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";
import {
	ANOTHER_NAME_MESSAGE,
	DEFAULT_ALLOW_LIST,
	DEFAULT_ALLOW_PROPERTY_ACCESS,
	DEFAULT_IGNORE,
	DEFAULT_REPLACEMENTS,
	DEFAULT_SHORTHANDS,
	MESSAGE_ID_REPLACE,
	MESSAGE_ID_SUGGESTION,
} from "$oxc-utilities/prevent-abbreviations/constants";
import { isValidIdentifier } from "$oxc-utilities/prevent-abbreviations/identifier";
import {
	getMessage,
	getNameReplacements,
	getShorthandReplacement,
	isDiscouragedReplacementName,
	isPropertyAccessAllowed,
	isShorthandIgnored,
	isUpperFirst,
	prepareOptions,
} from "$oxc-utilities/prevent-abbreviations/replacements";
import {
	getAvailableVariableName,
	getScopes,
	isClassVariable,
	isDefaultOrNamespaceImportName,
	isObjectPropertyKey,
	isShorthandImportLocal,
	isShorthandPropertyValue,
	renameVariable,
	shouldCheckImport,
	shouldFix,
	shouldReportIdentifierAsProperty,
} from "$oxc-utilities/prevent-abbreviations/scope";
import { isNumberRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { IsSafe, MessageIds, PreparedOptions, VariableLike } from "$oxc-utilities/prevent-abbreviations/types";
import type {
	Definition,
	Diagnostic,
	ESTree,
	Fix,
	Fixer,
	Scope,
	SourceCode,
	Variable,
	Visitor,
} from "oxlint-plugin-utilities";

function createIsSafeGeneratedName(scopeToNamesGeneratedByFixer: WeakMap<Scope, Set<string>>): IsSafe {
	return function isSafeGeneratedName(name: string, scopes: ReadonlyArray<Scope>): boolean {
		return scopes.every((scope) => {
			const generatedNames = scopeToNamesGeneratedByFixer.get(scope);
			return generatedNames === undefined || !generatedNames.has(name);
		});
	};
}

function isShorthandPropertyAccess(node: ESTree.IdentifierName): boolean {
	const { parent } = node;
	return (
		(isMemberExpression(parent) && parent.property === node && !parent.computed) ||
		(isTsQualifiedName(parent) && parent.right === node)
	);
}

function isObjectIdentifierImported(node: ESTree.IdentifierName, sourceCode: SourceCode): boolean {
	const { parent } = node;

	let objectNode: ESTree.Node | undefined;
	/* v8 ignore else -- isShorthandPropertyAccess limits callers to member or TS-qualified property access. @preserve */
	if (isMemberExpression(parent) && parent.property === node && !parent.computed) {
		objectNode = parent.object;
	} else if (isTsQualifiedName(parent) && parent.right === node) objectNode = parent.left;

	if (objectNode === undefined || !hasName(objectNode)) return false;

	return getVariableByName(sourceCode.getScope(node), objectNode.name)?.defs[0]?.type === "ImportBinding";
}

function reportShorthandReplacement(
	node: ESTree.IdentifierName,
	replacement: string,
	isPropertyLike: boolean,
	report: (diagnostic: Diagnostic<MessageIds>) => void,
): void {
	report({
		/* v8 ignore next -- shorthand reports are only emitted for property-like identifiers today. @preserve */
		...getMessage(node.name, { samples: [replacement], total: 1 }, isPropertyLike ? "property" : "variable"),
		node,
	});
}

function shouldSkipVariable(
	definition: Definition,
	definitionName: ESTree.IdentifierName,
	options: PreparedOptions,
): boolean {
	if (
		(isDefaultOrNamespaceImportName(definitionName) &&
			!shouldCheckImport(options.checkDefaultAndNamespaceImports, definition)) ||
		(isShorthandImportLocal(definitionName) && !shouldCheckImport(options.checkShorthandImports, definition))
	) {
		return true;
	}

	return !options.checkShorthandProperties && isShorthandPropertyValue(definitionName);
}

function getSpecialCaseReplacement(variable: VariableLike): string | undefined {
	if (variable.name !== "plr") return undefined;

	const [definition] = variable.defs;
	if (definition?.type !== "Variable" || !isVariableDeclarator(definition.node) || definition.node.init === null) {
		return undefined;
	}

	const { init } = definition.node;
	if (
		isMemberExpression(init) &&
		!init.computed &&
		isIdentifierName(init.object) &&
		init.object.name === "Players" &&
		isIdentifierName(init.property) &&
		init.property.name === "LocalPlayer"
	) {
		return "localPlayer";
	}

	return undefined;
}

interface SafeSamplesResult {
	readonly droppedDiscouraged: number;
	readonly safeSamples: ReadonlyArray<string>;
}

function computeSafeSamples(
	samples: ReadonlyArray<string>,
	scopes: ReadonlyArray<Scope>,
	isSafeNameForVariable: IsSafe,
	options: PreparedOptions,
): SafeSamplesResult {
	const safeSamples = new Array<string>();
	let safeSamplesSize = 0;
	let droppedDiscouraged = 0;

	for (const name of samples) {
		const safeName = getAvailableVariableName(name, scopes, isSafeNameForVariable);
		if (safeName === undefined) continue;
		if (safeName !== name && isDiscouragedReplacementName(name, options)) {
			droppedDiscouraged += 1;
			continue;
		}
		/* v8 ignore else -- generated safe names are non-empty valid identifiers. @preserve */
		if (safeName.length > 0) safeSamples[safeSamplesSize++] = safeName;
	}

	return { droppedDiscouraged, safeSamples };
}

function createIsSafeNameForVariable(
	definition: Definition,
	variable: VariableLike,
	isSafeGeneratedName: IsSafe,
): IsSafe {
	const avoidArgumentsReplacement =
		definition.type === "Variable" && isVariableDeclarator(definition.node) && definition.node.init === null;
	const avoidArgumentsInArrowParameter =
		definition.type === "Parameter" &&
		variable.scope.type === "function" &&
		variable.scope.block.type === "ArrowFunctionExpression";
	const shouldAvoidArguments = avoidArgumentsReplacement || avoidArgumentsInArrowParameter;

	return (name, scopes) => {
		if (!isSafeGeneratedName(name, scopes)) return false;
		if (shouldAvoidArguments && name === "arguments") return false;
		return true;
	};
}

function tryReportFix(
	report: (diagnostic: Diagnostic<MessageIds>) => void,
	message: { data: Record<string, string>; messageId: MessageIds },
	variable: VariableLike,
	replacement: string,
	scopes: ReadonlyArray<Scope>,
	scopeToNamesGeneratedByFixer: WeakMap<Scope, Set<string>>,
	definitionName: ESTree.IdentifierName,
): void {
	for (const scope of scopes) {
		if (!scopeToNamesGeneratedByFixer.has(scope)) {
			scopeToNamesGeneratedByFixer.set(scope, new Set());
		}
		const generatedNames = scopeToNamesGeneratedByFixer.get(scope);
		generatedNames?.add(replacement);
	}
	report({
		...message,
		fix(fixer: Fixer): Array<Fix> {
			return renameVariable(variable, replacement, fixer);
		},
		node: definitionName,
	});
}

function checkVariable(
	variable: VariableLike,
	options: PreparedOptions,
	scopeToNamesGeneratedByFixer: WeakMap<Scope, Set<string>>,
	isSafeGeneratedName: IsSafe,
	report: (diagnostic: Diagnostic<MessageIds>) => void,
): void {
	const [definition] = variable.defs;
	if (definition === undefined) return;

	const definitionName = definition.name;
	/* v8 ignore next -- parser variable definitions in this rule expose identifier names. @preserve */
	if (!isIdentifierName(definitionName)) return;
	if (shouldSkipVariable(definition, definitionName, options)) return;

	const isSafeNameForVariable = createIsSafeNameForVariable(definition, variable, isSafeGeneratedName);

	const specialCaseReplacement = getSpecialCaseReplacement(variable);
	const variableReplacements =
		specialCaseReplacement === undefined
			? getNameReplacements(variable.name, options)
			: { samples: [specialCaseReplacement], total: 1 };
	if (variableReplacements.total === 0 || !variableReplacements.samples) return;

	const { references } = variable;
	const scopes = [...references.map((reference) => reference.from), variable.scope];

	const { droppedDiscouraged, safeSamples } = computeSafeSamples(
		variableReplacements.samples,
		scopes,
		isSafeNameForVariable,
		options,
	);

	const baseSamples = safeSamples.length > 0 ? safeSamples : variableReplacements.samples;
	const hasCompleteSamples =
		isNumberRaw(variableReplacements.samples.length) &&
		variableReplacements.samples.length === variableReplacements.total;
	const effectiveTotal = hasCompleteSamples
		? Math.max(0, variableReplacements.total - droppedDiscouraged)
		: variableReplacements.total;
	const messageSamples =
		variable.name === "fn" && effectiveTotal > 1
			? baseSamples.map((name) => (name === "function_" ? "function" : name))
			: baseSamples;

	const message = getMessage(definitionName.name, { samples: messageSamples, total: effectiveTotal }, "variable");

	if (effectiveTotal === 1 && safeSamples.length === 1 && shouldFix(variable)) {
		const [replacement] = safeSamples;
		/* v8 ignore next -- safeSamples.length === 1 guarantees a replacement entry. @preserve */
		if (replacement !== undefined) {
			tryReportFix(report, message, variable, replacement, scopes, scopeToNamesGeneratedByFixer, definitionName);
			return;
		}
	}

	report({ ...message, node: definitionName });
}

function checkPossiblyWeirdClassVariable(variable: Variable, variableChecker: (variable: VariableLike) => void): void {
	if (!isClassVariable(variable)) {
		variableChecker(variable);
		return;
	}

	if (variable.scope.type === "class") {
		const [definition] = variable.defs;
		/* v8 ignore next -- class variables classified by isClassVariable have exactly one definition. @preserve */
		if (definition === undefined) {
			variableChecker(variable);
			return;
		}
		const definitionName = definition.name;
		/* v8 ignore next -- parser class-name definitions expose identifier names. @preserve */
		if (!isIdentifierName(definitionName)) {
			variableChecker(variable);
			return;
		}
		variableChecker(variable);
	}
}

function checkScope(scope: Scope, variableChecker: (variable: VariableLike) => void): void {
	for (const scopeItem of getScopes(scope)) {
		for (const variable of scopeItem.variables) checkPossiblyWeirdClassVariable(variable, variableChecker);
	}
}

function checkPropertyIdentifier(
	node: ESTree.IdentifierName,
	options: PreparedOptions,
	report: (diagnostic: Diagnostic<MessageIds>) => void,
	sourceCode: SourceCode,
): void {
	const propertyLike = shouldReportIdentifierAsProperty(node);
	const propertyAccess = isShorthandPropertyAccess(node);

	if (propertyAccess && isObjectIdentifierImported(node, sourceCode)) return;

	if (checkShorthandIdentifier(node, propertyLike, propertyAccess, options, report)) return;
	if (!(options.checkProperties && propertyLike)) return;

	reportPropertyIdentifier(node, options, report);
}

function checkShorthandIdentifier(
	node: ESTree.IdentifierName,
	propertyLike: boolean,
	propertyAccess: boolean,
	options: PreparedOptions,
	report: (diagnostic: Diagnostic<MessageIds>) => void,
): boolean {
	const shorthandReplacement = getShorthandReplacement(node.name, options.shorthandConfiguration);
	if (shorthandReplacement === undefined || !(propertyLike || propertyAccess)) return false;
	if (isShorthandIgnored(node.name, options.shorthandConfiguration)) return true;
	if (!options.checkShorthandProperties) return true;
	if (propertyAccess && isPropertyAccessAllowed(node.name, shorthandReplacement, options.allowPropertyAccess)) {
		return true;
	}

	reportShorthandReplacement(node, shorthandReplacement.replaced, true, report);
	return true;
}

function reportPropertyIdentifier(
	node: ESTree.IdentifierName,
	options: PreparedOptions,
	report: (diagnostic: Diagnostic<MessageIds>) => void,
): void {
	const replacements = getNameReplacements(node.name, options);
	if (replacements.total === 0) return;

	const message = getMessage(node.name, replacements, "property");
	const fixableReplacement = getFixablePropertyReplacement(node, replacements.samples);
	if (fixableReplacement !== undefined) {
		report({
			...message,
			fix(fixer: Fixer): Fix {
				return fixer.replaceText(node, fixableReplacement);
			},
			node,
		});
		return;
	}

	report({ ...message, node });
}

function getFixablePropertyReplacement(
	node: ESTree.IdentifierName,
	samples: ReadonlyArray<string> | undefined,
): string | undefined {
	if (samples?.length !== 1 || !isObjectPropertyKey(node)) return undefined;

	const [replacement] = samples;
	const { parent } = node;
	if (
		replacement !== undefined &&
		isProperty(parent) &&
		isStringLiteral(parent.value) &&
		isValidIdentifier(replacement)
	) {
		return replacement;
	}

	return undefined;
}

const preventAbbreviations = defineRule({
	create(context): Visitor {
		const options = prepareOptions(context.options[0]);
		const filenameWithExtension = context.physicalFilename;
		const scopeToNamesGeneratedByFixer = new WeakMap<Scope, Set<string>>();
		const isSafeGeneratedName = createIsSafeGeneratedName(scopeToNamesGeneratedByFixer);
		const { sourceCode } = context;

		function variableChecker(variable: VariableLike): void {
			checkVariable(variable, options, scopeToNamesGeneratedByFixer, isSafeGeneratedName, context.report);
		}

		return {
			Identifier(node): void {
				if (!hasName(node) || node.name === "__proto__") return;
				checkPropertyIdentifier(node, options, context.report, sourceCode);
			},
			JSXOpeningElement({ name }): void {
				if (!(options.checkVariables && isJsxIdentifier(name) && isUpperFirst(name.name))) return;

				const replacements = getNameReplacements(name.name, options);
				if (replacements.total === 0) return;

				const message = getMessage(name.name, replacements, "variable");
				context.report({ ...message, node: name });
			},
			"Program:exit"(program): void {
				if (
					options.checkFilenames &&
					filenameWithExtension !== "<input>" &&
					filenameWithExtension !== "<text>"
				) {
					const lastSeparator = Math.max(
						filenameWithExtension.lastIndexOf("/"),
						filenameWithExtension.lastIndexOf("\\"),
					);
					const filename = filenameWithExtension.slice(lastSeparator + 1);
					const lastDot = filename.lastIndexOf(".");
					const extension = lastDot === -1 ? "" : filename.slice(lastDot);
					const basename = lastDot === -1 ? filename : filename.slice(0, lastDot);
					const filenameReplacements = getNameReplacements(basename, options);
					if (filenameReplacements.total > 0 && filenameReplacements.samples) {
						const samples = filenameReplacements.samples.map((replacement) => `${replacement}${extension}`);
						context.report({
							...getMessage(filename, { samples, total: filenameReplacements.total }, "filename"),
							node: program,
						});
					}
				}

				if (!options.checkVariables) return;
				checkScope(sourceCode.getScope(program), variableChecker);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prevent abbreviations.",
			recommended: false,
		},
		fixable: "code",
		messages: {
			[MESSAGE_ID_REPLACE]: `The {{nameTypeText}} \`{{discouragedName}}\` should be named \`{{replacement}}\`. ${ANOTHER_NAME_MESSAGE}`,
			[MESSAGE_ID_SUGGESTION]: `Please rename the {{nameTypeText}} \`{{discouragedName}}\`. Suggested names are: {{replacementsText}}. ${ANOTHER_NAME_MESSAGE}`,
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowList: {
						additionalProperties: { type: "boolean" },
						default: DEFAULT_ALLOW_LIST,
						defaultLabel: "default allow list",
						description: "Names that should be allowed even when they match a discouraged abbreviation.",
						type: "object",
					},
					allowPropertyAccess: {
						default: DEFAULT_ALLOW_PROPERTY_ACCESS,
						description: "Property names that may keep abbreviated member access.",
						items: { type: "string" },
						type: "array",
					},
					checkDefaultAndNamespaceImports: {
						default: "internal",
						description: "Whether default and namespace import local names should be checked.",
						enum: [false, true, "internal"],
					},
					checkFilenames: {
						default: true,
						description: "Whether file names should be checked for abbreviations.",
						type: "boolean",
					},
					checkProperties: {
						default: false,
						description: "Whether object, member, and JSX property names should be checked.",
						type: "boolean",
					},
					checkShorthandImports: {
						default: "internal",
						description: "Whether renamed shorthand imports should be checked.",
						enum: [false, true, "internal"],
					},
					checkShorthandProperties: {
						default: true,
						description: "Whether shorthand object property names should be checked.",
						type: "boolean",
					},
					checkVariables: {
						default: true,
						description: "Whether variable, function, class, and component names should be checked.",
						type: "boolean",
					},
					extendDefaultAllowList: {
						default: true,
						description: "Merge configured allowList entries with the default allow list.",
						type: "boolean",
					},
					extendDefaultReplacements: {
						default: true,
						description: "Merge configured replacements with the default replacement map.",
						type: "boolean",
					},
					ignore: {
						default: DEFAULT_IGNORE,
						description: "Names or regular expression patterns that should be ignored.",
						items: { type: "string" },
						type: "array",
					},
					ignoreShorthands: {
						default: [],
						description: "Shorthand names that should not be reported.",
						items: { type: "string" },
						type: "array",
					},
					replacements: {
						additionalProperties: {
							oneOf: [
								{ enum: [false] },
								{
									additionalProperties: { type: "boolean" },
									type: "object",
								},
							],
						},
						default: DEFAULT_REPLACEMENTS,
						defaultLabel: "default replacement map",
						description: "Replacement suggestions for discouraged names.",
						type: "object",
					},
					shorthands: {
						additionalProperties: { type: "string" },
						default: DEFAULT_SHORTHANDS,
						defaultLabel: "default shorthands",
						description: "Shorthand names and the full names they should expand to.",
						type: "object",
					},
				},
				type: "object",
			},
		] as const,
		type: "suggestion",
	},
});

export default preventAbbreviations;
