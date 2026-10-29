interface Properties {
	readonly providers: ReadonlyArray<unknown>;
	readonly children?: unknown;
}

export default function ContextStack({ providers, children }: Properties): ReadonlyArray<unknown> {
	return [providers, children];
}
