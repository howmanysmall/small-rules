import { RuleOptionDefaultActions } from "./rule-option-default-actions";

import type { ReactNode } from "react";

import type { ObjectOption } from "$data/rule-options";

interface RuleOptionDefaultFieldProperties {
	copyLabel: string;
	copyStatus?: "copied" | "failed" | undefined;
	detailId: string;
	isExpanded: boolean;
	onCopy: () => void;
	onToggle: () => void;
	option: ObjectOption;
}

const DEFAULT = <dt>{"Default"}</dt>;

export function RuleOptionDefaultField({
	copyLabel,
	copyStatus,
	detailId,
	isExpanded,
	onCopy,
	onToggle,
	option,
}: Readonly<RuleOptionDefaultFieldProperties>): ReactNode {
	return (
		<div className="rule-option__field rule-option__field--default">
			{DEFAULT}
			<dd>
				{option.defaultValue.kind === "complex" ? (
					<RuleOptionDefaultActions
						copyLabel={copyLabel}
						copyStatus={copyStatus}
						detailId={detailId}
						isExpanded={isExpanded}
						name={option.name}
						summary={option.defaultValue.summary}
						onCopy={onCopy}
						onToggle={onToggle}
					/>
				) : (
					<code>{option.defaultValue.displayValue}</code>
				)}
			</dd>
		</div>
	);
}
