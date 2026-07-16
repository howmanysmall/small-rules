import smallRules from "$small-rules";
import { type } from "arktype";

type JsonValue = boolean | null | number | string | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue };
export type RuleName = keyof typeof smallRules.rules;

const isSchemaRecord = type("Record<string, unknown>").readonly();
type SchemaRecord = typeof isSchemaRecord.infer;

interface ObjectOption {
	readonly defaultValue: string;
	readonly description: string | undefined;
	readonly name: string;
	readonly required: boolean;
	readonly type: string;
}

export interface RuleOptionsDocumentation {
	readonly config: string;
	readonly options: ReadonlyArray<ObjectOption>;
	readonly schemaSummary: string;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isJsonValue(value: unknown): value is JsonValue {
	if (value === null || typeof value === "boolean" || typeof value === "number" || isString(value)) return true;
	if (Array.isArray(value)) {
		for (const subValue of value) if (!isJsonValue(subValue)) return false;
		return true;
	}
	if (!isSchemaRecord.allows(value)) return false;

	for (const subValue of Object.values(value)) if (!isJsonValue(subValue)) return false;
	return true;
}

function getRuleSchema(ruleName: RuleName): unknown {
	const rule = smallRules.rules[ruleName];
	const { meta } = rule;
	if (meta === undefined) {
		const error = new Error(`Rule "${ruleName}" is missing metadata.`);
		Error.captureStackTrace(error, getRuleSchema);
		throw error;
	}

	return meta.schema;
}

function formatJson(value: JsonValue): string {
	return JSON.stringify(value, undefined, "\t");
}

function formatInline(value: unknown): string {
	if (value === undefined) return "-";
	if (isString(value)) return value;
	return JSON.stringify(value);
}

function formatDefaultValue(schema: SchemaRecord): string {
	if (isString(schema.defaultLabel)) return schema.defaultLabel;
	return formatInline(schema.default);
}

function getSchemaTypeNames(schema: SchemaRecord): ReadonlyArray<string> {
	if (isString(schema.type)) return [schema.type];
	if (Array.isArray(schema.type)) return schema.type.filter(isString);
	if (schema.items !== undefined) return ["array"];
	if (schema.properties !== undefined || schema.additionalProperties !== undefined) return ["object"];
	return [];
}

function joinTypes(types: ReadonlyArray<string>): string {
	return [...new Set(types)].join(" | ");
}

const exactStringPlaceholders = new Map([
	["additionalAssertionFunctions", "expectPresent"],
	["additionalExpectCallNames", "expect"],
	["additionalHoistableComponents", "IconSprite"],
	["additionalStaticFactories", "Vector3"],
	["allow", "oxlint-disable"],
	["allowPropertyAccess", "Roact"],
	["alternatives", "begin"],
	["bannedInstances", "Part"],
	["bannedTypes", "Readonly"],
	["closer", "cleanup"],
	["constructors", "Instance"],
	["directive-no-restricted-disable", "no-console"],
	["ignore", "oxlint-disable"],
	["ignoreComponents", "LegacyPanel"],
	["ignoreHooks", "useEntity"],
	["ignoreShorthands", "props"],
	["eventsImportPaths", "server/networking"],
	["loopExitCalls", "task.wait"],
	["name", "useCustomEffect"],
	["onlyHooks", "useState"],
	["opener", "setup"],
	["openerAlternatives", "begin"],
	["staticGlobalFactories", "Vector3"],
	["yieldingFunctions", "task.wait"],
]);

const partialStringPlaceholders = [
	{ match: "class", value: "Part" },
	{ match: "factory", value: "useMemo" },
	{ match: "importpath", value: "@rbxts/react" },
	{ match: "rule", value: "no-console" },
];

const objectPlaceholders = new Map<string, JsonValue>([
	["allow", { name: "ValidationError" }],
	["bannedProperties", { UISizeConstraint: { MaxSize: "Use a different constraint shape." } }],
	["classes", { Log: "@rbxts/rbxts-sleitnick-log" }],
]);

function getRuleConfigOverride(ruleName: RuleName): JsonValue | undefined {
	switch (ruleName) {
		case "prevent-abbreviations": {
			return "error";
		}

		case "require-named-effect-functions": {
			return [
				"error",
				{
					environment: "roblox-ts",
					hooks: [
						{ allowAsync: false, name: "useEffect" },
						{ allowAsync: false, name: "useLayoutEffect" },
						{ allowAsync: false, name: "useInsertionEffect" },
					],
				},
			];
		}

		case "require-paired-calls": {
			return [
				"error",
				{
					allowConditionalClosers: false,
					allowMultipleOpeners: true,
					maxNestingDepth: 0,
					pairs: [
						{
							alternatives: ["finish"],
							closer: "cleanup",
							opener: "setup",
							openerAlternatives: ["begin"],
							platform: "roblox",
							requireSync: false,
							yieldingFunctions: ["task.wait"],
						},
					],
				},
			];
		}

		case "require-react-component-keys": {
			return [
				"error",
				{
					allowRootKeys: false,
					ignoreCallExpressions: [
						"ReactTree.mount",
						"CreateReactStory",
						"createReactStory",
						"createPlatformStory",
					],
					iterationMethods: [
						"map",
						"filter",
						"forEach",
						"flatMap",
						"reduce",
						"reduceRight",
						"some",
						"every",
						"find",
						"findIndex",
					],
					memoizationHooks: ["useCallback", "useMemo"],
				},
			];
		}

		case "use-exhaustive-dependencies": {
			return [
				"error",
				{
					hooks: [
						{
							closureIndex: 0,
							dependenciesIndex: 1,
							name: "useCustomEffect",
							stableResult: false,
						},
					],
					reportMissingDependenciesArray: true,
					reportUnnecessaryDependencies: true,
					reportUnnecessaryStableDependencies: false,
					resolveExpressionDependencies: true,
				},
			];
		}

		default: {
			return undefined;
		}
	}
}

function getObjectSchemaType(schema: SchemaRecord): string {
	if (isSchemaRecord.allows(schema.properties)) {
		const required = new Set(Array.isArray(schema.required) ? schema.required.filter(isString) : []);
		const properties = Object.entries(schema.properties).map(([propertyName, propertySchema]) => {
			const optional = required.has(propertyName) ? "" : "?";
			const propertyType = isSchemaRecord.allows(propertySchema) ? getSchemaType(propertySchema) : "unknown";
			return `${propertyName}${optional}: ${propertyType}`;
		});
		return `{ ${properties.join("; ")} }`;
	}

	if (isSchemaRecord.allows(schema.additionalProperties)) {
		return `Record<string, ${getSchemaType(schema.additionalProperties)}>`;
	}

	return "Record<string, unknown>";
}

function getSchemaType(schema: SchemaRecord): string {
	if (schema.const !== undefined) return JSON.stringify(schema.const);
	if (Array.isArray(schema.enum)) return schema.enum.map((entry) => JSON.stringify(entry)).join(" | ");
	if (Array.isArray(schema.oneOf)) {
		return schema.oneOf
			.map((entry) => (isSchemaRecord.allows(entry) ? getSchemaType(entry) : "unknown"))
			.join(" | ");
	}
	if (Array.isArray(schema.anyOf)) {
		return schema.anyOf
			.map((entry) => (isSchemaRecord.allows(entry) ? getSchemaType(entry) : "unknown"))
			.join(" | ");
	}

	const typeNames = getSchemaTypeNames(schema);
	if (typeNames.includes("array")) {
		if (Array.isArray(schema.items)) {
			return `[${schema.items.map((item) => (isSchemaRecord.allows(item) ? getSchemaType(item) : "unknown")).join(", ")}]`;
		}
		return `Array<${isSchemaRecord.allows(schema.items) ? getSchemaType(schema.items) : "unknown"}>`;
	}
	if (typeNames.includes("object")) return getObjectSchemaType(schema);
	if (typeNames.length > 0) return joinTypes(typeNames);

	return "unknown";
}

function createStringPlaceholder(hint: string | undefined): string {
	const exactPlaceholder = hint === undefined ? undefined : exactStringPlaceholders.get(hint);
	if (exactPlaceholder !== undefined) return exactPlaceholder;

	const normalizedHint = hint?.toLowerCase();
	const partialPlaceholder = partialStringPlaceholders.find(({ match }) => normalizedHint?.includes(match) === true);
	return partialPlaceholder?.value ?? "value";
}

function getExplicitPlaceholder(schema: SchemaRecord, hint: string | undefined): JsonValue | undefined {
	if (isJsonValue(schema.default)) return schema.default;
	if (Array.isArray(schema.enum) && schema.enum.length > 0) {
		const [firstEnumValue] = schema.enum;
		if (isJsonValue(firstEnumValue)) return firstEnumValue;
	}
	if (Array.isArray(schema.anyOf)) {
		const matchingSchema = schema.anyOf.find(
			(entry) =>
				isSchemaRecord.allows(entry) &&
				getSchemaTypeNames(entry).includes("object") &&
				hint !== undefined &&
				objectPlaceholders.has(hint),
		);
		return createPlaceholder(matchingSchema ?? schema.anyOf[0], hint);
	}
	if (Array.isArray(schema.oneOf)) {
		const [firstSchema] = schema.oneOf;
		return createPlaceholder(firstSchema, hint);
	}

	return undefined;
}

function createNumberPlaceholder(schema: SchemaRecord): number {
	if (typeof schema.default === "number") return schema.default;
	if (typeof schema.minimum === "number") return schema.minimum;
	return 0;
}

function createObjectPlaceholder(schema: SchemaRecord, hint: string | undefined): JsonValue {
	const knownPlaceholder = hint === undefined ? undefined : objectPlaceholders.get(hint);
	if (knownPlaceholder !== undefined) return knownPlaceholder;
	if (!isSchemaRecord.allows(schema.properties)) return {};

	const placeholder: Record<string, JsonValue> = {};
	for (const [propertyName, propertySchema] of Object.entries(schema.properties)) {
		placeholder[propertyName] = createPlaceholder(propertySchema, propertyName);
	}
	return placeholder;
}

function createPlaceholder(schema: unknown, hint?: string): JsonValue {
	if (!isSchemaRecord.allows(schema)) return {};
	const explicitPlaceholder = getExplicitPlaceholder(schema, hint);
	if (explicitPlaceholder !== undefined) return explicitPlaceholder;

	const typeNames = getSchemaTypeNames(schema);
	if (typeNames.includes("array")) return schema.items === undefined ? [] : [createPlaceholder(schema.items, hint)];
	if (typeNames.includes("boolean")) return false;
	if (typeNames.includes("integer") || typeNames.includes("number")) return createNumberPlaceholder(schema);
	if (typeNames.includes("object")) return createObjectPlaceholder(schema, hint);
	if (typeNames.includes("string")) return createStringPlaceholder(hint);
	return {};
}

function createObjectOptions(schema: SchemaRecord): ReadonlyArray<ObjectOption> {
	if (!isSchemaRecord.allows(schema.properties)) return [];

	const required = new Set(Array.isArray(schema.required) ? schema.required.filter(isString) : []);

	return Object.entries(schema.properties).map(([name, optionSchema]) => {
		const option = isSchemaRecord.allows(optionSchema) ? optionSchema : {};
		return {
			defaultValue: formatDefaultValue(option),
			description: isString(option.description) ? option.description : undefined,
			name,
			required: required.has(name),
			type: getSchemaType(option),
		};
	});
}

function createOptionsValue(schema: unknown): JsonValue | undefined {
	if (Array.isArray(schema)) {
		const [firstOptionSchema] = schema;
		if (firstOptionSchema === undefined) return undefined;
		return createPlaceholder(firstOptionSchema);
	}

	if (schema === undefined) return undefined;
	return createPlaceholder(schema);
}

function createConfiguration(ruleName: RuleName, schema: unknown): string {
	const override = getRuleConfigOverride(ruleName);
	if (override !== undefined) {
		return formatJson({
			jsPlugins: ["@pobammer-ts/small-rules"],
			rules: { [`small-rules/${ruleName}`]: override },
		});
	}

	const optionsValue = createOptionsValue(schema);
	let ruleConfig: JsonValue = optionsValue === undefined ? "error" : ["error", optionsValue];

	if (isSchemaRecord.allows(schema) && schema.type === "array") {
		ruleConfig = ["error", createPlaceholder(schema.items, ruleName)];
	}

	return formatJson({
		jsPlugins: ["@pobammer-ts/small-rules"],
		rules: { [`small-rules/${ruleName}`]: ruleConfig },
	});
}

function getSchemaSummary(schema: unknown): string {
	if (schema === undefined) return "This rule does not accept options.";
	if (Array.isArray(schema)) {
		if (schema.length === 0) return "This rule does not accept options.";
		return "This rule accepts one options object after the severity.";
	}
	if (isSchemaRecord.allows(schema) && schema.type === "array") {
		return "This rule accepts positional array options after the severity.";
	}
	return "This rule exposes a custom options schema.";
}

export function getRuleOptionsDocumentation(ruleName: RuleName): RuleOptionsDocumentation {
	const schema = getRuleSchema(ruleName);
	const optionSchema = Array.isArray(schema) ? schema[0] : schema;

	return {
		config: createConfiguration(ruleName, schema),
		options:
			isSchemaRecord.allows(optionSchema) && optionSchema.type === "object"
				? createObjectOptions(optionSchema)
				: [],
		schemaSummary: getSchemaSummary(schema),
	};
}
