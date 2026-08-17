import type { PropsWithChildren, ReactNode } from "react";

interface HeroGridProperties {
	readonly preview: ReactNode;
}

export function HeroGrid({ preview, children }: PropsWithChildren<HeroGridProperties>): ReactNode {
	return (
		<div className="hero-grid">
			{children}
			{preview}
		</div>
	);
}
