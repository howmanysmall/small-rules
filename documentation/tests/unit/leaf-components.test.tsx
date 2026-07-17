import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/badge";
import { CategoryCard } from "@/components/category-card";
import { FeatureCard } from "@/components/feature-card";
import { HeroSplash } from "@/components/hero-splash";
import { Icon } from "@/components/icon";
import { PageHeader } from "@/components/page-header";

const reactHeadingName = /React/u;

describe("Badge", () => {
	it.each([
		["error", "Error", "This rule reports problems and fails the lint run."],
		["suggestion", "Suggestion", "This rule reports suggestions and does not fail the lint run."],
		["fixable", "Auto-fixable", "This rule includes an automatic code fix."],
		["roblox", "Roblox", "This rule is specific to Roblox / Luau patterns."],
	] as const)("renders the %s rule metadata", (variant, label, title) => {
		const { container } = render(<Badge variant={variant} />);

		expect(screen.getByText(label).getAttribute("title")).toBe(title);
		expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
	});
});

describe("CategoryCard", () => {
	it("links to the category and exposes its summary", () => {
		render(
			<CategoryCard
				category="react"
				count={18}
				description="Rules for React components and hooks."
				label="React"
			/>,
		);

		const link = screen.getByRole("link", { name: reactHeadingName });
		expect(link.getAttribute("href")).toBe("/small-rules/rules/react/");
		expect(within(link).getByRole("heading", { name: "React" }).textContent).toBe("React");
		expect(within(link).getByText("18").textContent).toBe("18");
		expect(within(link).getByText("Rules for React components and hooks.").textContent).toBe(
			"Rules for React components and hooks.",
		);
	});
});

describe("FeatureCard", () => {
	it("renders a feature as a titled description", () => {
		render(<FeatureCard description="Runs directly in Oxlint." icon="bolt" title="Oxlint native" />);

		expect(screen.getByRole("heading", { name: "Oxlint native" }).textContent).toBe("Oxlint native");
		expect(screen.getByText("Runs directly in Oxlint.").textContent).toBe("Runs directly in Oxlint.");
	});
});

describe("Icon", () => {
	it("renders decorative SVGs at the requested size", () => {
		const { container } = render(<Icon className="example-icon" name="search" size={20} />);

		const icon = container.querySelector("svg");
		expect(icon?.getAttribute("aria-hidden")).toBe("true");
		expect(icon?.getAttribute("height")).toBe("20");
		expect(icon?.getAttribute("width")).toBe("20");
		expect(icon?.classList.contains("example-icon")).toBe(true);
	});
});

describe("HeroSplash", () => {
	it("presents the documentation entry points and configuration preview", () => {
		render(<HeroSplash subtitle="Focused rules for strict projects." title="Small rules, big impact." />);

		expect(screen.getByText("Oxlint plugin for roblox-ts").textContent).toBe("Oxlint plugin for roblox-ts");
		expect(screen.getByRole("heading", { level: 1, name: "Small rules, big impact." }).textContent).toBe(
			"Small rules, big impact.",
		);
		expect(screen.getByText("Focused rules for strict projects.").textContent).toBe(
			"Focused rules for strict projects.",
		);
		expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe(
			"/small-rules/quick-start/",
		);
		expect(screen.getByRole("link", { name: "View on GitHub" }).getAttribute("href")).toBe(
			"https://github.com/howmanysmall/small-rules",
		);
		expect(screen.getByLabelText("Code preview").textContent).toContain('"small-rules/no-print": "error"');
	});

	it("accepts a custom kicker and omits an absent subtitle", () => {
		const { container } = render(<HeroSplash kicker="Custom docs" subtitle="" title="Small rules" />);

		expect(screen.getByText("Custom docs").textContent).toBe("Custom docs");
		expect(container.querySelector(".hero-subtitle")).toBeNull();
	});
});

describe("PageHeader", () => {
	it("renders optional context with the page title", () => {
		render(<PageHeader kicker="Rule index" subtitle="Browse every rule." title="Rules" />);

		expect(screen.getByRole("heading", { level: 1, name: "Rules" }).textContent).toBe("Rules");
		expect(screen.getByText("Rule index").textContent).toBe("Rule index");
		expect(screen.getByText("Browse every rule.").textContent).toBe("Browse every rule.");
	});

	it("omits empty optional context", () => {
		const { container } = render(<PageHeader kicker="" subtitle="" title="Rules" />);

		expect(screen.getByRole("heading", { level: 1, name: "Rules" }).textContent).toBe("Rules");
		expect(container.querySelector(".hero-kicker")).toBeNull();
		expect(container.querySelector(".hero-subtitle")).toBeNull();
	});
});
