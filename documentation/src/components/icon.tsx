import type React from "react";

export type IconName =
	| "react"
	| "roblox"
	| "naming"
	| "general"
	| "bolt"
	| "wand"
	| "shield"
	| "puzzle"
	| "arrow-right"
	| "github"
	| "check"
	| "x"
	| "sparkles"
	| "rocket"
	| "search"
	| "copy";

interface IconProperties {
	readonly className?: string;
	readonly name: IconName;
	readonly size?: number;
}

const arrowRightIcon = (
	<>
		<path d="M5 12h14" />
		<path d="m12 5 7 7-7 7" />
	</>
);
const boltIcon = <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />;
const checkIcon = <path d="M20 6 9 17l-5-5" />;
const copyIcon = (
	<>
		<rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
		<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
	</>
);
const generalIcon = (
	<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
);
const githubIcon = (
	<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6V21c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.4-.5-1.6.1-3.3 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 3 .1 3.3.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
);
const namingIcon = (
	<>
		<path d="M4 7V4h16v3" />
		<path d="M9 20h6" />
		<path d="M12 4v16" />
	</>
);
const puzzleIcon = (
	<path d="M19 11h-1V7a2 2 0 0 0-2-2h-4V4a2 2 0 1 0-4 0v1H4a2 2 0 0 0-2 2v4h1a2 2 0 1 1 0 4H2v4a2 2 0 0 0 2 2h4v-1a2 2 0 1 1 4 0v1h4a2 2 0 0 0 2-2v-4h1a2 2 0 1 0 0-4Z" />
);
const reactIcon = (
	<>
		<path d="M4.5 16.5c-1.5 1.26-2 5-2 5 3 0 5.74-1.5 7.5-3 .88-.78.78-2.05-.2-2.85-1.67-1.34-4.3-1.34-5.3.85Z" />
		<path d="M12 13.5c2.5-2 5-4 7.5-6 1.5-1.26 2-5 2-5-3 0-5.74 1.5-7.5 3-.88.78-.78 2.05.2 2.85 1.67 1.34 4.3 1.34 5.3-.85Z" />
		<path d="M9 12c-2 0-4.5-.5-7-1-1.5-.5-3-2-3-2 1-2 2-3 4-3 3 0 6 1 8 3 1 1 1 3-2 3Z" />
		<path d="M15 12c2 0 4.5-.5 7-1 1.5-.5 3-2 3-2-1-2-2-3-4-3-3 0-6 1-8 3-1 1-1 3 2 3Z" />
		<circle cx="12" cy="12" r="2" />
	</>
);
const robloxIcon = (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M9 8h3a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9v4" />
		<path d="M9 8v8" />
	</>
);
const rocketIcon = (
	<>
		<path d="M4.5 16.5c-1.5 1.26-2 5-2 5 3 0 5.74-1.5 7.5-3 .88-.78.78-2.05-.2-2.85-1.67-1.34-4.3-1.34-5.3.85Z" />
		<path d="M12 15c-2 0-4.5-.5-7-1-1.5-.5-3-2-3-2 1-2 2-3 4-3 3 0 6 1 8 3 1 1 1 3-2 3Z" />
		<path d="M9 12c.5-3 2-7 7-9 0 5-3.5 8.5-6 10" />
		<path d="M12 15c-1 2-3 4-6 5 0-3 1.5-5 3-6" />
	</>
);
const searchIcon = (
	<>
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.3-4.3" />
	</>
);
const shieldIcon = (
	<>
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
		<path d="m9 12 2 2 4-4" />
	</>
);
const sparklesIcon = (
	<>
		<path d="M12 3v3m0 12v3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M3 12h3m12 0h3M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1" />
		<circle cx="12" cy="12" r="3" />
	</>
);
const wandIcon = (
	<>
		<path d="M15 4V2" />
		<path d="M15 16v-2" />
		<path d="M8 9h2" />
		<path d="M20 9h2" />
		<path d="M17.8 11.8 19 13" />
		<path d="M15 9h0" />
		<path d="M17.8 6.2 19 5" />
		<path d="m3 21 9-9" />
		<path d="M12.2 6.2 11 5" />
	</>
);
const xIcon = (
	<>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</>
);

const iconContents = {
	"arrow-right": arrowRightIcon,
	bolt: boltIcon,
	check: checkIcon,
	copy: copyIcon,
	general: generalIcon,
	github: githubIcon,
	naming: namingIcon,
	puzzle: puzzleIcon,
	react: reactIcon,
	roblox: robloxIcon,
	rocket: rocketIcon,
	search: searchIcon,
	shield: shieldIcon,
	sparkles: sparklesIcon,
	wand: wandIcon,
	x: xIcon,
} satisfies Readonly<Record<IconName, React.ReactNode>>;

export function Icon({ className, name, size = 24 }: IconProperties): React.JSX.Element {
	const isFilled = name === "github";
	const strokeWidth = name === "check" || name === "x" ? 2.5 : 1.75;

	return (
		<svg
			aria-hidden="true"
			className={className}
			fill={isFilled ? "currentColor" : "none"}
			height={size}
			stroke={isFilled ? "none" : "currentColor"}
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={strokeWidth}
			viewBox="0 0 24 24"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			{iconContents[name]}
		</svg>
	);
}
