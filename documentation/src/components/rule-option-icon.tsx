import type React from "react";

interface RuleOptionIconProperties {
	readonly kind: "check" | "chevron" | "copy";
}

const checkIcon = (
	<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
		<path d="m5 12 4 4L19 6" />
	</svg>
);
const chevronIcon = (
	<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
		<path d="m8 10 4 4 4-4" />
	</svg>
);
const copyIcon = (
	<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
		<rect height="13" rx="2" width="13" x="8" y="8" />
		<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
	</svg>
);

export function RuleOptionIcon({ kind }: RuleOptionIconProperties): React.ReactNode {
	if (kind === "check") return checkIcon;
	if (kind === "chevron") return chevronIcon;
	return copyIcon;
}
