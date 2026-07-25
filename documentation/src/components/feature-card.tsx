import { Icon } from "./icon";

import type { ReactNode } from "react";

import type { IconName } from "./icon";

interface FeatureCardProperties {
	readonly description: string;
	readonly icon: IconName;
	readonly title: string;
}

export function FeatureCard({ description, icon, title }: FeatureCardProperties): ReactNode {
	return (
		<div className="feature-card">
			<div className="feature-card-icon">
				<Icon name={icon} size={20} />
			</div>
			<h3 className="feature-card-title">{title}</h3>
			<p className="feature-card-desc">{description}</p>
		</div>
	);
}
