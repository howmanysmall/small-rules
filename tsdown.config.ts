import { readFile } from "node:fs/promises";
import { type } from "arktype";
import { defineConfig } from "tsdown";

const isPackageJsonDependencies = type({
	"+": "ignore",
	"dependencies?": type("Record<string, string>").readonly().or("null"),
	"optionalDependencies?": type("Record<string, string>").readonly().or("null"),
	"peerDependencies?": type("Record<string, string>").readonly().or("null"),
}).readonly();

const ALWAYS_KEEP = new Set(["oxlint-plugin-utilities"]);
const NATIVE_NEVER_BUNDLE = ["oxc-resolver", /^@oxc-resolver\//u, "yuku-parser", /^@yuku-parser\//u] as const;

async function getNeverBundleAsync(): Promise<Array<string>> {
	const fileContent = await readFile("package.json", "utf8");
	const packageJson = isPackageJsonDependencies(JSON.parse(fileContent));
	if (packageJson instanceof type.errors) {
		const error = new TypeError(`Invalid package.json: ${packageJson.summary}`);
		Error.captureStackTrace(error, getNeverBundleAsync);
		throw error;
	}

	const baseNeverBundle = [
		...Object.keys(packageJson.dependencies ?? {}),
		...Object.keys(packageJson.peerDependencies ?? {}),
		...Object.keys(packageJson.optionalDependencies ?? {}),
	];

	const neverBundle = baseNeverBundle.filter((packageName) => !ALWAYS_KEEP.has(packageName));
	return neverBundle;
}

const neverBundle = await getNeverBundleAsync();
const MATCH_ANYTHING = /.*/u;
const configuration = defineConfig((inlineConfiguration) => {
	const bundleAll = "bundleAll" in inlineConfiguration && inlineConfiguration.bundleAll === true;

	return {
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
		platform: "node",
		tsconfig: "tsconfig.json",
	};
});

export default configuration;
