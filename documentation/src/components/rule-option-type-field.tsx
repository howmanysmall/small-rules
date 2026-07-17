import type React from "react";

interface RuleOptionTypeFieldProperties {
	readonly type: string;
}

const typeLabel = <dt>{"Type"}</dt>;

export function RuleOptionTypeField({ type }: RuleOptionTypeFieldProperties): React.JSX.Element {
	return (
		<div className="rule-option__field">
			{typeLabel}
			<dd>
				<code>{type}</code>
			</dd>
		</div>
	);
}
