import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { Predicate } from "effect";

import { ruleSidebarGroups } from "./src/data/rule-sidebar";
import contextualMenu from "./src/integrations/contextual-menu";
import motion from "./src/integrations/motion";

import type { AstroIntegration } from "astro";

function fromRepositoryRoot(path: string): string {
	return fileURLToPath(new URL(`../${path}`, import.meta.url));
}

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

	return {
		name,
		hooks: integration.hooks,
	};
}

const reactOptions = {
	babel: {
		plugins: ["babel-plugin-react-compiler"],
	},
};

export default defineConfig({
	base: "/small-rules",
	integrations: [
		ensureAstroIntegration(
			starlight({
				components: {
					PageTitle: "./src/components/overrides/page-title.astro",
					Sidebar: "./src/components/overrides/sidebar.astro",
				},
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
				favicon: "/favicon.svg?v=2",
				head: [
					{
						attrs: {
							as: "font",
							crossorigin: "anonymous",
							href: "/small-rules/fonts/geist-latin-wght-normal.woff2",
							rel: "preload",
							type: "font/woff2",
						},
						tag: "link",
					},
					{
						attrs: {
							as: "font",
							crossorigin: "anonymous",
							href: "/small-rules/fonts/ibm-plex-sans-latin-wght-normal.woff2",
							rel: "preload",
							type: "font/woff2",
						},
						tag: "link",
					},
				],
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
		ensureAstroIntegration(react(reactOptions)),
		ensureAstroIntegration(contextualMenu()),
		ensureAstroIntegration(motion()),
	],
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
			alias: {
				"$oxc-rules": fromRepositoryRoot("src/rules"),
				"$oxc-types": fromRepositoryRoot("src/types"),
				"$oxc-utilities": fromRepositoryRoot("src/utilities"),
				"$small-rules": fromRepositoryRoot("src/index.ts"),
			},
		},
	},
});
