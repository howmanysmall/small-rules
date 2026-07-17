import { RuleOptionIcon } from "./rule-option-icon";

import type React from "react";

interface RuleOptionDefaultActionsProperties {
	readonly copyLabel: string;
	readonly copyStatus: "copied" | "failed" | undefined;
	readonly detailId: string;
	readonly isExpanded: boolean;
	readonly name: string;
	readonly onCopy: () => void;
	readonly onToggle: () => void;
	readonly summary: string;
}

export function RuleOptionDefaultActions({
	copyLabel,
	copyStatus,
	detailId,
	isExpanded,
	name,
	onCopy,
	onToggle,
	summary,
}: RuleOptionDefaultActionsProperties): React.JSX.Element {
	let copyStatusText = "";
	if (copyStatus !== undefined) copyStatusText = copyLabel;

	return (
		<div className="rule-option__default-actions">
			<button
				aria-controls={detailId}
				aria-expanded={isExpanded}
				className="rule-option__summary"
				onClick={onToggle}
				type="button"
			>
				<span>{summary}</span>
				<RuleOptionIcon kind="chevron" />
			</button>
			<button
				aria-label={`${copyLabel}: ${name}`}
				className="rule-option__copy"
				data-state={copyStatus}
				onClick={onCopy}
				title={`${copyLabel}: ${name}`}
				type="button"
			>
				<RuleOptionIcon kind={copyStatus === "copied" ? "check" : "copy"} />
			</button>
			<span aria-live="polite" className="rule-option__status">
				{copyStatusText}
			</span>
		</div>
	);
}
