import { expect } from "vitest";
import rule from "$oxc-rules/roblox/require-module-level-instantiation";
import { fuzz } from "@vitiate/core";
import { FuzzedDataProvider } from "@vitiate/fuzzed-data-provider";

import { createRuleExecutor } from "./rule-harness/execute";

import type { NormalizedValidCase } from "./rule-harness/types";

const IMPORT_STYLES: ReadonlyArray<"default" | "named" | "renamed"> = ["default", "named", "renamed"];
const NESTED_SCOPES: ReadonlyArray<"arrow" | "function" | "method"> = ["arrow", "function", "method"];
const execute = createRuleExecutor("require-module-level-instantiation", rule);

function bytesToHex(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("hex");
}

function createCase(code: string, options: ReadonlyArray<unknown>): NormalizedValidCase {
	return {
		code,
		filename: "case.ts",
		kind: "valid",
		language: "ts",
		options,
		settings: {},
		sourceType: "module",
	};
}

function nestInstantiation(instantiation: string, scope: "arrow" | "function" | "method"): string {
	if (scope === "arrow") return `const run = () => ${instantiation};`;
	if (scope === "function") return `function run() { return ${instantiation}; }`;
	return `class Container { run() { return ${instantiation}; } }`;
}

function createImportDeclaration(
	importStyle: "default" | "named" | "renamed",
	className: string,
	localName: string,
	importSource: string,
): string {
	if (importStyle === "default") return `import ${localName} from ${JSON.stringify(importSource)};`;
	if (importStyle === "named") return `import { ${className} } from ${JSON.stringify(importSource)};`;
	return `import { ${className} as ${localName} } from ${JSON.stringify(importSource)};`;
}

fuzz(
	"reports only tracked imports instantiated below module scope",
	(data): void => {
		const provider = new FuzzedDataProvider(data);
		const importStyle = provider.pickValue(IMPORT_STYLES);
		const nested = provider.consumeBoolean();
		const tracked = provider.consumeBoolean();
		const className = `Tracked${bytesToHex(provider.consumeBytes(12))}`;
		const localName = importStyle === "named" ? className : `Local${bytesToHex(provider.consumeBytes(12))}`;
		const importSource = `@fuzz/source-${bytesToHex(provider.consumeBytes(16))}`;
		const configuredSource = tracked ? importSource : `${importSource}-untracked`;
		const configuredClassName = importStyle === "default" ? localName : className;
		const importDeclaration = createImportDeclaration(importStyle, className, localName, importSource);
		const instantiation = `new ${localName}()`;
		const statement = nested
			? nestInstantiation(instantiation, provider.pickValue(NESTED_SCOPES))
			: `const instance = ${instantiation};`;
		const result = execute(
			createCase(`${importDeclaration}\n${statement}`, [
				{ classes: { [configuredClassName]: configuredSource } },
			]),
		);
		const expectedCount = nested && tracked ? 1 : 0;

		expect(result.diagnostics).toHaveLength(expectedCount);
		if (expectedCount === 0) return;

		expect(result.diagnostics[0]).toMatchObject({
			data: { className: configuredClassName, importSource: configuredSource },
			messageId: "mustBeModuleLevel",
		});
	},
	{ maxLen: 256 },
);
