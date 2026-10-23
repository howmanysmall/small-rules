import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi } from "vitest";

import { RelatedRules } from "$components/related-rules";
import { RelationReason } from "$components/relation-reason";
import { RuleCategoryPage } from "$components/rule-category-page";
import { RuleSummary } from "$components/rule-summary";

const categorySummaryPattern = /Browse all \d+ rules in this category\./u;
const directiveDisableEnablePairNamePattern = /Directive Disable Enable Pair/u;
const directiveNoUseNamePattern = /Directive No Use/u;
const noWarnNamePattern = /No Warn/u;
const preferConstantDispatchNamePattern = /Prefer Constant Dispatch/u;
const preferUseReducerNamePattern = /Prefer Use Reducer/u;
const ruleIndexCountPattern = /^Showing \d+ rules$/u;

describe("related-rules", () => {
	it("links a rule to its documented semantic counterpart", ({ expect }) => {
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

	it("renders backticked identifiers in relation reasons as inline code", ({ expect }) => {
		expect.assertions(3);

		const { container: link } = render(
			<RelationReason reason="`directive-no-use` supersedes `directive-no-unlimited-disable`." />,
		);

		expect(link.textContent).not.toContain("`");
		expect(within(link).getByText("directive-no-use", { selector: "code" })).toBeInstanceOf(HTMLElement);
		expect(within(link).getByText("directive-no-unlimited-disable", { selector: "code" })).toBeInstanceOf(
			HTMLElement,
		);
	});

	it("highlights bare rule ids in relation reasons as inline code", ({ expect }) => {
		expect.assertions(3);

		const { container: link } = render(
			<RelationReason reason="directive-no-use supersedes directive-no-restricted-disable." />,
		);

		expect(link.textContent).not.toContain("`");
		expect(within(link).getByText("directive-no-restricted-disable", { selector: "code" })).toBeInstanceOf(
			HTMLElement,
		);
		expect(within(link).getByText("directive-no-use", { selector: "code" })).toBeInstanceOf(HTMLElement);
	});

	it("labels supersedes relations from the superseded rule's page and leads with directed relations", ({
		expect,
	}) => {
		expect.assertions(2);

		render(<RelatedRules rule="directive-disable-enable-pair" />);

		const section = screen.getByRole("region", { name: "Related Rules" });
		const link = within(section).getByRole("link", { name: directiveNoUseNamePattern });

		expect(within(link).getByText("Superseded by")).toBeInstanceOf(HTMLElement);
		expect(within(section).getAllByRole("link")[0]?.textContent).toContain("Superseded by");
	});

	it("labels supersedes relations from the superseding rule's page", ({ expect }) => {
		expect.assertions(1);

		render(<RelatedRules rule="directive-no-use" />);

		const section = screen.getByRole("region", { name: "Related Rules" });
		const link = within(section).getByRole("link", { name: directiveDisableEnablePairNamePattern });

		expect(within(link).getByText("Supersedes")).toBeInstanceOf(HTMLElement);
	});

	it("labels depends-on relations from the dependent rule's page", ({ expect }) => {
		expect.assertions(1);

		render(<RelatedRules rule="prefer-constant-dispatch" />);

		const section = screen.getByRole("region", { name: "Related Rules" });
		const link = within(section).getByRole("link", { name: preferUseReducerNamePattern });

		expect(within(link).getByText("Depends on")).toBeInstanceOf(HTMLElement);
	});

	it("labels depends-on relations from the prerequisite rule's page", ({ expect }) => {
		expect.assertions(1);

		render(<RelatedRules rule="prefer-use-reducer" />);

		const section = screen.getByRole("region", { name: "Related Rules" });
		const link = within(section).getByRole("link", { name: preferConstantDispatchNamePattern });

		expect(within(link).getByText("Depended on by")).toBeInstanceOf(HTMLElement);
	});
});

describe("rule-category-page", () => {
	it("introduces the selected category before its rule index", ({ expect }) => {
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
	it("renders the rule id and generated description by default", ({ expect }) => {
		expect.assertions(2);

		render(<RuleSummary description="Use Log instead of print()." rule="no-print" />);

		expect(screen.getByText("small-rules/no-print")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("Use Log instead of print().")).toBeInstanceOf(HTMLElement);
	});

	it("copies the full rule name and confirms the result", async ({ expect }) => {
		expect.assertions(3);

		const user = userEvent.setup();
		const writeText = vi.spyOn(navigator.clipboard, "writeText");
		render(<RuleSummary description="Use Log instead of print()." rule="no-print" />);

		const copyButton = screen.getByRole("button", { name: "Copy rule name" });
		await user.click(copyButton);

		expect(writeText).toHaveBeenCalledExactlyOnceWith("small-rules/no-print");
		expect(screen.getByRole("button", { name: "Rule name copied" }).dataset.copied).toBe("");
		expect(screen.getByText("small-rules/no-print")).toBeInstanceOf(HTMLElement);
	});

	it("renders backticked identifiers in generated descriptions as inline code", ({ expect }) => {
		expect.assertions(3);

		const { container } = render(
			<RuleSummary
				description="Disallow duplicate `oxlint-disable` or `eslint-disable` comments."
				rule="directive-no-duplicate-disable"
			/>,
		);

		expect(container.textContent).not.toContain("`");
		expect(screen.getByText("oxlint-disable", { selector: "code" })).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("eslint-disable", { selector: "code" })).toBeInstanceOf(HTMLElement);
	});

	it("composes custom summary content when provided", ({ expect }) => {
		expect.assertions(2);

		render(
			<RuleSummary description="Use Log instead of print()." rule="no-print">
				<p>{"Project-specific guidance."}</p>
			</RuleSummary>,
		);

		expect(screen.getByText("Project-specific guidance.")).toBeInstanceOf(HTMLElement);
		expect(screen.queryByText("Use Log instead of print().")).toBeNull();
	});
});
