import { RuleOption } from "./rule-option";

import type { ReactNode } from "react";

import type { ObjectOption } from "$data/rule-options";

interface RuleOptionsTableProperties {
	/** Build-time TypeScript syntax-highlighted HTML per option name. */
	readonly highlightedTypes?: Readonly<Record<string, string>>;
	readonly options: ReadonlyArray<ObjectOption>;
}

export function RuleOptionsTable({ highlightedTypes, options }: RuleOptionsTableProperties): ReactNode {
	return (
		<div className="rule-options-list not-content">
			{options.map((option) => (
				<RuleOption key={option.name} highlightedType={highlightedTypes?.[option.name]} option={option} />
			))}
		</div>
	);
}
