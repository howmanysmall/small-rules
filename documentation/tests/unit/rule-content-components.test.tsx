import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelatedRules } from "$components/related-rules";
import { RuleCategoryPage } from "$components/rule-category-page";
import { RuleSummary } from "$components/rule-summary";

const categorySummaryPattern = /Browse all \d+ rules in this category\./u;
const noWarnNamePattern = /No Warn/u;
const ruleIndexCountPattern = /^Showing \d+ rules$/u;

describe("related-rules", () => {
	it("links a rule to its documented semantic counterpart", () => {
		expect.assertions(3);
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

describe("rule-category-page", () => {
	it("introduces the selected category before its rule index", () => {
		expect.assertions(3);
		render(<RuleCategoryPage category="general" />);

		expect(
			screen.getByText("Rules for code quality, control flow, and common pitfalls.", { exact: false }),
		).toBeInstanceOf(HTMLElement);
		expect(screen.getByText(categorySummaryPattern)).toBeInstanceOf(HTMLElement);
		expect(screen.getByText(ruleIndexCountPattern)).toBeInstanceOf(HTMLElement);
	});
});

describe("rule-summary", () => {
	it("renders the rule id and generated description by default", () => {
		expect.assertions(2);
		render(<RuleSummary rule="no-print" />);

		expect(screen.getByText("small-rules/no-print")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("Use Log instead of print().")).toBeInstanceOf(HTMLElement);
	});

	it("composes custom summary content when provided", () => {
		expect.assertions(2);
		render(
			<RuleSummary rule="no-print">
				<p>{"Project-specific guidance."}</p>
			</RuleSummary>,
		);

		expect(screen.getByText("Project-specific guidance.")).toBeInstanceOf(HTMLElement);
		expect(screen.queryByText("Use Log instead of print().")).toBeNull();
	});
});
