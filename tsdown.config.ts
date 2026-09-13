import { cp, mkdir } from "node:fs/promises";
import nodePath from "node:path";
import { defineConfig } from "tsdown";

import { renderBundleBanner } from "./scripts/utilities/vendored-notices.ts";

import type { UserConfig } from "tsdown";
import type { Arrayable } from "type-fest";

// Private workspace packages are unpublished, so inline them into dist.
const ALWAYS_BUNDLE = ["@small-rules/arktype-utilities"];
const NATIVE_NEVER_BUNDLE = ["oxc-resolver", /^@oxc-resolver\//u, "yuku-parser", /^@yuku-parser\//u] as const;

const MATCH_ANYTHING = /.*/u;
const VENDORED_NOTICE = renderBundleBanner();

const configuration = defineConfig((inlineConfiguration): Arrayable<UserConfig> => {
	// Unknown CLI flags never arrive as named keys; cac stashes them in the
	// `--` passthrough array, so accept both spellings.
	const extraArguments: ReadonlyArray<unknown> =
		"--" in inlineConfiguration && Array.isArray(inlineConfiguration["--"]) ? inlineConfiguration["--"] : [];
	const bundleAll =
		("bundleAll" in inlineConfiguration && inlineConfiguration.bundleAll === true) ||
		extraArguments.includes("--bundleAll");
	const includeLocal =
		("includeLocal" in inlineConfiguration && inlineConfiguration.includeLocal === true) ||
		extraArguments.includes("--include-local");

	const userConfiguration: UserConfig = {
		attw: {
			enabled: true,
			level: "error",
			profile: "esm-only",
		},
		clean: true,
		deps: bundleAll
			? {
					alwaysBundle: [MATCH_ANYTHING],
					neverBundle: [...NATIVE_NEVER_BUNDLE],
					onlyBundle: false,
				}
			: { alwaysBundle: ALWAYS_BUNDLE },
		dts: {
			incremental: true,
			resolver: "oxc",
		},
		entry: "./src/index.ts",
		fixedExtension: false,
		format: ["esm"],
		outDir: "dist",
		outputOptions: { postBanner: VENDORED_NOTICE },
		platform: "node",
		publint: {
			enabled: true,
			level: "error",
		},
		treeshake: {
			moduleSideEffects: false,
			propertyReadSideEffects: false,
			unknownGlobalSideEffects: false,
		},
		tsconfig: "tsconfig.lib.json",
	};

	if (includeLocal) {
		userConfiguration.hooks = {
			"build:done": async (buildContext) => {
				const jsChunks = buildContext.chunks.filter(
					(chunk) => chunk.type === "chunk" && !chunk.fileName.endsWith(".d.ts"),
				);
				const [jsChunk] = jsChunks;
				if (jsChunk?.fileName !== "index.js" || jsChunks.length !== 1) {
					throw new Error(
						`Expected exactly dist/index.js, got: ${jsChunks.map((chunk) => chunk.fileName).join(", ") || "(none)"}`,
					);
				}

				await mkdir("plugins", { recursive: true });
				await cp(nodePath.join(jsChunk.outDir, jsChunk.fileName), "plugins/small-rules.js", { force: true });
				try {
					await cp(nodePath.join(jsChunk.outDir, `${jsChunk.fileName}.map`), "plugins/small-rules.js.map", {
						force: true,
					});
				} catch {
					// Sourcemaps disabled; nothing to copy.
				}
			},
		};
	}

	return userConfiguration;
});

export default configuration;
