import { expect as playwrightExpect, test as playwrightIt } from "@playwright/test";

import { ruleManifest } from "$data/rule-manifest";
import { getRuleNewness } from "$data/rule-newness";

import type { Page } from "@playwright/test";

const allRulesPath = "rules/";
const baseUrl = "http://127.0.0.1:4321/small-rules/";
const complexOptionsRulePath = "rules/react/no-useless-use-memo/";
const inlineCodeRulePath = "rules/roblox/no-ianitor-success-access/";
const rulePath = "rules/roblox/no-print/";
const builtScriptPrefix = "/small-rules/_astro/";

const errorFixableRulePath = "rules/naming/prefer-optional-parameter/";
const transparent = "rgba(0, 0, 0, 0)";

interface BadgeStyle {
	readonly background: string;
	readonly color: string;
	readonly kind: "error" | "fixable" | "ink";
}

interface RuleBadgeColors {
	readonly badges: ReadonlyArray<BadgeStyle>;
	readonly flag: string;
	readonly focus: string;
	readonly ink: string;
}

async function getRuleBadgeColorsAsync(page: Page, theme: "dark" | "light"): Promise<RuleBadgeColors> {
	await page.evaluate((value) => {
		document.documentElement.dataset.theme = value;
	}, theme);

	return page.evaluate(() => {
		function resolveColor(token: string): string {
			const probe = document.createElement("span");
			probe.style.color = `var(${token})`;
			document.body.append(probe);
			const { color } = getComputedStyle(probe);
			probe.remove();
			return color;
		}

		function getKind(badge: Element): BadgeStyle["kind"] {
			if (badge.classList.contains("badge--error")) return "error";
			return badge.classList.contains("badge--fixable") ? "fixable" : "ink";
		}

		const badges = Array.from(document.querySelectorAll(".rule-badges .badge"), (badge) => {
			const style = getComputedStyle(badge);
			return { background: style.backgroundColor, color: style.color, kind: getKind(badge) };
		});

		return { badges, flag: resolveColor("--data-1"), focus: resolveColor("--focus"), ink: resolveColor("--ink-2") };
	});
}

function expectBadgeColorBudget({ badges, flag, focus, ink }: RuleBadgeColors): void {
	for (const badge of badges) {
		if (badge.kind === "error") {
			playwrightExpect(badge.color).toBe(flag);
			playwrightExpect(badge.background).not.toBe(transparent);
		} else {
			playwrightExpect(badge.color).toBe(badge.kind === "fixable" ? focus : ink);
			playwrightExpect(badge.background).toBe(transparent);
		}
	}
}

playwrightIt("renders the custom homepage sections", async ({ page }) => {
	await page.goto(baseUrl);

	await playwrightExpect(page.locator(".hero-splash")).toHaveCount(1);
	await playwrightExpect(page.locator(".hero-preview code")).toContainText('"@pobammer-ts/small-rules"');
	await playwrightExpect(page.locator(".category-card")).toHaveCount(ruleManifest.categories.length);
	await playwrightExpect(page.locator(".feature-card")).toHaveCount(3);
	await playwrightExpect(page.locator(".overprint")).toHaveCount(1);
	await playwrightExpect(page.locator(".overprint")).toHaveText(
		String(ruleManifest.categories.reduce((total, category) => total + category.rules.length, 0)),
	);
	await playwrightExpect(page.getByRole("link", { name: "Get started" })).toHaveAttribute(
		"href",
		"/small-rules/quick-start/",
	);
});

playwrightIt("shows an icon for every package manager tab", async ({ page }) => {
	await page.goto(`${baseUrl}quick-start/`);

	const tabs = page.locator(".package-manager-tabs [role='tab']");
	await playwrightExpect(tabs).toHaveCount(16);
	const tabList = await tabs.all();
	const maskImages = await Promise.all(
		tabList.map(async (tab) => tab.evaluate((element) => getComputedStyle(element, "::before").maskImage)),
	);

	for (const maskImage of maskImages) playwrightExpect(maskImage).not.toBe("none");
});

playwrightIt("renders the custom rule documentation sections", async ({ page }) => {
	await page.goto(`${baseUrl}${rulePath}`);

	await playwrightExpect(page.locator(".rule-badges .badge")).not.toHaveCount(0);
	await playwrightExpect(page.locator(".rule-summary-id")).toHaveText("small-rules/no-print");
	await playwrightExpect(page.locator(".rule-diagnostic")).not.toHaveCount(0);
	await playwrightExpect(page.locator("[data-rule-example]")).toHaveCount(2);
	await playwrightExpect(page.getByRole("button", { name: "Copy example" })).toHaveCount(2);
});

playwrightIt("renders backticked description text as inline code", async ({ page }) => {
	await page.goto(`${baseUrl}${inlineCodeRulePath}`);

	const summary = page.locator(".rule-summary-text");
	await playwrightExpect(summary).not.toContainText("`");
	await playwrightExpect(summary.locator("code").first()).toHaveText(".success");
});

playwrightIt("renders backticked pagination labels as inline code", async ({ page }) => {
	await page.goto(`${baseUrl}rules/react/`);

	const nextPage = page.locator(".pagination-links [rel='next']");
	await playwrightExpect(nextPage).toContainText("Ban React.FC");
	await playwrightExpect(nextPage).not.toContainText("`");
	await playwrightExpect(nextPage.locator("code")).toHaveText("React.FC");
});

playwrightIt("colors only the Error and Auto-fixable badges in both themes", async ({ page }) => {
	await page.goto(`${baseUrl}${errorFixableRulePath}`);

	const light = await getRuleBadgeColorsAsync(page, "light");
	const dark = await getRuleBadgeColorsAsync(page, "dark");

	playwrightExpect(light.badges.map((badge) => badge.kind)).toEqual(
		playwrightExpect.arrayContaining(["error", "fixable"]),
	);
	expectBadgeColorBudget(light);
	expectBadgeColorBudget(dark);

	await page.goto(`${baseUrl}${rulePath}`);

	const roblox = await getRuleBadgeColorsAsync(page, "dark");

	playwrightExpect(roblox.badges.map((badge) => badge.kind)).toContain("ink");
	expectBadgeColorBudget(roblox);
});

playwrightIt("wraps the rule description at about 72 characters", async ({ page }) => {
	await page.setViewportSize({ height: 900, width: 1600 });
	await page.goto(`${baseUrl}${errorFixableRulePath}`);

	const firstLineLength = await page.locator(".rule-summary-text p").evaluate((paragraph) => {
		const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		let firstTop: number | undefined;
		let count = 0;

		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
			for (let index = 0; index < (node.textContent?.length ?? 0); index += 1) {
				range.setStart(node, index);
				range.setEnd(node, index + 1);
				const top = Math.round(range.getBoundingClientRect().top);
				firstTop ??= top;
				if (top > firstTop) return count;
				count += 1;
			}
		}

		return count;
	});

	playwrightExpect(firstLineLength).toBeLessThanOrEqual(75);
});

playwrightIt("renders sidebar badges with the rule page badge component", async ({ page }) => {
	await page.goto(`${baseUrl}${rulePath}`);

	const sidebar = page.locator(".sidebar-content");
	const freshRuleCount = [...getRuleNewness().values()].filter(
		(freshness) => freshness.isNew || freshness.isUpdated,
	).length;

	await playwrightExpect(sidebar.locator(".sl-badge")).toHaveCount(0);
	await playwrightExpect(sidebar.locator(".badge.badge--compact:is(.badge--new, .badge--updated)")).toHaveCount(
		freshRuleCount,
	);
});

playwrightIt("copies the full rule name", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
	await page.goto(`${baseUrl}${rulePath}`);

	const copyButton = page.locator(".rule-summary-copy");
	await playwrightExpect(copyButton).toHaveAccessibleName("Copy rule name");
	await copyButton.click();

	await playwrightExpect(copyButton).toHaveAccessibleName("Rule name copied");
	playwrightExpect(await page.evaluate(async () => navigator.clipboard.readText())).toBe("small-rules/no-print");
});

playwrightIt("copies a rule example", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
	await page.goto(`${baseUrl}${rulePath}`);

	const copyButton = page.locator("[data-rule-example]").first().locator(".RuleExample-copy");
	await playwrightExpect(copyButton).toHaveAccessibleName("Copy example");
	await copyButton.click();

	await playwrightExpect(copyButton).toHaveAttribute("data-copied", "");
	await playwrightExpect(copyButton).toHaveAccessibleName("Example copied");
});

playwrightIt("expands and copies complex React rule options", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
	await page.goto(`${baseUrl}${complexOptionsRulePath}`);

	const disclosure = page.getByRole("button", { name: "25 static global factories" });
	await playwrightExpect(disclosure).toHaveAttribute("aria-expanded", "false");
	await disclosure.click();
	await playwrightExpect(disclosure).toHaveAttribute("aria-expanded", "true");
	await playwrightExpect(page.getByText("Default JSON")).toBeVisible();

	const copyButton = page.getByRole("button", { name: "Copy default JSON: staticGlobalFactories" });
	await copyButton.click();
	await playwrightExpect(page.getByRole("button", { name: "Copied: staticGlobalFactories" })).toHaveAttribute(
		"data-state",
		"copied",
	);
});

playwrightIt("filters the server-rendered rule catalog", async ({ page }) => {
	await page.goto(`${baseUrl}${allRulesPath}`);

	const cards = page.locator("[data-rule-card]");
	const catalogRuleCount = await cards.count();
	await playwrightExpect(page.getByText(`Showing ${catalogRuleCount} rules`, { exact: true })).toBeVisible();
	await page.getByLabel("Search rules").fill("no-print");
	await playwrightExpect(cards.filter({ visible: true })).toHaveCount(1);
	await playwrightExpect(page.getByText("Showing 1 rule", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Reset filters" }).click();
	await page.getByLabel("Category").selectOption("naming");
	const namingRuleCount = await cards.filter({ visible: true }).count();
	playwrightExpect(namingRuleCount).toBeGreaterThan(0);
	await playwrightExpect(
		page.getByText(`Showing ${String(namingRuleCount)} ${namingRuleCount === 1 ? "rule" : "rules"}`, {
			exact: true,
		}),
	).toBeVisible();
});

playwrightIt("keeps the catalog readable without JavaScript", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(`${baseUrl}${allRulesPath}`);

	const cards = page.locator("[data-rule-card]");
	const catalogRuleCount = await cards.count();
	await playwrightExpect(page.getByText(`Showing ${catalogRuleCount} rules`, { exact: true })).toBeVisible();
	await playwrightExpect(page.locator("[data-rule-filters]")).toBeHidden();
	await playwrightExpect(
		page.locator('[data-rule-card][href="/small-rules/rules/roblox/no-print/"]'),
	).toHaveAttribute("href", "/small-rules/rules/roblox/no-print/");

	await context.close();
});

playwrightIt("exposes filters, links, and copy controls to the keyboard", async ({ page }) => {
	await page.goto(`${baseUrl}${allRulesPath}`);

	const search = page.getByLabel("Search rules");
	await search.focus();
	await playwrightExpect(search).toBeFocused();
	await page.keyboard.press("Tab");
	await playwrightExpect(page.getByLabel("Category")).toBeFocused();
	await page.keyboard.press("Tab");
	await playwrightExpect(page.getByRole("button", { name: "Reset filters" })).toBeFocused();
	await page.keyboard.press("Tab");
	await playwrightExpect(page.locator("[data-rule-card]").first()).toBeFocused();

	await page.goto(`${baseUrl}${rulePath}`);
	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await copyButton.focus();
	await playwrightExpect(copyButton).toBeFocused();
	await playwrightExpect(copyButton).toBeVisible();
});

playwrightIt("preserves essential UI in forced colors", async ({ browser }) => {
	const context = await browser.newContext({ forcedColors: "active" });
	const page = await context.newPage();
	await page.goto(`${baseUrl}${rulePath}`);

	const heading = page.getByRole("heading", { level: 1 });
	const badge = page.locator(".badge").first();
	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await playwrightExpect(heading).toBeVisible();
	await playwrightExpect(badge).toBeVisible();
	await playwrightExpect(copyButton).toBeVisible();
	await copyButton.focus();
	await playwrightExpect(copyButton).toBeFocused();

	const headingFill = await heading.evaluate((element) => getComputedStyle(element).webkitTextFillColor);
	playwrightExpect(headingFill).not.toBe("rgba(0, 0, 0, 0)");
	await context.close();
});

playwrightIt("shows copy controls on a touch viewport", async ({ browser }) => {
	const context = await browser.newContext({
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	});
	const page = await context.newPage();
	await page.goto(`${baseUrl}${rulePath}`);

	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await playwrightExpect(copyButton).toBeVisible();
	await playwrightExpect(copyButton).toHaveCSS("opacity", "1");
	playwrightExpect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

	await context.close();
});

playwrightIt("keeps build-only code out of browser assets", async ({ page }) => {
	const scriptBodies: Array<Promise<string>> = [];
	page.on("response", (response) => {
		if (response.request().resourceType() === "script") {
			scriptBodies.push(response.text());
		}
	});

	await page.goto(`${baseUrl}${rulePath}`);
	await playwrightExpect(page.getByRole("button", { name: "Copy example" })).toHaveCount(2);
	const resolvedScriptBodies = await Promise.all(scriptBodies);
	const browserCode = resolvedScriptBodies.join("\n");
	for (const forbiddenText of [
		"yuku-parser",
		"vitest",
		"documentation-rule-extractor",
		"src/rules/roblox/no-print",
	]) {
		playwrightExpect(browserCode).not.toContain(forbiddenText);
	}

	const scriptSources = await page
		.locator("script[src]")
		.evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));

	playwrightExpect(scriptSources.every((source) => source?.startsWith(builtScriptPrefix) === true)).toBe(true);
});
