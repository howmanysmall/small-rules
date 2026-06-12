// @ts-nocheck -- garbage
import React from "@rbxts/react";

export interface LabelSpritesheetProperties {
	readonly children?: React.ReactNode;
}

export function LabelSpritesheet({ children }: LabelSpritesheetProperties): React.ReactNode {
	// oxlint-disable-next-line typescript/no-unsafe-assignment -- it's fine.
	const uiAspectRatioConstraint = <uiaspectratioconstraint AspectRatio={1.5} key="ui-aspect-ratio-constraint" />;

	return (
		<imagelabel BackgroundTransparency={1}>
			{children}
			{uiAspectRatioConstraint}
		</imagelabel>
	);
}

export function RegularLabel({ children }: LabelSpritesheetProperties): React.ReactNode {
	return <imagelabel BackgroundTransparency={1}>{children}</imagelabel>;
}
