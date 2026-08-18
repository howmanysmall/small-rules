import { readFile } from "node:fs/promises";
import { type } from "arktype";
import { defineConfig } from "tsdown";

const isStringRecord = type("Record<string, string>").readonly();
const isPackageJsonDependencies = type({
	"+": "ignore",
	"dependencies?": isStringRecord.or("null"),
	"optionalDependencies?": isStringRecord.or("null"),
	"peerDependencies?": isStringRecord.or("null"),
}).readonly();

const ALWAYS_KEEP = new Set(["oxlint-plugin-utilities"]);
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

/**
 * Third-party attribution embedded in the published bundle.
 *
 * The vendored sources under `src/rules/anti-slop/` carry `//` provenance headers that
 * minification strips, so the upstream MIT notice has to be reattached to the output.
 * `postBanner` runs after minify, and `/*!` marks it as a legal comment, so neither pass
 * can drop it. Keep in sync with `THIRD-PARTY-NOTICES.md`; see `docs/vendoring.md`.
 */
const VENDORED_NOTICE = `/*!
 * This bundle includes code from the following third-party projects.
 * Full notices: https://github.com/howmanysmall/small-rules/blob/main/THIRD-PARTY-NOTICES.md
 *
 * anti-slop <https://github.com/dmmulroy/anti-slop>
 * Copyright (c) 2026 Dillon Mulroy
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */`;

const configuration = defineConfig((inlineConfiguration) => {
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
			: { neverBundle },
		dts: {
			incremental: true,
			resolver: "oxc",
			tsgo: true,
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
		tsconfig: "tsconfig.json",
	};
});

export default configuration;
