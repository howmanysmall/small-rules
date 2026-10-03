import type { ReactNode } from "react";

interface FeatureCardProperties {
	description: string;
	title: string;
}

export function FeatureCard({ description, title }: Readonly<FeatureCardProperties>): ReactNode {
	return (
		<div className="feature-card">
			<h3 className="feature-card-title">{title}</h3>
			<p className="feature-card-desc">{description}</p>
		</div>
	);
}
