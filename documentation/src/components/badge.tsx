import type { ReactNode } from "react";

type BadgeVariant = "error" | "new" | "suggestion" | "fixable" | "roblox";

interface BadgeProperties {
	readonly variant: BadgeVariant;
}

interface BadgeDefinition {
	readonly icon: ReactNode;
	readonly label: string;
	readonly title: string;
}

const ERROR_ICON = (
	<>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" x2="12" y1="8" y2="12" />
		<line x1="12" x2="12.01" y1="16" y2="16" />
	</>
);
const FIXABLE_ICON = (
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
const ROBLOX_ICON = (
	<>
		<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
		<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
		<line x1="12" x2="12" y1="22.08" y2="12" />
	</>
);
const NEW_ICON = (
	<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
);
const SUGGESTION_ICON = (
	<>
		<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
		<path d="M9 18h6" />
		<path d="M10 22h4" />
	</>
);

const badgeDefinitions = {
	error: {
		icon: ERROR_ICON,
		label: "Error",
		title: "This rule reports problems and fails the lint run.",
	},
	fixable: {
		icon: FIXABLE_ICON,
		label: "Auto-fixable",
		title: "This rule includes an automatic code fix.",
	},
	new: {
		icon: NEW_ICON,
		label: "New",
		title: "This rule was added in the most recent release.",
	},
	roblox: {
		icon: ROBLOX_ICON,
		label: "Roblox",
		title: "This rule is specific to Roblox / Luau patterns.",
	},
	suggestion: {
		icon: SUGGESTION_ICON,
		label: "Suggestion",
		title: "This rule reports suggestions and does not fail the lint run.",
	},
} satisfies Readonly<Record<BadgeVariant, BadgeDefinition>>;

export function Badge({ variant }: BadgeProperties): ReactNode {
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
