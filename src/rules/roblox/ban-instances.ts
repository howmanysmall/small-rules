import { getMemberPropertyName, getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isNamedGlobalCall } from "$oxc-utilities/oxc-utilities";
import { isStringArray, isStringRecord } from "$oxc-utilities/type-utilities";
import { Predicate } from "effect";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, Scope, Visitor } from "oxlint-plugin-utilities";

interface BannedClassEntry {
	readonly message: string;
	readonly originalName: string;
}

interface BannedPropertyEntry {
	readonly message: string;
	readonly propertyName: string;
}

interface TrackedVariable {
	readonly className: string;
	readonly classNameKey: string;
	readonly functionScope: Scope;
}

type NormalizedOptions = Readonly<{
	bannedClasses: ReadonlyMap<string, BannedClassEntry>;
	bannedProperties: ReadonlyMap<string, ReadonlyMap<string, BannedPropertyEntry>>;
}>;

const EMPTY_OPTIONS: NormalizedOptions = {
	bannedClasses: new Map(),
	bannedProperties: new Map(),
};

function getJsxAttributeName(name: ESTree.JSXAttributeName): string | undefined {
	return name.type === "JSXIdentifier" ? name.name : name.name.name;
}

function normalizeClassBans(rawBans: unknown): Map<string, BannedClassEntry> {
	const bannedClasses = new Map<string, BannedClassEntry>();

	if (isStringArray(rawBans)) {
		for (const className of rawBans) {
			bannedClasses.set(className.toLowerCase(), { message: "", originalName: className });
		}
		return bannedClasses;
	}

	/* v8 ignore next -- @preserve rule schema rejects non-array/non-record bannedInstances. */
	if (isStringRecord(rawBans)) {
		for (const [className, message] of Object.entries(rawBans)) {
			bannedClasses.set(className.toLowerCase(), { message, originalName: className });
		}
	}

	return bannedClasses;
}

function normalizePropertyBans(rawBans: unknown): Map<string, ReadonlyMap<string, BannedPropertyEntry>> {
	const bannedClasses = new Map<string, ReadonlyMap<string, BannedPropertyEntry>>();

	if (rawBans === undefined) return bannedClasses;

	/* v8 ignore next -- @preserve rule schema rejects non-record bannedProperties. */
	if (!Predicate.isObject(rawBans)) return bannedClasses;

	for (const [className, propertyConfig] of Object.entries(rawBans)) {
		/* v8 ignore next -- @preserve rule schema rejects non-record bannedProperties entries. */
		if (!Predicate.isObject(propertyConfig)) continue;

		const bannedPropertiesForClass = new Map<string, BannedPropertyEntry>();
		for (const [propertyName, message] of Object.entries(propertyConfig)) {
			/* v8 ignore next -- @preserve rule schema rejects non-string banned property messages. */
			if (!Predicate.isString(message)) continue;
			bannedPropertiesForClass.set(propertyName.toLowerCase(), { message, propertyName });
		}

		if (bannedPropertiesForClass.size > 0) {
			bannedClasses.set(className.toLowerCase(), bannedPropertiesForClass);
		}
	}

	return bannedClasses;
}

function normalizeOptions(rawOptions: unknown): NormalizedOptions {
	if (!Predicate.isObject(rawOptions)) return EMPTY_OPTIONS;

	const { bannedInstances, bannedProperties } = rawOptions;

	return {
		bannedClasses: normalizeClassBans(bannedInstances),
		bannedProperties: normalizePropertyBans(bannedProperties),
	};
}

function getEnclosingFunctionScope(scope: Scope): Scope {
	let currentScope = scope;

	while (
		currentScope.upper !== null &&
		currentScope.type !== "function" &&
		currentScope.type !== "module" &&
		currentScope.type !== "global"
	) {
		currentScope = currentScope.upper;
	}

	return currentScope;
}

function getInstanceClassName(node: ESTree.NewExpression): string | undefined {
	if (!isNamedGlobalCall(node, "Instance")) return undefined;

	const [firstArgument] = node.arguments;
	if (firstArgument?.type !== "Literal" || !Predicate.isString(firstArgument.value)) return undefined;

	return firstArgument.value;
}

const banInstances = createRule("ban-instances", "roblox", {
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);
		if (options.bannedClasses.size === 0 && options.bannedProperties.size === 0) return {} satisfies Visitor;

		const { sourceCode } = context;
		const { bannedClasses, bannedProperties } = options;
		const trackedVariables = new Map<ScopeVariable, TrackedVariable>();

		function reportBannedClass(node: ESTree.Node, entry: BannedClassEntry): void {
			if (entry.message !== "") {
				context.report({
					data: { className: entry.originalName, customMessage: entry.message },
					messageId: "bannedInstanceCustom",
					node,
				});
				return;
			}

			context.report({
				data: { className: entry.originalName },
				messageId: "bannedInstance",
				node,
			});
		}

		function reportBannedProperty(node: ESTree.Node, className: string, entry: BannedPropertyEntry): void {
			if (entry.message !== "") {
				context.report({
					data: { className, customMessage: entry.message, propertyName: entry.propertyName },
					messageId: "bannedPropertyCustom",
					node,
				});
				return;
			}

			context.report({
				data: { className, propertyName: entry.propertyName },
				messageId: "bannedProperty",
				node,
			});
		}

		function recordTrackedVariable(node: ESTree.VariableDeclarator): void {
			if (node.id.type !== "Identifier" || node.init === null) return;

			const initializer = unwrapExpression(node.init);
			if (initializer.type !== "NewExpression") return;

			const className = getInstanceClassName(initializer);
			if (className === undefined) return;

			const variable = getVariableByName(sourceCode.getScope(node), node.id.name);
			/* v8 ignore next -- @preserve identifier variable declarators have a scope variable in parser scopes. */
			if (variable === undefined) return;

			trackedVariables.set(variable, {
				className,
				classNameKey: className.toLowerCase(),
				functionScope: getEnclosingFunctionScope(variable.scope),
			});
		}

		function getTrackedVariable(identifier: ESTree.IdentifierReference): TrackedVariable | undefined {
			const referenceScope = sourceCode.getScope(identifier);
			const variable = getVariableByName(referenceScope, identifier.name);
			if (variable === undefined) return undefined;

			const trackedVariable = trackedVariables.get(variable);
			if (trackedVariable === undefined) return undefined;
			return trackedVariable.functionScope === getEnclosingFunctionScope(referenceScope)
				? trackedVariable
				: undefined;
		}

		return {
			AssignmentExpression(node): void {
				if (node.left.type !== "MemberExpression") return;

				const propertyName = getMemberPropertyName(node.left);
				if (propertyName === undefined) return;

				const objectExpression = unwrapExpression(node.left.object);
				if (objectExpression.type !== "Identifier") return;

				const trackedVariable = getTrackedVariable(objectExpression);
				if (trackedVariable === undefined) return;

				const bannedPropertiesForClass = bannedProperties.get(trackedVariable.classNameKey);
				if (bannedPropertiesForClass === undefined) return;

				const propertyEntry = bannedPropertiesForClass.get(propertyName.toLowerCase());
				if (propertyEntry !== undefined) {
					reportBannedProperty(node.left, trackedVariable.className, propertyEntry);
				}
			},
			JSXOpeningElement(node): void {
				if (node.name.type !== "JSXIdentifier") return;

				const { name } = node.name;
				const firstCharacter = name.charAt(0);
				if (firstCharacter !== firstCharacter.toLowerCase()) return;

				const classNameKey = name.toLowerCase();
				const entry = bannedClasses.get(classNameKey);
				if (entry !== undefined) reportBannedClass(node, entry);

				const bannedPropertiesForClass = bannedProperties.get(classNameKey);
				if (bannedPropertiesForClass === undefined) return;

				for (const attribute of node.attributes) {
					if (attribute.type !== "JSXAttribute") continue;

					const propertyName = getJsxAttributeName(attribute.name);
					/* v8 ignore next -- @preserve JSXAttribute names are JSXIdentifier names in this visitor branch. */
					if (propertyName === undefined) continue;

					const propertyEntry = bannedPropertiesForClass.get(propertyName.toLowerCase());
					if (propertyEntry !== undefined) reportBannedProperty(attribute, name, propertyEntry);
				}
			},
			NewExpression(node): void {
				const className = getInstanceClassName(node);
				if (className === undefined) return;

				const entry = bannedClasses.get(className.toLowerCase());
				if (entry !== undefined) reportBannedClass(node, entry);
			},
			VariableDeclarator(node): void {
				recordTrackedVariable(node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Ban specified Roblox Instance classes and configured Instance properties.",
		},
		messages: {
			bannedInstance:
				"Instance class '{{className}}' is banned by project configuration. This class may cause performance issues, is deprecated, or has a better alternative. Check project guidelines for the recommended replacement.",
			bannedInstanceCustom: "{{customMessage}}",
			bannedProperty:
				"Property '{{propertyName}}' on Instance class '{{className}}' is banned by project configuration. This property may cause performance issues, is deprecated, or has a better alternative. Check project guidelines for the recommended replacement.",
			bannedPropertyCustom: "{{customMessage}}",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					bannedInstances: {
						description: "Map of banned class names to custom messages, or an array of class names.",
						oneOf: [
							{
								items: { type: "string" },
								type: "array",
							},
							{
								additionalProperties: { type: "string" },
								type: "object",
							},
						],
					},
					bannedProperties: {
						additionalProperties: {
							additionalProperties: { type: "string" },
							type: "object",
						},
						description: "Map of banned class names to maps of banned property names and custom messages.",
						type: "object",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default banInstances;
