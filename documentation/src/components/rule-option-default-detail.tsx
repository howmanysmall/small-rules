import type React from "react";

import type { DefaultValueDocumentation } from "@/data/rule-options";

interface RuleOptionDefaultDetailProperties {
	readonly defaultValue: DefaultValueDocumentation;
	readonly detailId: string;
	readonly isExpanded: boolean;
}

const detailLabel = <div className="rule-option__detail-label">{"Default JSON"}</div>;

export function RuleOptionDefaultDetail({
	defaultValue,
	detailId,
	isExpanded,
}: RuleOptionDefaultDetailProperties): React.JSX.Element | undefined {
	if (defaultValue.kind !== "complex") return undefined;

	return (
		<div className="rule-option__detail" hidden={!isExpanded} id={detailId}>
			{detailLabel}
			<pre>
				<code>{defaultValue.displayValue}</code>
			</pre>
		</div>
	);
}
