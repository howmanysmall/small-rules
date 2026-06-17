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
	if (value === null) return true;
	if (typeof value === "boolean" || typeof value === "number" || isString(value)) return true;
	if (Array.isArray(value)) return value.every(isJsonValue);
	if (!isSchemaRecord.allows(value)) return false;

	return Object.values(value).every(isJsonValue);
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
	if (hint === "constructors") return "Instance";
	if (hint === "bannedInstances" || hint?.toLowerCase().includes("class") === true) return "Part";
	if (hint?.toLowerCase().includes("factory") === true) return "useMemo";
	if (hint?.toLowerCase().includes("importpath") === true) return "@rbxts/react";
	if (hint?.toLowerCase().includes("rule") === true) return "no-console";
	return "value";
}

function getExplicitPlaceholder(schema: SchemaRecord, hint: string | undefined): JsonValue | undefined {
	if (isJsonValue(schema.default)) return schema.default;
	if (Array.isArray(schema.enum) && schema.enum.length > 0) {
		const [firstEnumValue] = schema.enum;
		if (isJsonValue(firstEnumValue)) return firstEnumValue;
	}
	if (Array.isArray(schema.oneOf)) {
		const [firstSchema] = schema.oneOf;
		return createPlaceholder(firstSchema, hint);
	}

	return undefined;
}

function createObjectPlaceholder(schema: SchemaRecord): JsonValue {
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
	if (typeNames.includes("integer") || typeNames.includes("number")) return 0;
	if (typeNames.includes("object")) return createObjectPlaceholder(schema);
	if (typeNames.includes("string")) return createStringPlaceholder(hint);
	return {};
}

function createObjectOptions(schema: SchemaRecord): ReadonlyArray<ObjectOption> {
	if (!isSchemaRecord.allows(schema.properties)) return [];

	const required = new Set(Array.isArray(schema.required) ? schema.required.filter(isString) : []);

	return Object.entries(schema.properties).map(([name, optionSchema]) => {
		const option = isSchemaRecord.allows(optionSchema) ? optionSchema : {};
		return {
			defaultValue: formatInline(option.default),
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

	return createPlaceholder(schema);
}

function createConfiguration(ruleName: RuleName, schema: unknown): string {
	const optionsValue = createOptionsValue(schema);
	let ruleConfig: JsonValue = optionsValue === undefined ? "error" : ["error", optionsValue];

	if (isSchemaRecord.allows(schema) && schema.type === "array") {
		ruleConfig = ["error", createPlaceholder(schema.items)];
	}

	return formatJson({
		jsPlugins: ["@pobammer-ts/small-rules"],
		rules: { [`small-rules/${ruleName}`]: ruleConfig },
	});
}

function getSchemaSummary(schema: unknown): string {
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
