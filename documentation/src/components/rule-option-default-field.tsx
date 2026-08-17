import { RuleOptionDefaultActions } from "./rule-option-default-actions";

import type { ReactNode } from "react";

import type { ObjectOption } from "@/data/rule-options";

interface RuleOptionDefaultFieldProperties {
	readonly copyLabel: string;
	readonly copyStatus?: "copied" | "failed" | undefined;
	readonly detailId: string;
	readonly isExpanded: boolean;
	readonly onCopy: () => void;
	readonly onToggle: () => void;
	readonly option: ObjectOption;
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
}: RuleOptionDefaultFieldProperties): ReactNode {
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
