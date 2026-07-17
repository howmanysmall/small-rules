import { expect, test as it } from "@playwright/test";

const allRulesPath = "rules/";
const baseUrl = "http://127.0.0.1:4321/small-rules/";
const complexOptionsRulePath = "rules/react/no-useless-use-memo/";
const rulePath = "rules/roblox/no-print/";
const builtScriptPrefix = "/small-rules/_astro/";

it("renders the custom homepage sections", async ({ page }) => {
	await page.goto(baseUrl);

	await expect(page.locator(".hero-splash")).toHaveCount(1);
	await expect(page.locator(".hero-preview code")).toContainText('"@pobammer-ts/small-rules"');
	await expect(page.locator(".category-card")).toHaveCount(4);
	await expect(page.locator(".feature-card")).toHaveCount(3);
	await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/small-rules/quick-start/");
});

it("renders the custom rule documentation sections", async ({ page }) => {
	await page.goto(`${baseUrl}${rulePath}`);

	await expect(page.locator(".rule-badges .badge")).not.toHaveCount(0);
	await expect(page.locator(".rule-summary-id")).toHaveText("small-rules/no-print");
	await expect(page.locator(".rule-diagnostic")).not.toHaveCount(0);
	await expect(page.locator("[data-rule-example]")).toHaveCount(2);
	await expect(page.getByRole("button", { name: "Copy example" })).toHaveCount(2);
});

it("copies a rule example", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
	await page.goto(`${baseUrl}${rulePath}`);

	const copyButton = page.locator("[data-rule-example]").first().locator(".RuleExample-copy");
	await expect(copyButton).toHaveAccessibleName("Copy example");
	await copyButton.click();

	await expect(copyButton).toHaveAttribute("data-copied", "");
	await expect(copyButton).toHaveAccessibleName("Example copied");
});

it("expands and copies complex React rule options", async ({ page }) => {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
	await page.goto(`${baseUrl}${complexOptionsRulePath}`);

	const disclosure = page.getByRole("button", { name: "25 static global factories" });
	await expect(disclosure).toHaveAttribute("aria-expanded", "false");
	await disclosure.click();
	await expect(disclosure).toHaveAttribute("aria-expanded", "true");
	await expect(page.getByText("Default JSON")).toBeVisible();

	const copyButton = page.getByRole("button", { name: "Copy default JSON: staticGlobalFactories" });
	await copyButton.click();
	await expect(page.getByRole("button", { name: "Copied: staticGlobalFactories" })).toHaveAttribute(
		"data-state",
		"copied",
	);
});

it("filters the server-rendered rule catalog", async ({ page }) => {
	await page.goto(`${baseUrl}${allRulesPath}`);

	const cards = page.locator("[data-rule-card]");
	await expect(cards).toHaveCount(90);
	await page.getByLabel("Search rules").fill("no-print");
	await expect(cards.filter({ visible: true })).toHaveCount(1);
	await expect(page.getByText("Showing 1 rule", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Reset filters" }).click();
	await page.getByLabel("Category").selectOption("naming");
	await expect(cards.filter({ visible: true })).toHaveCount(7);
	await expect(page.getByText("Showing 7 rules", { exact: true })).toBeVisible();
});

it("keeps the catalog readable without JavaScript", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(`${baseUrl}${allRulesPath}`);

	await expect(page.locator("[data-rule-card]")).toHaveCount(90);
	await expect(page.locator("[data-rule-filters]")).toBeHidden();
	await expect(page.locator('[data-rule-card][href="/small-rules/rules/roblox/no-print/"]')).toHaveAttribute(
		"href",
		"/small-rules/rules/roblox/no-print/",
	);

	await context.close();
});

it("exposes filters, links, and copy controls to the keyboard", async ({ page }) => {
	await page.goto(`${baseUrl}${allRulesPath}`);

	const search = page.getByLabel("Search rules");
	await search.focus();
	await expect(search).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.getByLabel("Category")).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.getByRole("button", { name: "Reset filters" })).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.locator("[data-rule-card]").first()).toBeFocused();

	await page.goto(`${baseUrl}${rulePath}`);
	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await copyButton.focus();
	await expect(copyButton).toBeFocused();
	await expect(copyButton).toBeVisible();
});

it("preserves essential UI in forced colors", async ({ browser }) => {
	const context = await browser.newContext({ forcedColors: "active" });
	const page = await context.newPage();
	await page.goto(`${baseUrl}${rulePath}`);

	const heading = page.getByRole("heading", { level: 1 });
	const badge = page.locator(".badge").first();
	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await expect(heading).toBeVisible();
	await expect(badge).toBeVisible();
	await expect(copyButton).toBeVisible();
	await copyButton.focus();
	await expect(copyButton).toBeFocused();

	const headingFill = await heading.evaluate((element) => getComputedStyle(element).webkitTextFillColor);
	expect(headingFill).not.toBe("rgba(0, 0, 0, 0)");
	await context.close();
});

it("shows copy controls on a touch viewport", async ({ browser }) => {
	const context = await browser.newContext({
		hasTouch: true,
		isMobile: true,
		viewport: { height: 844, width: 390 },
	});
	const page = await context.newPage();
	await page.goto(`${baseUrl}${rulePath}`);

	const copyButton = page.locator("[data-rule-example]").first().getByRole("button", { name: "Copy example" });
	await expect(copyButton).toBeVisible();
	await expect(copyButton).toHaveCSS("opacity", "1");
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

	await context.close();
});

it("keeps build-only code out of browser assets", async ({ page }) => {
	const scriptBodies: Array<string> = [];
	page.on("response", async (response) => {
		if (response.request().resourceType() === "script") {
			scriptBodies.push(await response.text());
		}
	});

	await page.goto(`${baseUrl}${rulePath}`);
	await page.waitForLoadState("networkidle");
	const browserCode = scriptBodies.join("\n");
	for (const forbiddenText of ["yuku-parser", "vitest", "documentation-rule-extractor", "src/rules/no-print"]) {
		expect(browserCode).not.toContain(forbiddenText);
	}

	const scriptSources = await page
		.locator("script[src]")
		.evaluateAll((scripts) => scripts.map((script) => script.getAttribute("src")));
	expect(scriptSources.every((source) => source?.startsWith(builtScriptPrefix) === true)).toBe(true);
});
