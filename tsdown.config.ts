import { readFile } from "node:fs/promises";
import { isDictionaryOfStrings, isMaybeNull } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { defineConfig } from "tsdown";

import { renderBundleBanner } from "./scripts/utilities/vendored-notices.ts";

import type { UserConfig } from "tsdown";
import type { Arrayable } from "type-fest";

const isPackageJsonDependencies = type({
	"+": "ignore",
	"dependencies?": isDictionaryOfStrings.or(isMaybeNull),
	"optionalDependencies?": isDictionaryOfStrings.or(isMaybeNull),
	"peerDependencies?": isDictionaryOfStrings.or(isMaybeNull),
}).readonly();

const ALWAYS_KEEP = new Set(["@small-rules/arktype-utilities", "oxlint-plugin-utilities"]);
// Private workspace packages are unpublished, so inline them into dist.
const ALWAYS_BUNDLE = ["@small-rules/arktype-utilities"];
const NATIVE_NEVER_BUNDLE = ["oxc-resolver", /^@oxc-resolver\//u, "yuku-parser", /^@yuku-parser\//u] as const;

async function getNeverBundleAsync(): Promise<Array<string>> {
	const fileContent = await readFile("package.json", "utf8");
	const packageJson = isPackageJsonDependencies(JSON.parse(fileContent));
	if (packageJson instanceof type.errors) throw new TypeError(`Invalid package.json: ${packageJson.summary}`);

	const baseNeverBundle = [
		...Object.keys(packageJson.dependencies ?? {}),
		...Object.keys(packageJson.peerDependencies ?? {}),
		...Object.keys(packageJson.optionalDependencies ?? {}),
	];

	return baseNeverBundle.filter((packageName) => !ALWAYS_KEEP.has(packageName));
}

const neverBundle = await getNeverBundleAsync();
const MATCH_ANYTHING = /.*/u;

const VENDORED_NOTICE = renderBundleBanner();

const configuration = defineConfig((inlineConfiguration): Arrayable<UserConfig> => {
	const bundleAll = "bundleAll" in inlineConfiguration && inlineConfiguration.bundleAll === true;

	return {
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
			: { alwaysBundle: ALWAYS_BUNDLE, neverBundle },
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
});

export default configuration;
