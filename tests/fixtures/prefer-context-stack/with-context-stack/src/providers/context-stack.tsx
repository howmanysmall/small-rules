export interface ContextStackProperties {
	readonly children?: unknown;
	readonly providers: ReadonlyArray<unknown>;
}

export default function ContextStack({ providers, children }: ContextStackProperties): ReadonlyArray<unknown> {
	return [providers, children];
}
