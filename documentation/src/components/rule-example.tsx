import { useCallback, useEffect, useState } from "react";

import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from "react";

const passStatusIcon = (
	<svg
		fill="none"
		height="12"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2.5"
		viewBox="0 0 16 16"
		width="12"
	>
		<path d="M3 8.5 L6.5 12 L13 4.5" />
	</svg>
);

const failStatusIcon = (
	<svg
		fill="none"
		height="12"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2.5"
		viewBox="0 0 16 16"
		width="12"
	>
		<circle cx="8" cy="8" r="6.5" />
		<path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" />
	</svg>
);

const copyIcon = (
	<svg
		aria-hidden="true"
		fill="none"
		height="14"
		stroke="currentColor"
		strokeLinecap="round"
		strokeLinejoin="round"
		strokeWidth="2"
		viewBox="0 0 24 24"
		width="14"
	>
		<rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
		<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
	</svg>
);

interface RuleExampleProperties {
	readonly children: ReactNode;
	readonly title?: string;
	readonly type: "pass" | "fail";
}

export function RuleExample({ children, title, type }: RuleExampleProperties): ReactElement {
	const [copied, setCopied] = useState(false);
	const isPass = type === "pass";
	const displayTitle = title ?? (isPass ? "Correct" : "Incorrect");
	const statusIcon = isPass ? passStatusIcon : failStatusIcon;

	useEffect(
		function resetCopiedState(): (() => void) | undefined {
			if (!copied) return undefined;

			const timeout = globalThis.setTimeout(function clearCopiedState(): void {
				setCopied(false);
			}, 1_500);
			return function clearResetTimer(): void {
				globalThis.clearTimeout(timeout);
			};
		},
		[copied],
	);

	const copyExampleAsync = useCallback(async function copyExampleAsync(code: Element): Promise<void> {
		await navigator.clipboard.writeText(code.textContent ?? "");
		setCopied(true);
	}, []);

	const handleCopyExample = useCallback(
		function handleCopyExample(event: ReactMouseEvent<HTMLButtonElement>): void {
			const card = event.currentTarget.closest("[data-rule-example]");
			const code = card?.querySelector("pre code, code");
			if (code === null || code === undefined) return;

			void copyExampleAsync(code);
		},
		[copyExampleAsync],
	);

	const copyButton = (
		<button
			aria-atomic="true"
			aria-label={copied ? "Example copied" : "Copy example"}
			aria-live="polite"
			className="RuleExample-copy"
			data-copied={copied ? "" : undefined}
			onClick={handleCopyExample}
			type="button"
		>
			{copyIcon}
		</button>
	);
	const badge = (
		<span className="RuleExample-badge">
			<span aria-hidden="true" className="RuleExample-status">
				{statusIcon}
			</span>
			<span className="RuleExample-title">{displayTitle}</span>
		</span>
	);
	const header = (
		<div className="RuleExample-header">
			{badge}
			{copyButton}
		</div>
	);

	return (
		<div className={`RuleExample RuleExample--${type}`} data-rule-example="">
			{header}
			<div className="RuleExample-content">{children}</div>
		</div>
	);
}
