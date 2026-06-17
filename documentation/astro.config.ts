import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";

import { ruleSidebarGroups } from "./src/data/rule-sidebar";
import contextualMenu from "./src/integrations/contextual-menu";
import motion from "./src/integrations/motion";

function ensureAstroIntegration<T extends { name: unknown; hooks: unknown }>(integration: T): T {
	if (typeof integration.name !== "string" || integration.name.length === 0) {
		const error = new Error(
			`Expected Astro integration to have a non-empty string "name" property, received: ${String(integration.name)}`,
		);
		Error.captureStackTrace(error, ensureAstroIntegration);
		throw error;
	}

	if (typeof integration.hooks !== "object" || integration.hooks === null) {
		const error = new Error(
			`Expected Astro integration "${integration.name}" to have a "hooks" object, received: ${String(integration.hooks)}`,
		);
		Error.captureStackTrace(error, ensureAstroIntegration);
		throw error;
	}

	return integration;
}

export default defineConfig({
	base: "/small-rules",
	integrations: [
		ensureAstroIntegration(
			starlight({
				customCss: ["./src/styles/custom.css"],
				description: "Oxlint-native rules for TypeScript, React, and roblox-ts",
				expressiveCode: {
					styleOverrides: {
						borderColor: "var(--glass-border)",
						borderRadius: "0.5rem",
						borderWidth: "1px",
					},
					themes: ["github-light", "dracula"],
				},
				logo: {
					replacesTitle: false,
					src: "./src/assets/new-logo.svg",
				},
				plugins: [starlightLinksValidator()],
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
		ensureAstroIntegration(react()),
		ensureAstroIntegration(contextualMenu()),
		ensureAstroIntegration(motion()),
	],
	site: "https://howmanysmall.github.io",
	vite: {
		build: {
			rollupOptions: {
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
	},
});
