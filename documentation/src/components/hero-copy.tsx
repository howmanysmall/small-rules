import type { ReactNode } from "react";

interface HeroCopyProperties {
	kicker: string;
	subtitle?: string | undefined;
	title: string;
}

const HERO_ACTIONS = (
	<div className="hero-actions">
		<a className="hero-cta hero-cta--primary" href="/small-rules/quick-start/">
			{"Get started"}
		</a>
		<a
			className="hero-cta hero-cta--ghost"
			href="https://github.com/howmanysmall/small-rules"
			rel="noopener noreferrer"
			target="_blank"
		>
			{"View on GitHub"}
		</a>
	</div>
);

export function HeroCopy({ kicker, subtitle, title }: Readonly<HeroCopyProperties>): ReactNode {
	return (
		<div className="hero-copy">
			<p className="hero-kicker">{kicker}</p>
			<h1 className="hero-title">{title}</h1>
			{subtitle === undefined || subtitle.length === 0 ? undefined : <p className="hero-subtitle">{subtitle}</p>}
			{HERO_ACTIONS}
		</div>
	);
}
