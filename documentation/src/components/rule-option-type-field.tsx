import type { ReactNode } from "react";

interface RuleOptionTypeFieldProperties {
	/** Build-time Shiki-highlighted HTML for the type, or undefined to fall back to plain text. */
	readonly highlightedType: string | undefined;
	/** Raw type string (used as fallback when highlighting is unavailable). */
	readonly type: string;
}

const TYPE_LABEL = <dt>{"Type"}</dt>;

export function RuleOptionTypeField({ highlightedType, type }: RuleOptionTypeFieldProperties): ReactNode {
	return (
		<div className="rule-option__field">
			{TYPE_LABEL}
			<dd>
				{highlightedType === undefined ? (
					<code>{type}</code>
				) : (
					// oxlint-disable-next-line react/no-danger, react-perf/jsx-no-new-object-as-prop, react-doctor/no-danger -- shiki HTML at build time, safe to inject
					<code className="highlighted-type" dangerouslySetInnerHTML={{ __html: highlightedType }} />
				)}
			</dd>
		</div>
	);
}
