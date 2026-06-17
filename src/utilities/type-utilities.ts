export function isStringRaw(value: unknown): value is string {
	return typeof value === "string";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
	return isStringRaw(value) && value.length > 0;
}

export function isStringArray(object: unknown): object is ReadonlyArray<string> {
	if (!Array.isArray(object)) return false;
	for (const item of object) if (!isStringRaw(item)) return false;
	return true;
}

export function isStringRecord(object: unknown): object is Record<string, string> {
	if (!isRecord(object)) return false;
	for (const entry of Object.values(object)) if (!isStringRaw(entry)) return false;
	return true;
}

export function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

export function isAllowAutofixOption(value: unknown): value is { readonly allowAutofix?: boolean } {
	if (typeof value !== "object" || value === null) return false;
	if (!("allowAutofix" in value)) return true;
	return value.allowAutofix === undefined || typeof value.allowAutofix === "boolean";
}
