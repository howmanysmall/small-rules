export function DirectionalPadding({
	horizontal,
	vertical,
}: {
	readonly horizontal?: unknown;
	readonly vertical?: unknown;
}): ReadonlyArray<unknown> {
	return [horizontal, vertical];
}
