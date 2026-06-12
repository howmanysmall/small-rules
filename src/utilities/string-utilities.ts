const UPPERCASE_PATTERN = /^[A-Z]/u;

export function isUppercaseName(name: string): boolean {
	return UPPERCASE_PATTERN.test(name);
}
