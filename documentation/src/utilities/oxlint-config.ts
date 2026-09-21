import { Predicate } from "effect";

type PrimitiveJsonValue = boolean | null | number | string;
type JsonValue = PrimitiveJsonValue | ReadonlyArray<JsonValue> | { readonly [key: string]: JsonValue };

type JsonRecord = Readonly<Record<string, JsonValue>>;

const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;
const INLINE_ARRAY_LIMIT = 100;
const INDENT = "\t";
const CONFIG_HEADER = 'import { defineConfig } from "oxlint";';

function createIndent(depth: number): string {
	return INDENT.repeat(depth);
}

function isPrimitiveJsonValue(value: unknown): value is PrimitiveJsonValue {
	return value === null || Predicate.isBoolean(value) || Predicate.isNumber(value) || Predicate.isString(value);
}

export function isJsonValue(value: unknown): value is JsonValue {
	if (isPrimitiveJsonValue(value)) return true;

	if (Array.isArray(value)) {
		for (const subValue of value) if (!isJsonValue(subValue)) return false;
		return true;
	}

	if (!Predicate.isReadonlyObject(value)) return false;

	for (const subValue of Object.values(value)) {
		if (!isJsonValue(subValue)) return false;
	}
	return true;
}

function isJsonArray(value: JsonValue): value is ReadonlyArray<JsonValue> {
	return Array.isArray(value);
}

function isJsonPrimitive(value: JsonValue): value is boolean | null | number | string {
	return value === null || Predicate.isBoolean(value) || Predicate.isNumber(value) || Predicate.isString(value);
}

function isJsonRecord(value: JsonValue): value is JsonRecord {
	return Predicate.isReadonlyObject(value);
}

function renderKey(key: string): string {
	return IDENTIFIER_PATTERN.test(key) ? key : JSON.stringify(key);
}

function renderValue(value: JsonValue, depth: number): string {
	if (isJsonArray(value)) return renderArray(value, depth);
	if (isJsonRecord(value)) return renderObject(value, depth);
	return JSON.stringify(value);
}

function renderInlineItems(values: ReadonlyArray<JsonValue>): string {
	return values.map((item) => JSON.stringify(item)).join(", ");
}

function renderArrayItem(item: JsonValue, depth: number, padding: string): string {
	return padding + renderValue(item, depth);
}

function renderArray(values: ReadonlyArray<JsonValue>, depth: number): string {
	if (values.length === 0) return "[]";
	if (values.every(isJsonPrimitive)) {
		const inline = `[${renderInlineItems(values)}]`;
		if (inline.length <= INLINE_ARRAY_LIMIT) return inline;
	}

	const padding = createIndent(depth);
	const itemPadding = createIndent(depth + 1);
	const items = values.map((item) => renderArrayItem(item, depth + 1, itemPadding)).join(",\n");
	return `[\n${items},\n${padding}]`;
}

function renderField(key: string, value: JsonValue, depth: number, padding: string): string {
	return `${padding}${renderKey(key)}: ${renderValue(value, depth)}`;
}

function renderObject(fields: JsonRecord, depth: number): string {
	const entries = Object.entries(fields);
	if (entries.length === 0) return "{}";

	const padding = createIndent(depth);
	const itemPadding = createIndent(depth + 1);
	const body = entries.map(([key, value]) => renderField(key, value, depth + 1, itemPadding)).join(",\n");
	return `{\n${body},\n${padding}}`;
}

function parseJsonValue(jsonText: string): JsonValue {
	const parsed: unknown = JSON.parse(jsonText);
	if (!isJsonValue(parsed)) {
		throw new TypeError("Expected the configuration text to parse as a JSON value.");
	}

	return parsed;
}

export function formatJsonSource(jsonText: string): string {
	return `${JSON.stringify(parseJsonValue(jsonText), undefined, INDENT)}\n`;
}

export function toTsConfigSource(jsonText: string): string {
	return `${CONFIG_HEADER}\n\nexport default defineConfig(${renderValue(parseJsonValue(jsonText), 0)});`;
}
