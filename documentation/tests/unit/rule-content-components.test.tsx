import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelatedRules } from "@/components/related-rules";
import { RuleCategoryPage } from "@/components/rule-category-page";
import { RuleSummary } from "@/components/rule-summary";

import type React from "react";

const categorySummaryPattern = /Browse all \d+ rules in this category\./u;
const noWarnNamePattern = /No Warn/u;

vi.mock("@/components/rule-index", () => ({
	RuleIndex: (): React.JSX.Element => <div data-testid="rule-index" />,
}));

describe("RelatedRules", () => {
	it("links a rule to its documented semantic counterpart", () => {
		render(<RelatedRules rule="no-print" />);

		const section = screen.getByRole("region", { name: "Related Rules" });
		const link = within(section).getByRole("link", { name: noWarnNamePattern });

		expect(link.getAttribute("href")).toBe("/small-rules/rules/roblox/no-warn/");
		expect(within(link).getByText("Related")).toBeInstanceOf(HTMLElement);
		expect(
			within(link).getByText(
				"Same banned-global factory: raw print/warn output should become structured Log calls.",
			),
		).toBeInstanceOf(HTMLElement);
	});
});

describe("RuleCategoryPage", () => {
	it("introduces the selected category before its rule index", () => {
		render(<RuleCategoryPage category="general" />);

		expect(
			screen.getByText("Rules for code quality, control flow, and common pitfalls.", { exact: false }),
		).toBeInstanceOf(HTMLElement);
		expect(screen.getByText(categorySummaryPattern)).toBeInstanceOf(HTMLElement);
		expect(screen.getByTestId("rule-index")).toBeInstanceOf(HTMLElement);
	});
});

describe("RuleSummary", () => {
	it("renders the rule id and generated description by default", () => {
		render(<RuleSummary rule="no-print" />);

		expect(screen.getByText("small-rules/no-print")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("Use Log instead of print().")).toBeInstanceOf(HTMLElement);
	});

	it("composes custom summary content when provided", () => {
		render(
			<RuleSummary rule="no-print">
				<p>{"Project-specific guidance."}</p>
			</RuleSummary>,
		);

		expect(screen.getByText("Project-specific guidance.")).toBeInstanceOf(HTMLElement);
		expect(screen.queryByText("Use Log instead of print().")).toBeNull();
	});
});
