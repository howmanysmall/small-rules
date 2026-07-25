import { HeroCopy } from "./hero-copy";
import { HeroGrid } from "./hero-grid";

import type { ReactNode } from "react";

interface HeroSplashProperties {
	readonly kicker?: string | undefined;
	readonly subtitle?: string | undefined;
	readonly title: string;
}

const PREVIEW_CHROME = (
	<div className="hero-preview-chrome">
		<span className="hero-preview-dot hero-preview-dot--r" />
		<span className="hero-preview-dot hero-preview-dot--y" />
		<span className="hero-preview-dot hero-preview-dot--g" />
		<span className="hero-preview-name">{".oxlintrc.json"}</span>
	</div>
);

const CONFIGURATION_PREVIEW = (
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

const HERO_PREVIEW = (
	<div aria-label="Code preview" className="hero-preview">
		{PREVIEW_CHROME}
		{CONFIGURATION_PREVIEW}
	</div>
);

export function HeroSplash({
	kicker = "Oxlint plugin for roblox-ts",
	subtitle,
	title,
}: HeroSplashProperties): ReactNode {
	return (
		<section className="hero-splash">
			<HeroGrid preview={HERO_PREVIEW}>
				<HeroCopy kicker={kicker} subtitle={subtitle} title={title} />
			</HeroGrid>
		</section>
	);
}
