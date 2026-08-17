import { RuleOptionIcon } from "./rule-option-icon";

import type { ReactNode } from "react";

interface RuleOptionDefaultActionsProperties {
	readonly name: string;
	readonly copyLabel: string;
	readonly copyStatus?: "copied" | "failed" | undefined;
	readonly detailId: string;
	readonly isExpanded: boolean;
	readonly onCopy: () => void;
	readonly onToggle: () => void;
	readonly summary: string;
}

const CHEVRON = <RuleOptionIcon kind="chevron" />;

export function RuleOptionDefaultActions({
	name,
	copyLabel,
	copyStatus,
	detailId,
	isExpanded,
	onCopy,
	onToggle,
	summary,
}: RuleOptionDefaultActionsProperties): ReactNode {
	let copyStatusText = "";
	if (copyStatus !== undefined) copyStatusText = copyLabel;

	return (
		<div className="rule-option__default-actions">
			<button
				aria-controls={detailId}
				aria-expanded={isExpanded}
				className="rule-option__summary"
				type="button"
				onClick={onToggle}
			>
				<span>{summary}</span>
				{CHEVRON}
			</button>
			<button
				aria-label={`${copyLabel}: ${name}`}
				className="rule-option__copy"
				data-state={copyStatus}
				title={`${copyLabel}: ${name}`}
				type="button"
				onClick={onCopy}
			>
				<RuleOptionIcon kind={copyStatus === "copied" ? "check" : "copy"} />
			</button>
			<span aria-live="polite" className="rule-option__status">
				{copyStatusText}
			</span>
		</div>
	);
}
