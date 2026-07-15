import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

import { ruleSidebarGroups } from "./src/data/rule-sidebar";
import contextualMenu from "./src/integrations/contextual-menu";
import motion from "./src/integrations/motion";

import type { AstroIntegration } from "astro";

function fromRepositoryRoot(path: string): string {
	return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

function ensureAstroIntegration(integration: unknown): AstroIntegration {
	if (typeof integration !== "object" || integration === null) {
		const error = new Error(`Expected Astro integration to be an object, received: ${String(integration)}`);
		Error.captureStackTrace(error, ensureAstroIntegration);
		throw error;
	}

	const name = "name" in integration ? integration.name : undefined;
	if (typeof name !== "string" || name.length === 0) {
		const error = new Error(
			`Expected Astro integration to have a non-empty string "name" property, received: ${String(name)}`,
		);
		Error.captureStackTrace(error, ensureAstroIntegration);
		throw error;
	}

	const hooks = "hooks" in integration ? integration.hooks : undefined;
	if (typeof hooks !== "object" || hooks === null) {
		const error = new Error(
			`Expected Astro integration "${name}" to have a "hooks" object, received: ${String(hooks)}`,
		);
		Error.captureStackTrace(error, ensureAstroIntegration);
		throw error;
	}

	return {
		hooks,
		name,
	};
}

export default defineConfig({
	base: "/small-rules",
	integrations: [
		ensureAstroIntegration(
			starlight({
				customCss: ["./src/styles/custom.css"],
				description: "Oxlint-native rules for TypeScript, React, and roblox-ts",
				editLink: {
					baseUrl: "https://github.com/howmanysmall/small-rules/edit/main/documentation/",
				},
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
				plugins: [],
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
			alias: {
				"$oxc-rules": fromRepositoryRoot("src/rules"),
				"$oxc-types": fromRepositoryRoot("src/types"),
				"$oxc-utilities": fromRepositoryRoot("src/utilities"),
				"$small-rules": fromRepositoryRoot("src/index.ts"),
			},
		},
	},
});
