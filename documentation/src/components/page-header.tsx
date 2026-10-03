import type { ReactNode } from "react";

interface PageHeaderProperties {
	kicker?: string | undefined;
	subtitle?: string | undefined;
	title: string;
}

export function PageHeader({ kicker, subtitle, title }: Readonly<PageHeaderProperties>): ReactNode {
	let kickerElement: ReactNode;
	if (kicker !== undefined && kicker.length > 0) {
		kickerElement = <p className="hero-kicker">{kicker}</p>;
	}

	let subtitleElement: ReactNode;
	if (subtitle !== undefined && subtitle.length > 0) {
		subtitleElement = <p className="hero-subtitle hero-subtitle--compact">{subtitle}</p>;
	}

	return (
		<section className="hero-splash hero-splash--compact">
			<div className="hero-copy">
				{kickerElement}
				<h1 className="hero-title hero-title--compact">{title}</h1>
				{subtitleElement}
			</div>
		</section>
	);
}
