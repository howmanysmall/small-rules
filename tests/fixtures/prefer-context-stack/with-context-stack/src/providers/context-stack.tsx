export interface ContextStackProperties {
	readonly providers: ReadonlyArray<unknown>;
	readonly children?: unknown;
}

export default function ContextStack({ providers, children }: ContextStackProperties): ReadonlyArray<unknown> {
	return [providers, children];
}
