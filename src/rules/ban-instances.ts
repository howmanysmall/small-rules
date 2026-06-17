import { getMemberPropertyName, getVariableByName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { isRecord, isStringArray, isStringRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, Scope, Visitor } from "oxlint-plugin-utilities";

interface BannedClassEntry {
	readonly message?: string | undefined;
	readonly originalName: string;
}

interface BannedPropertyEntry {
	readonly message: string;
	readonly propertyName: string;
}

interface TrackedVariable {
	readonly className: string;
	readonly functionScope: Scope;
}

function getJsxAttributeName(name: ESTree.JSXAttributeName): string | undefined {
	return name.type === "JSXIdentifier" ? name.name : name.name.name;
}

function normalizeConfiguration(rawOptions: unknown): ReadonlyMap<string, BannedClassEntry> {
	if (!(isRecord(rawOptions) && "bannedInstances" in rawOptions)) return new Map();

	const { bannedInstances } = rawOptions;
	const bannedClasses = new Map<string, BannedClassEntry>();

	if (isStringArray(bannedInstances)) {
		for (const className of bannedInstances) {
			bannedClasses.set(className.toLowerCase(), { message: undefined, originalName: className });
		}
		return bannedClasses;
	}

	if (isStringRecord(bannedInstances)) {
		for (const [className, message] of Object.entries(bannedInstances)) {
			bannedClasses.set(className.toLowerCase(), { message, originalName: className });
		}
	}

	return bannedClasses;
}

function normalizePropertyConfiguration(
	rawOptions: unknown,
): ReadonlyMap<string, ReadonlyMap<string, BannedPropertyEntry>> {
	if (!(isRecord(rawOptions) && "bannedProperties" in rawOptions)) return new Map();

	const { bannedProperties } = rawOptions;
	const bannedClasses = new Map<string, ReadonlyMap<string, BannedPropertyEntry>>();

	if (!isRecord(bannedProperties)) return bannedClasses;

	for (const [className, propertyConfiguration] of Object.entries(bannedProperties)) {
		if (!isRecord(propertyConfiguration)) continue;

		const bannedPropertiesForClass = new Map<string, BannedPropertyEntry>();
		for (const [propertyName, message] of Object.entries(propertyConfiguration)) {
			if (typeof message !== "string") continue;

			bannedPropertiesForClass.set(propertyName.toLowerCase(), { message, propertyName });
		}

		if (bannedPropertiesForClass.size > 0) {
			bannedClasses.set(className.toLowerCase(), bannedPropertiesForClass);
		}
	}

	return bannedClasses;
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
	if (node.callee.type !== "Identifier" || node.callee.name !== "Instance") return undefined;

	const [firstArgument] = node.arguments;
	if (firstArgument?.type !== "Literal" || typeof firstArgument.value !== "string") return undefined;

	return firstArgument.value;
}

function getVariableDeclaratorForNewExpression(node: ESTree.NewExpression): ESTree.VariableDeclarator | undefined {
	const { parent } = node;
	if (parent?.type !== "VariableDeclarator" || parent.init !== node || parent.id.type !== "Identifier") {
		return undefined;
	}
	return parent;
}

const banInstances = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const [rawOptions] = context.options;
		if (rawOptions === undefined || typeof rawOptions !== "object" || rawOptions === null) {
			return {} satisfies Visitor;
		}

		const bannedClasses = normalizeConfiguration(rawOptions);
		const bannedProperties = normalizePropertyConfiguration(rawOptions);
		if (bannedClasses.size === 0 && bannedProperties.size === 0) return {} satisfies Visitor;

		const trackedVariables = new Map<ScopeVariable, TrackedVariable>();
		const recordedDeclarators = new Set<ESTree.VariableDeclarator>();

		function reportBannedClass(node: ESTree.Node, entry: BannedClassEntry): void {
			if (entry.message !== undefined && entry.message !== "") {
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
			if (recordedDeclarators.has(node) || node.id.type !== "Identifier" || node.init === null) return;

			const initializer = unwrapExpression(node.init);
			if (initializer.type !== "NewExpression") return;

			const className = getInstanceClassName(initializer);
			if (className === undefined) return;

			const variable = getVariableByName(sourceCode.getScope(node), node.id.name);
			if (variable === undefined) return;

			trackedVariables.set(variable, {
				className,
				functionScope: getEnclosingFunctionScope(variable.scope),
			});
			recordedDeclarators.add(node);
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

				const bannedPropertiesForClass = bannedProperties.get(trackedVariable.className.toLowerCase());
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

				const entry = bannedClasses.get(name.toLowerCase());
				if (entry !== undefined) reportBannedClass(node, entry);

				const bannedPropertiesForClass = bannedProperties.get(name.toLowerCase());
				if (bannedPropertiesForClass === undefined) return;

				for (const attribute of node.attributes) {
					if (attribute.type !== "JSXAttribute") continue;

					const propertyName = getJsxAttributeName(attribute.name);
					if (propertyName === undefined) continue;

					const propertyEntry = bannedPropertiesForClass.get(propertyName.toLowerCase());
					if (propertyEntry !== undefined) reportBannedProperty(attribute, name, propertyEntry);
				}
			},
			NewExpression(node): void {
				const className = getInstanceClassName(node);
				if (className === undefined) return;

				const variableDeclarator = getVariableDeclaratorForNewExpression(node);
				if (variableDeclarator !== undefined) recordTrackedVariable(variableDeclarator);

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
