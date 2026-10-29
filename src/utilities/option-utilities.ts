interface AllowAutofix {
	readonly allowAutofix?: boolean | undefined;
}

export function isAllowAutofixOption(value: unknown): value is AllowAutofix {
	if (typeof value !== "object" || value === null) return false;
	if (!("allowAutofix" in value)) return true;
	return value.allowAutofix === undefined || typeof value.allowAutofix === "boolean";
}
