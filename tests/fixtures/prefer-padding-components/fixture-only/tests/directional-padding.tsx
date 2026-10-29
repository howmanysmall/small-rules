interface Properties {
	readonly horizontal?: unknown;
	readonly vertical?: unknown;
}

export function DirectionalPadding({ horizontal, vertical }: Properties): ReadonlyArray<unknown> {
	return [horizontal, vertical];
}
