import { expect, test as it } from "@playwright/test";

const allRulesPath = "rules/";
const baseUrl = "http://127.0.0.1:4321/small-rules/";
const rulePath = "rules/roblox/no-print/";
const builtScriptPrefix = "/small-rules/_astro/";

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
	await expect(page.locator('[data-rule-card][data-rule-search-text^="no-print "]')).toHaveAttribute(
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
	const copyButton = page.getByRole("button", { name: "Copy example" }).first();
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
	const copyButton = page.getByRole("button", { name: "Copy example" }).first();
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

	const copyButton = page.getByRole("button", { name: "Copy example" }).first();
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
