import { useCallback, useId, useState } from "react";

import { RuleOptionDefaultDetail } from "./rule-option-default-detail";
import { RuleOptionDefaultField } from "./rule-option-default-field";
import { RuleOptionTypeField } from "./rule-option-type-field";

import type React from "react";

import type { ObjectOption } from "@/data/rule-options";

interface RuleOptionProperties {
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

export function RuleOption({ option }: RuleOptionProperties): React.JSX.Element {
	const detailIdPrefix = useId();
	const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | undefined>();
	const [isExpanded, setIsExpanded] = useState(false);
	const detailId = `${detailIdPrefix}-${option.name}-default`;

	const toggleDefault = useCallback((): void => {
		setIsExpanded((currentValue) => !currentValue);
	}, []);

	const copyDefault = useCallback(async (): Promise<void> => {
		if (option.defaultValue.kind !== "complex" || navigator.clipboard === undefined) {
			setCopyStatus("failed");
			return;
		}

		try {
			await navigator.clipboard.writeText(option.defaultValue.copyValue);
			setCopyStatus("copied");
		} catch (error) {
			if (error instanceof Error) {
				setCopyStatus("failed");
				return;
			}
			throw error;
		}
	}, [option.defaultValue]);

	const handleCopyDefault = useCallback((): void => {
		void copyDefault();
	}, [copyDefault]);

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
				<RuleOptionTypeField type={option.type} />
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
