export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function getProperty(value: unknown, key: string): unknown {
	if (!isRecord(value)) return undefined;
	return value[key];
}

export function getStringProperty(value: unknown, key: string): string | undefined {
	const property = getProperty(value, key);
	return typeof property === "string" ? property : undefined;
}

export function getBooleanProperty(value: unknown, key: string): boolean | undefined {
	const property = getProperty(value, key);
	return typeof property === "boolean" ? property : undefined;
}

export function getArrayProperty(value: unknown, key: string): ReadonlyArray<unknown> | undefined {
	const property = getProperty(value, key);
	return Array.isArray(property) ? property : undefined;
}

export function getObjectProperty(value: unknown, key: string): Record<string, unknown> | undefined {
	const property = getProperty(value, key);
	return isRecord(property) ? property : undefined;
}

export function hasProperty(value: unknown, key: string): boolean {
	return isRecord(value) && key in value;
}

export function isFunction(value: unknown): value is (...parameters: Array<unknown>) => unknown {
	return typeof value === "function";
}

export function isJsonSerializable(value: unknown): boolean {
	if (value === null) return true;
	const valueType = typeof value;
	if (valueType === "string" || valueType === "boolean") return true;
	if (valueType === "number") return Number.isFinite(value);
	if (valueType !== "object") return false;
	if (Array.isArray(value)) return value.every(isJsonSerializable);
	if (!isRecord(value)) return false;

	for (const [key, property] of Object.entries(value)) {
		if (key === "__proto__") return false;
		if (!isJsonSerializable(property)) return false;
	}

	return true;
}
