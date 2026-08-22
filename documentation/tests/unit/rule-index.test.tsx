import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RuleIndex } from "$components/rule-index";
import { createRuleIndexCategories } from "$components/rule-index-data";
import { ruleFactCategories } from "$data/rule-facts";

const catalogCategories = createRuleIndexCategories(ruleFactCategories.values());
const catalogRuleCount = catalogCategories.flatMap((category) => category.rules).length;
const namingRuleCount = catalogCategories.find((category) => category.key === "naming")?.rules.length ?? 0;
const robloxRuleCount = catalogCategories.find((category) => category.key === "roblox")?.rules.length ?? 0;
const noPrintPattern = /No Print/u;
const banReactFcPattern = /Ban React Fc/u;
const preventAbbreviationsPattern = /Prevent Abbreviations/u;

function showingRulesLabel(count: number): string {
	return `Showing ${String(count)} ${count === 1 ? "rule" : "rules"}`;
}

describe("RuleIndex", () => {
	it("renders the complete catalog with accessible filter controls", () => {
		expect.assertions(5);

		render(<RuleIndex categories={catalogCategories} mode="catalog" />);

		const search = screen.getByRole("searchbox", { name: "Search rules" });
		const category = screen.getByRole("combobox", { name: "Category" });

		expect(search.getAttribute("placeholder")).toBe("Try no-print");
		expect(category.tagName).toBe("SELECT");
		expect(screen.getByRole("button", { name: "Reset filters" }).hasAttribute("disabled")).toBe(false);
		expect(screen.getByText(`Showing ${catalogRuleCount} rules`).textContent).toBe(
			`Showing ${catalogRuleCount} rules`,
		);
		expect(screen.getAllByRole("link")).toHaveLength(catalogRuleCount);
	});

	it("filters rules by search text", async () => {
		expect.assertions(3);

		const user = userEvent.setup();
		render(<RuleIndex categories={catalogCategories} mode="catalog" />);

		await user.type(screen.getByRole("searchbox", { name: "Search rules" }), "no-print");

		expect(screen.getByText("Showing 1 rule").textContent).toBe("Showing 1 rule");
		expect(screen.getByRole("link", { name: noPrintPattern }).getAttribute("href")).toBe(
			"/small-rules/rules/roblox/no-print/",
		);
		expect(screen.queryByRole("link", { name: banReactFcPattern })).toBeNull();
	});

	it("filters rules by category", async () => {
		expect.assertions(3);

		const user = userEvent.setup();
		render(<RuleIndex categories={catalogCategories} mode="catalog" />);

		await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "naming");

		expect(screen.getByText(showingRulesLabel(namingRuleCount)).textContent).toBe(
			showingRulesLabel(namingRuleCount),
		);
		expect(screen.getByRole("link", { name: preventAbbreviationsPattern }).getAttribute("href")).toContain(
			"/rules/naming/prevent-abbreviations/",
		);
		expect(screen.queryByRole("link", { name: noPrintPattern })).toBeNull();
	});

	it("shows the empty state when no rules match", async () => {
		expect.assertions(3);

		const user = userEvent.setup();
		render(<RuleIndex categories={catalogCategories} mode="catalog" />);

		await user.type(screen.getByRole("searchbox", { name: "Search rules" }), "not-a-real-rule-name");

		expect(screen.getByText("Showing 0 rules").textContent).toBe("Showing 0 rules");
		expect(screen.getByText("No rules match those filters.").hidden).toBe(false);
		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});

	it("resets search and category filters together", async () => {
		expect.assertions(3);

		const user = userEvent.setup();
		render(<RuleIndex categories={catalogCategories} mode="catalog" />);
		const search = screen.getByRole("searchbox", { name: "Search rules" });
		const category = screen.getByRole("combobox", { name: "Category" });
		await user.type(search, "use");
		await user.selectOptions(category, "react");

		await user.click(screen.getByRole("button", { name: "Reset filters" }));

		expect(search).toHaveProperty("value", "");
		expect(category).toHaveProperty("value", "");
		expect(screen.getByText(`Showing ${catalogRuleCount} rules`).textContent).toBe(
			`Showing ${catalogRuleCount} rules`,
		);
	});

	it("renders a category listing without catalog filters", () => {
		expect.assertions(3);

		const robloxCategory = catalogCategories.filter((category) => category.key === "roblox");

		render(<RuleIndex categories={robloxCategory} mode="category" />);

		expect(screen.queryByRole("searchbox", { name: "Search rules" })).toBeNull();
		expect(screen.queryByRole("combobox", { name: "Category" })).toBeNull();
		expect(screen.getByText(showingRulesLabel(robloxRuleCount)).textContent).toBe(
			showingRulesLabel(robloxRuleCount),
		);
	});
});
