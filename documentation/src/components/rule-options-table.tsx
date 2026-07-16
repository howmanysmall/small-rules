import { useCallback, useId, useState } from "react";

import type { JSX } from "react";

import type { ObjectOption } from "@/data/rule-options";

interface RuleOptionProperties {
	readonly option: ObjectOption;
}

interface RuleOptionsTableProperties {
	readonly options: ReadonlyArray<ObjectOption>;
}

type CopyStatus = "copied" | "failed" | undefined;

const labels = {
	copied: "Copied",
	copy: "Copy default JSON",
	copyFailed: "Copy failed",
	defaultValue: "Default",
	descriptionFallback: "No description available.",
	hide: "Hide default JSON",
	optional: "Optional",
	required: "Required",
	show: "Show default JSON",
	type: "Type",
} as const;

function RuleOption({ option }: RuleOptionProperties): JSX.Element {
	const detailIdPrefix = useId();
	const [copyStatus, setCopyStatus] = useState<CopyStatus>();
	const [isExpanded, setIsExpanded] = useState(false);
	const detailId = `${detailIdPrefix}-${option.name}-default`;
	const isComplexDefault = option.defaultValue.kind === "complex";

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

	let copyStatusText = "";
	if (copyStatus === "copied") copyStatusText = labels.copied;
	else if (copyStatus === "failed") copyStatusText = labels.copyFailed;

	return (
		<div className="rule-option">
			<div className="rule-option__header">
				<code className="rule-option__name">{option.name}</code>
				<span className="rule-option__requirement">{option.required ? labels.required : labels.optional}</span>
			</div>

			<p className="rule-option__description">{option.description ?? labels.descriptionFallback}</p>

			<dl className="rule-option__metadata">
				<div className="rule-option__field">
					<dt>{labels.type}</dt>
					<dd>
						<code>{option.type}</code>
					</dd>
				</div>
				<div className="rule-option__field rule-option__field--default">
					<dt>{labels.defaultValue}</dt>
					<dd>
						{isComplexDefault ? (
							<div className="rule-option__default-actions">
								<button
									aria-controls={detailId}
									aria-expanded={isExpanded}
									className="rule-option__summary"
									onClick={toggleDefault}
									type="button"
								>
									<span>{option.defaultValue.summary}</span>
									<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
										<path d="m8 10 4 4 4-4" />
									</svg>
								</button>
								<button
									aria-label={`${copyLabel}: ${option.name}`}
									className="rule-option__copy"
									data-state={copyStatus}
									onClick={handleCopyDefault}
									title={`${copyLabel}: ${option.name}`}
									type="button"
								>
									{copyStatus === "copied" ? (
										<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
											<path d="m5 12 4 4L19 6" />
										</svg>
									) : (
										<svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
											<rect height="13" rx="2" width="13" x="8" y="8" />
											<path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
										</svg>
									)}
								</button>
								<span aria-live="polite" className="rule-option__status">
									{copyStatusText}
								</span>
							</div>
						) : (
							<code>{option.defaultValue.displayValue}</code>
						)}
					</dd>
				</div>
			</dl>

			{isComplexDefault && (
				<div className="rule-option__detail" hidden={!isExpanded} id={detailId}>
					<div className="rule-option__detail-label">{labels.defaultValue} JSON</div>
					<pre>
						<code>{option.defaultValue.displayValue}</code>
					</pre>
				</div>
			)}
		</div>
	);
}

export function RuleOptionsTable({ options }: RuleOptionsTableProperties): JSX.Element {
	return (
		<div className="rule-options-list not-content">
			{options.map((option) => (
				<RuleOption key={option.name} option={option} />
			))}
		</div>
	);
}
