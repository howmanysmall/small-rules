export interface PortalProperties {
	readonly children?: unknown;
	readonly target?: unknown;
}

export default function Portal({ target, children }: PortalProperties): unknown {
	return target === undefined ? undefined : children;
}
