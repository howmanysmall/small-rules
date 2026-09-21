import type { PropsWithChildren, ReactNode } from "react";

interface HeroGridProperties {
	preview: ReactNode;
}

export function HeroGrid({ preview, children }: Readonly<PropsWithChildren<HeroGridProperties>>): ReactNode {
	return (
		<div className="hero-grid">
			{children}
			{preview}
		</div>
	);
}
