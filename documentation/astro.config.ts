import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { Predicate } from "effect";

import { ruleRedirects, SITE_BASE } from "./src/data/rule-redirects";
import { ruleSidebarGroups } from "./src/data/rule-sidebar";
import createContextualMenuIntegration from "./src/integrations/contextual-menu";
import { syntaxDarkTheme, syntaxLightTheme } from "./src/utilities/syntax-themes";

import type { AstroIntegration } from "astro";

function ensureAstroIntegration<Integration extends AstroIntegration>(
	integration: Integration,
): AstroIntegration & Pick<Integration, "hooks" | "name"> {
	if (!Predicate.isObject(integration)) {
		throw new TypeError(
			`Expected Astro integration to be an object, received: ${Object.prototype.toString.call(integration)}`,
		);
	}

	const name = "name" in integration ? integration.name : undefined;
	if (name === undefined || name.length === 0) {
		throw new Error(`Expected Astro integration to have a non-empty string "name" property, received: ${name}`);
	}

	const hooks = "hooks" in integration ? integration.hooks : undefined;
	if (!Predicate.isObject(hooks)) {
		throw new TypeError(
			`Expected Astro integration "${name}" to have a "hooks" object, received: ${String(hooks)}`,
		);
	}

	return { name, hooks };
}

export default defineConfig({
	base: SITE_BASE,
	integrations: [
		ensureAstroIntegration(
			starlight({
				components: {
					PageTitle: "./src/components/overrides/page-title.astro",
					Pagination: "./src/components/overrides/pagination.astro",
					Sidebar: "./src/components/overrides/sidebar.astro",
				},
				customCss: [
					"@fontsource-variable/ibm-plex-sans",
					"@fontsource-variable/newsreader/opsz.css",
					"@fontsource-variable/newsreader/opsz-italic.css",
					"@fontsource/ibm-plex-mono/400.css",
					"@fontsource/ibm-plex-mono/500.css",
					"./src/styles/custom.css",
				],
				description: "Oxlint-native rules for TypeScript, React, and roblox-ts",
				editLink: {
					baseUrl: "https://github.com/howmanysmall/small-rules/edit/main/documentation/",
				},
				expressiveCode: {
					styleOverrides: {
						borderColor: "var(--rule)",
						borderRadius: "0",
						borderWidth: "1px",
						codeFontFamily: "var(--font-mono)",
						uiFontFamily: "var(--font-sans)",
					},
					themes: [syntaxLightTheme, syntaxDarkTheme],
				},
				favicon: "/favicon.svg?v=3",
				plugins: [],
				routeMiddleware: "./src/route-data/rule-table-of-contents.ts",
				sidebar: [
					{
						items: [
							{ label: "Home", slug: "index" },
							{ label: "Introduction", slug: "introduction" },
							{ label: "Quick Start", slug: "quick-start" },
							{ label: "Configuration", slug: "configuration" },
							{ label: "Changelog", slug: "changelog" },
						],
						label: "Getting Started",
					},
					...ruleSidebarGroups,
				],
				social: [
					{
						href: "https://github.com/howmanysmall/small-rules",
						icon: "github",
						label: "GitHub",
					},
				],
				title: "small-rules",
			}),
		),
		ensureAstroIntegration(mdx()),
		ensureAstroIntegration(react({ compiler: true })),
		ensureAstroIntegration(createContextualMenuIntegration()),
	],
	redirects: ruleRedirects,
	site: "https://docs.howmanysmall.com",
	vite: {
		build: {
			rolldownOptions: {
				output: {
					assetFileNames: "_astro/[name].[hash][extname]",
					chunkFileNames: "_astro/[name].[hash].js",
					entryFileNames: "_astro/[name].[hash].js",
				},
			},
		},
		css: {
			transformer: "lightningcss",
		},
		resolve: {
			tsconfigPaths: true,
		},
	},
});
