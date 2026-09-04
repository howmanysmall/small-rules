import { expect as playwrightExpect, test as playwrightIt } from "@playwright/test";

import { ruleManifest } from "$data/rule-manifest";

const allRulesPath = "rules/";
const baseUrl = "http://127.0.0.1:4321/small-rules/";
const complexOptionsRulePath = "rules/react/no-useless-use-memo/";
const rulePath = "rules/roblox/no-print/";
const builtScriptPrefix = "/small-rules/_astro/";

playwrightIt("renders the custom homepage sections", async ({ page }) => {
	await page.goto(baseUrl);

	await playwrightExpect(page.locator(".hero-splash")).toHaveCount(1);
	await playwrightExpect(page.locator(".hero-preview code")).toContainText('"@pobammer-ts/small-rules"');
	await playwrightExpect(page.locator(".category-card")).toHaveCount(ruleManifest.categories.length);
	await playwrightExpect(page.locator(".feature-card")).toHaveCount(3);
	await playwrightExpect(page.getByRole("link", { name: "Get started" })).toHaveAttribute(
		"href",
		"/small-rules/quick-start/",
	);
});

playwrightIt("renders the custom rule documentation sections", async ({ page }) => {
	await page.goto(`${baseUrl}${rulePath}`);

	await playwrightExpect(page.locator(".rule-badges .badge")).not.toHaveCount(0);
	await playwrightExpect(page.locator(".rule-summary-id")).toHaveText("small-rules/no-print");
	await playwrightExpect(page.locator(".rule-diagnostic")).not.toHaveCount(0);
	await playwrightExpect(page.locator("[data-rule-example]")).toHaveCount(2);
	await playwrightExpect(page.getByRole("button", { name: "Copy example" })).toHaveCount(2);
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
	const scriptBodies: Array<string> = [];
	page.on("response", async (response) => {
		if (response.request().resourceType() === "script") {
			scriptBodies.push(await response.text());
		}
	});

	await page.goto(`${baseUrl}${rulePath}`);
	await page.waitForLoadState("networkidle");
	const browserCode = scriptBodies.join("\n");
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
