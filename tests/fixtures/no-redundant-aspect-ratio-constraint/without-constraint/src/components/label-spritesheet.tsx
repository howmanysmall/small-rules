// @ts-nocheck
import React from "@rbxts/react";

export interface LabelSpritesheetProperties {
	readonly children?: React.ReactNode;
}

export function LabelSpritesheet({ children }: LabelSpritesheetProperties): React.ReactNode {
	return <imagelabel BackgroundTransparency={1}>{children}</imagelabel>;
}

export function RegularLabel({ children }: LabelSpritesheetProperties): React.ReactNode {
	return <imagelabel BackgroundTransparency={1}>{children}</imagelabel>;
}
