import { Icon } from "./icon";

import type React from "react";

interface PageHeaderProperties {
	readonly kicker?: string;
	readonly subtitle?: string;
	readonly title: string;
}

const heroOrbs = (
	<div aria-hidden="true" className="hero-orbs">
		<span className="hero-orb hero-orb--1" />
		<span className="hero-orb hero-orb--2" />
		<span className="hero-orb hero-orb--3" />
	</div>
);

export function PageHeader({ kicker, subtitle, title }: PageHeaderProperties): React.JSX.Element {
	let kickerElement: React.JSX.Element | undefined;
	if (kicker !== undefined && kicker.length > 0) {
		kickerElement = (
			<span className="hero-kicker hero-kicker--static">
				<Icon name="sparkles" size={14} />
				<span>{kicker}</span>
			</span>
		);
	}

	let subtitleElement: React.JSX.Element | undefined;
	if (subtitle !== undefined && subtitle.length > 0) {
		subtitleElement = <p className="hero-subtitle hero-subtitle--compact">{subtitle}</p>;
	}

	return (
		<section className="hero-splash hero-splash--compact">
			{heroOrbs}
			<div className="hero-copy hero-copy--centered">
				{kickerElement}
				<h1 className="hero-title hero-title--compact">{title}</h1>
				{subtitleElement}
			</div>
		</section>
	);
}
