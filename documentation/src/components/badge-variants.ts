const badgeVariants = ["error", "fixable", "new", "roblox", "suggestion", "updated"] as const;

export type BadgeVariant = (typeof badgeVariants)[number];

const badgeVariantSet: ReadonlySet<string> = new Set(badgeVariants);

export function isBadgeVariant(value?: string): value is BadgeVariant {
	return value !== undefined && badgeVariantSet.has(value);
}
