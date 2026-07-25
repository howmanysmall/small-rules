import { Icon } from "./icon";

import type { ReactNode } from "react";

interface HeroCopyProperties {
	readonly kicker: string;
	readonly subtitle?: string | undefined;
	readonly title: string;
}

const HERO_ACTIONS = (
	<div className="hero-actions">
		<a className="hero-cta hero-cta--primary" href="/small-rules/quick-start/">
			<Icon name="rocket" size={16} />
			<span>{"Get started"}</span>
		</a>
		<a
			className="hero-cta hero-cta--ghost"
			href="https://github.com/howmanysmall/small-rules"
			rel="noopener noreferrer"
			target="_blank"
		>
			<Icon name="github" size={16} />
			<span>{"View on GitHub"}</span>
		</a>
	</div>
);
const SPARKLES = <Icon name="sparkles" size={14} />;

export function HeroCopy({ kicker, subtitle, title }: HeroCopyProperties): ReactNode {
	return (
		<div className="hero-copy">
			<span className="hero-kicker hero-kicker--static">
				{SPARKLES}
				<span>{kicker}</span>
			</span>
			<h1 className="hero-title">{title}</h1>
			{subtitle === undefined || subtitle.length === 0 ? undefined : <p className="hero-subtitle">{subtitle}</p>}
			{HERO_ACTIONS}
		</div>
	);
}
