import type { ReactNode, PropsWithChildren } from "react";

interface HeroGridProperties {
	readonly preview: ReactNode;
}

export function HeroGrid({ children, preview }: PropsWithChildren<HeroGridProperties>): ReactNode {
	return (
		<div className="hero-grid">
			{children}
			{preview}
		</div>
	);
}
