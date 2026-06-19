export function isAllowAutofixOption(value: unknown): value is { readonly allowAutofix?: boolean } {
	if (typeof value !== "object" || value === null) return false;
	if (!("allowAutofix" in value)) return true;
	return value.allowAutofix === undefined || typeof value.allowAutofix === "boolean";
}
