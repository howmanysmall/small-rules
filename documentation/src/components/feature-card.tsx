import { Icon } from "./icon";

import type { ReactNode } from "react";

import type { IconName } from "./icon";

interface FeatureCardProperties {
	description: string;
	icon: IconName;
	title: string;
}

export function FeatureCard({ description, icon, title }: Readonly<FeatureCardProperties>): ReactNode {
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
