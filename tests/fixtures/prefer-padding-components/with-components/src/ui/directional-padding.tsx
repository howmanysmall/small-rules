export interface DirectionalPaddingProperties {
	readonly horizontal?: unknown;
	readonly vertical?: unknown;
}

export function DirectionalPadding({ horizontal, vertical }: DirectionalPaddingProperties): ReadonlyArray<unknown> {
	return [horizontal, vertical];
}
