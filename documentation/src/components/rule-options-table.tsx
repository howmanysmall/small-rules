import { RuleOption } from "./rule-option";

import type React from "react";

import type { ObjectOption } from "@/data/rule-options";

interface RuleOptionsTableProperties {
	readonly options: ReadonlyArray<ObjectOption>;
}

export function RuleOptionsTable({ options }: RuleOptionsTableProperties): React.ReactNode {
	return (
		<div className="rule-options-list not-content">
			{options.map((option) => (
				<RuleOption key={option.name} option={option} />
			))}
		</div>
	);
}
