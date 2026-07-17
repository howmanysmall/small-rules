import type React from "react";

type BadgeVariant = "error" | "suggestion" | "fixable" | "roblox";

interface BadgeProperties {
	readonly variant: BadgeVariant;
}

interface BadgeDefinition {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly title: string;
}

const errorIcon = (
	<>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" x2="12" y1="8" y2="12" />
		<line x1="12" x2="12.01" y1="16" y2="16" />
	</>
);
const fixableIcon = (
	<>
		<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
		<path d="m14 7 3 3" />
		<path d="M5 6v4" />
		<path d="M19 14v4" />
		<path d="M10 2v2" />
		<path d="M7 8H3" />
		<path d="M21 16h-4" />
		<path d="M11 3H9" />
	</>
);
const robloxIcon = (
	<>
		<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
		<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
		<line x1="12" x2="12" y1="22.08" y2="12" />
	</>
);
const suggestionIcon = (
	<>
		<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
		<path d="M9 18h6" />
		<path d="M10 22h4" />
	</>
);

const badgeDefinitions = {
	error: {
		icon: errorIcon,
		label: "Error",
		title: "This rule reports problems and fails the lint run.",
	},
	fixable: {
		icon: fixableIcon,
		label: "Auto-fixable",
		title: "This rule includes an automatic code fix.",
	},
	roblox: {
		icon: robloxIcon,
		label: "Roblox",
		title: "This rule is specific to Roblox / Luau patterns.",
	},
	suggestion: {
		icon: suggestionIcon,
		label: "Suggestion",
		title: "This rule reports suggestions and does not fail the lint run.",
	},
} satisfies Readonly<Record<BadgeVariant, BadgeDefinition>>;

export function Badge({ variant }: BadgeProperties): React.JSX.Element {
	const definition = badgeDefinitions[variant];

	return (
		<span className={`badge badge--${variant}`} title={definition.title}>
			<svg
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				viewBox="0 0 24 24"
			>
				{definition.icon}
			</svg>
			{definition.label}
		</span>
	);
}
