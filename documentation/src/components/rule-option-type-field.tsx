import type { ReactNode } from "react";

interface RuleOptionTypeFieldProperties {
	readonly type: string;
}

const TYPE_LABEL = <dt>{"Type"}</dt>;

export function RuleOptionTypeField({ type }: RuleOptionTypeFieldProperties): ReactNode {
	return (
		<div className="rule-option__field">
			{TYPE_LABEL}
			<dd>
				<code>{type}</code>
			</dd>
		</div>
	);
}
