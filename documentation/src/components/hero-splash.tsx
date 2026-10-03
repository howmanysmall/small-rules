import { HeroCopy } from "./hero-copy";
import { HeroGrid } from "./hero-grid";

import type { ReactNode } from "react";

interface HeroSplashProperties {
	kicker?: string | undefined;
	subtitle?: string | undefined;
	title: string;
}

const PREVIEW_CAPTION = <figcaption className="hero-preview-name">{"fig. 1 — .oxlintrc.json"}</figcaption>;

const CONFIGURATION_PREVIEW = (
	<pre className="hero-preview-code">
		<code>
			<span className="t-k">{"{"}</span>
			{"\n\t"}
			<span className="t-p">{'"jsPlugins"'}</span>
			<span className="t-k">{":"}</span> <span className="t-a">{"["}</span>
			<span className="t-s">{'"@pobammer-ts/small-rules"'}</span>
			<span className="t-a">{"]"}</span>
			<span className="t-k">{","}</span>
			{"\n\t"}
			<span className="t-p">{'"rules"'}</span>
			<span className="t-k">{":"}</span> <span className="t-k">{"{"}</span>
			{"\n\t\t"}
			<span className="t-p">{'"small-rules/ban-react-fc"'}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{'"error"'}</span>
			<span className="t-k">{","}</span>
			{"\n\t\t"}
			<span className="t-p">{'"small-rules/no-print"'}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{'"error"'}</span>
			<span className="t-k">{","}</span>
			{"\n\t\t"}
			<span className="t-p">{'"small-rules/prefer-early-return"'}</span>
			<span className="t-k">{":"}</span> <span className="t-s">{'"warn"'}</span>
			{"\n\t"}
			<span className="t-k">{"}"}</span>
			{"\n"}
			<span className="t-k">{"}"}</span>
		</code>
	</pre>
);

const HERO_PREVIEW = (
	<figure aria-label="Code preview" className="hero-preview">
		{PREVIEW_CAPTION}
		{CONFIGURATION_PREVIEW}
	</figure>
);

export function HeroSplash({
	kicker = "Oxlint plugin for roblox-ts",
	subtitle,
	title,
}: Readonly<HeroSplashProperties>): ReactNode {
	return (
		<section className="hero-splash">
			<HeroGrid preview={HERO_PREVIEW}>
				<HeroCopy kicker={kicker} subtitle={subtitle} title={title} />
			</HeroGrid>
		</section>
	);
}
