import { tokenizeJson } from "@/utilities/json-highlighter";

import type { ReactNode } from "react";

import type { DefaultValueDocumentation } from "@/data/rule-options";

interface RuleOptionDefaultDetailProperties {
	readonly defaultValue: DefaultValueDocumentation;
	readonly detailId: string;
	readonly isExpanded: boolean;
}

const DETAIL = <div className="rule-option__detail-label">{"Default JSON"}</div>;

export function RuleOptionDefaultDetail({
	defaultValue,
	detailId,
	isExpanded,
}: RuleOptionDefaultDetailProperties): ReactNode {
	if (defaultValue.kind !== "complex") return undefined;

	const tokens = tokenizeJson(defaultValue.displayValue);

	return (
		<div className="rule-option__detail" hidden={!isExpanded} id={detailId}>
			{DETAIL}
			<pre>
				<code>
					{tokens.map((token, index) =>
						token.className === undefined ? (
							token.text
						) : (
							<span className={token.className} key={`${String(index)}-${token.text}`}>
								{token.text}
							</span>
						),
					)}
				</code>
			</pre>
		</div>
	);
}
