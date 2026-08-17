export interface PortalProperties {
	readonly target?: unknown;
	readonly children?: unknown;
}

export default function Portal({ target, children }: PortalProperties): unknown {
	return target === undefined ? undefined : children;
}
