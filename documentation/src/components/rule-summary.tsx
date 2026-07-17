import { getRuleFacts } from "@/data/rule-facts";

import type React from "react";

import type { RuleName } from "@/data/rule-manifest";

interface RuleSummaryProperties {
	readonly children?: React.ReactNode;
	readonly rule: RuleName;
}

export function RuleSummary({ children, rule }: RuleSummaryProperties): React.JSX.Element {
	const { description } = getRuleFacts(rule);

	return (
		<div className="rule-summary">
			<code className="rule-summary-id">
				{"small-rules/"}
				{rule}
			</code>
			<div className="rule-summary-text">{children ?? <p>{description}</p>}</div>
		</div>
	);
}
