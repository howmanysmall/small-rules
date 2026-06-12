// @ts-nocheck -- don't care.
import type React from "@rbxts/react";

export const enum ImageType {
	Button = 0,
	Label = 1,
}

export interface GenericSpritesheetProperties {
	readonly children?: React.ReactNode;
	readonly imageType: ImageType;
}

export function GenericSpritesheet({ imageType }: GenericSpritesheetProperties): React.ReactNode {
	return <>{imageType}</>;
}
