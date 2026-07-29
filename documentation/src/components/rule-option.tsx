import { useId, useState } from "react";

import { RuleOptionDefaultDetail } from "./rule-option-default-detail";
import { RuleOptionDefaultField } from "./rule-option-default-field";
import { RuleOptionTypeField } from "./rule-option-type-field";

import type { ReactNode } from "react";

import type { ObjectOption } from "@/data/rule-options";

interface RuleOptionProperties {
	readonly highlightedType?: string | undefined;
	readonly option: ObjectOption;
}

const labels = {
	copied: "Copied",
	copy: "Copy default JSON",
	copyFailed: "Copy failed",
	descriptionFallback: "No description available.",
	optional: "Optional",
	required: "Required",
} as const;

export function RuleOption({ highlightedType, option }: RuleOptionProperties): ReactNode {
	const detailIdPrefix = useId();
	const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | undefined>();
	const [isExpanded, setIsExpanded] = useState(false);
	const detailId = `${detailIdPrefix}-${option.name}-default`;

	function toggleDefault(): void {
		setIsExpanded((currentValue) => !currentValue);
	}

	async function copyDefaultAsync(): Promise<void> {
		if (option.defaultValue.kind !== "complex") {
			setCopyStatus("failed");
			return;
		}

		try {
			await navigator.clipboard.writeText(option.defaultValue.copyValue);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
	}

	function handleCopyDefault(): void {
		void copyDefaultAsync();
	}

	let copyLabel: string = labels.copy;
	if (copyStatus === "copied") copyLabel = labels.copied;
	else if (copyStatus === "failed") copyLabel = labels.copyFailed;

	return (
		<div className="rule-option">
			<div className="rule-option__header">
				<code className="rule-option__name">{option.name}</code>
				<span className="rule-option__requirement">{option.required ? labels.required : labels.optional}</span>
			</div>
			<p className="rule-option__description">{option.description ?? labels.descriptionFallback}</p>
			<dl className="rule-option__metadata">
				<RuleOptionTypeField highlightedType={highlightedType} type={option.type} />
				<RuleOptionDefaultField
					copyLabel={copyLabel}
					copyStatus={copyStatus}
					detailId={detailId}
					isExpanded={isExpanded}
					onCopy={handleCopyDefault}
					onToggle={toggleDefault}
					option={option}
				/>
			</dl>
			<RuleOptionDefaultDetail defaultValue={option.defaultValue} detailId={detailId} isExpanded={isExpanded} />
		</div>
	);
}
