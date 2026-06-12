export interface EqualPaddingProperties {
	readonly padding?: unknown;
}

function EqualPadding({ padding }: EqualPaddingProperties): unknown {
	return padding;
}

export default EqualPadding;
