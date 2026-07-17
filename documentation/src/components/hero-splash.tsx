import { createElement } from "react";

import { Icon } from "./icon";

import type { JSX } from "react";

interface HeroSplashProperties {
	readonly kicker?: string;
	readonly subtitle?: string;
	readonly title: string;
}

const heroActions = (
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

const previewChrome = (
	<div className="hero-preview-chrome">
		<span className="hero-preview-dot hero-preview-dot--r" />
		<span className="hero-preview-dot hero-preview-dot--y" />
		<span className="hero-preview-dot hero-preview-dot--g" />
		<span className="hero-preview-name">{".oxlintrc.json"}</span>
	</div>
);

const configurationPreview = (
	<pre className="hero-preview-code">
		<code>
			<span className="t-k">{"{"}</span>
			{"\n\t"}
			<span className="t-s">{`"jsPlugins"`}</span>
			<span className="t-k">{":"}</span> <span className="t-a">{"["}</span>
			<span className="t-s">{`"@pobammer-ts/small-rules"`}</span>
			<span className="t-a">{"]"}</span>
			<span className="t-k">{","}</span>
			{"\n\t"}
			<span className="t-s">{`"rules"`}</span>
			<span className="t-k">{":"}</span> <span className="t-k">{"{"}</span>
			{"\n\t\t"}
			<span className="t-s">{`"small-rules/ban-react-fc"`}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{`"error"`}</span>
			<span className="t-k">{","}</span>
			{"\n\t\t"}
			<span className="t-s">{`"small-rules/no-print"`}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{`"error"`}</span>
			<span className="t-k">{","}</span>
			{"\n\t\t"}
			<span className="t-s">{`"small-rules/prefer-early-return"`}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{`"warn"`}</span>
			{"\n\t"}
			<span className="t-k">{"}"}</span>
			{"\n"}
			<span className="t-k">{"}"}</span>
		</code>
	</pre>
);

const heroPreview = (
	<div aria-label="Code preview" className="hero-preview">
		{previewChrome}
		{configurationPreview}
	</div>
);

export function HeroSplash({
	kicker = "Oxlint plugin for roblox-ts",
	subtitle,
	title,
}: HeroSplashProperties): JSX.Element {
	let heroSubtitle: JSX.Element | undefined;
	if (subtitle !== undefined && subtitle.length > 0) {
		heroSubtitle = <p className="hero-subtitle">{subtitle}</p>;
	}
	const heroKicker = (
		<span className="hero-kicker hero-kicker--static">
			<Icon name="sparkles" size={14} />
			<span>{kicker}</span>
		</span>
	);
	const heroCopy = (
		<div className="hero-copy">
			{heroKicker}
			<h1 className="hero-title">{title}</h1>
			{heroSubtitle}
			{heroActions}
		</div>
	);

	return createElement(
		"section",
		{ className: "hero-splash" },
		createElement("div", { className: "hero-grid" }, heroCopy, heroPreview),
	);
}
