export default function ContextStack({
	providers,
	children,
}: {
	readonly children?: unknown;
	readonly providers: ReadonlyArray<unknown>;
}): ReadonlyArray<unknown> {
	return [providers, children];
}
