import { useEffect, useState, useSyncExternalStore } from "react";

import { InlineMarkdownNodes } from "./inline-markdown-nodes";
import { RuleOptionIcon } from "./rule-option-icon";

import type { PropsWithChildren, ReactNode } from "react";

import type { RuleName } from "$data/rule-manifest";

interface RuleSummaryProperties {
	description: string;
	rule: RuleName;
}

function subscribeToHydration(): () => undefined {
	return () => undefined;
}

function getClientSnapshot(): boolean {
	return true;
}

function getServerSnapshot(): boolean {
	return false;
}

export function RuleSummary({
	description,
	rule,
	children,
}: Readonly<PropsWithChildren<RuleSummaryProperties>>): ReactNode {
	const ruleId = `small-rules/${rule}`;
	const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | undefined>();
	const isReady = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

	useEffect(
		function resetCopyStatus(): (() => void) | undefined {
			if (copyStatus === undefined) return undefined;

			const timeout = setTimeout(function clearCopyStatus(): void {
				setCopyStatus(undefined);
			}, 1_500);

			return function clearResetTimer(): void {
				clearTimeout(timeout);
			};
		},
		[copyStatus],
	);

	async function copyRuleNameAsync(): Promise<void> {
		try {
			await navigator.clipboard.writeText(ruleId);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("failed");
		}
	}

	function handleCopyRuleName(): void {
		copyRuleNameAsync().catch((error) => {
			console.error("Failed to copy rule name:", error);
		});
	}

	let copyLabel = "Copy rule name";
	if (copyStatus === "copied") {
		copyLabel = "Rule name copied";
	} else if (copyStatus === "failed") {
		copyLabel = "Copy failed";
	}

	return (
		<div className="rule-summary">
			<div className="rule-summary-id-row">
				<code className="rule-summary-id">{ruleId}</code>
				<button
					aria-label={copyLabel}
					aria-live="polite"
					className="rule-summary-copy"
					data-state={copyStatus}
					disabled={!isReady}
					type="button"
					onClick={handleCopyRuleName}
				>
					<RuleOptionIcon kind={copyStatus === "copied" ? "check" : "copy"} />
				</button>
			</div>
			<div className="rule-summary-text">
				{children ?? (
					<p>
						<InlineMarkdownNodes text={description} />
					</p>
				)}
			</div>
		</div>
	);
}
