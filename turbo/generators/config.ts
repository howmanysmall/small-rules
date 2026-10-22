import { existsSync, readFileSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";
import { type } from "arktype";
import { exec } from "tinyexec";

import { insertSorted } from "./src/insert-sorted";

import type { PlopTypes } from "@turbo/gen";

// Run with `turbo gen <generator>`, or `turbo gen` to pick one. Generators run
// from the repository root, so every path here is relative to it.

const KEBAB_CASE_REGEXP = /^[a-z][\da-z]*(?:-[\da-z]+)*$/u;
const CATEGORY_KEY_REGEXP = /^\t{3}key: "(?<key>[^"]+)",$/gmu;
const RULE_IMPORT_REGEXP = /^import \w+ from "\$oxc-rules\/(?<key>[^"]+)";$/u;
const RULE_ENTRY_REGEXP = /^\t{2}"(?<key>[^"]+)": \w+,$/u;
const MANIFEST_ENTRY_REGEXP = /^\t{4}\{ name: "(?<key>[^"]+)" \},$/u;

const MANIFEST_PATH = "documentation/src/data/rule-manifest.ts";
const PLUGIN_INDEX_PATH = "src/index.ts";

const isAnswers = type({
	name: "string",
	"+": "ignore",
	"category?": "string",
	"location?": "'packages' | 'tools'",
});

type Answers = typeof isAnswers.infer;

/** Root-relative paths a generator creates from its answers. */
type TargetPaths = (answers: Answers) => ReadonlyArray<string>;

function getPackageTargets({ name, location }: Answers): ReadonlyArray<string> {
	return [`${location ?? "packages"}/${name}`];
}

function getOpenCodePluginTargets({ name }: Answers): ReadonlyArray<string> {
	return [`.opencode/packages/plugins/${name}`, `.opencode/plugins/${name}.ts`];
}

/**
 * Rule names are global, so a name is taken if any category already has it.
 *
 * @param answers - The answers so far.
 * @returns The paths the rule would create, plus every existing rule with the name.
 */
function getRuleTargets({ name, category }: Answers): ReadonlyArray<string> {
	return [
		...readCategories().map((key) => `src/rules/${key}/${name}.ts`),
		`documentation/src/content/docs/rules/${category ?? ""}/${name}.mdx`,
	];
}

function readCategories(): ReadonlyArray<string> {
	const manifest = readFileSync(MANIFEST_PATH, "utf8");
	return [...manifest.matchAll(CATEGORY_KEY_REGEXP)].flatMap(({ groups }) => groups?.key ?? []);
}

function checkName(answers: Answers, targets: TargetPaths): string | true {
	if (!KEBAB_CASE_REGEXP.test(answers.name)) return "Use kebab-case, like `string-utilities`.";
	const taken = targets(answers).find((target) => existsSync(nodePath.join(cwd(), target)));
	return taken === undefined ? true : `${taken} already exists.`;
}

function validateNotEmpty(input: string): string | true {
	return input.trim().length > 0 || "Write one line.";
}

/**
 * Prompt validation is skipped when answers come from `turbo gen --args`, so
 * the name is checked again before anything is written.
 *
 * @param targets - The paths the generator creates.
 * @returns The action that rejects an invalid or taken name.
 */
function createEnsureAvailableAction(targets: TargetPaths): PlopTypes.CustomActionFunction {
	return function ensureAvailable(answers) {
		const validAnswers = isAnswers.assert(answers);
		const result = checkName(validAnswers, targets);
		if (result !== true) throw new Error(result);
		return `${validAnswers.name} is available`;
	};
}

function createAddAction(template: string, path: string): PlopTypes.AddActionConfig {
	return { path, templateFile: `templates/${template}.hbs`, type: "add" };
}

function createRunAction(command: string, commandArguments: ReadonlyArray<string>): PlopTypes.CustomActionFunction {
	return async function runAsync() {
		await exec(command, commandArguments, { nodeOptions: { stdio: "inherit" }, throwOnError: true });
		return `Ran ${[command, ...commandArguments].join(" ")}`;
	};
}

const installAction = createRunAction("pnpm", ["install"]);

function findLine(lines: ReadonlyArray<string>, predicate: (line: string) => boolean, from = 0): number {
	const index = lines.findIndex((line, lineIndex) => lineIndex >= from && predicate(line));
	if (index === -1) throw new Error("Found no line to anchor the insertion.");
	return index;
}

function editLines(path: string, edit: (lines: Array<string>) => void): void {
	const lines = readFileSync(path, "utf8").split("\n");
	edit(lines);
	writeFileSync(path, lines.join("\n"));
}

const registerRuleAction: PlopTypes.CustomActionFunction = function registerRuleAction(answers, _config, plop) {
	const { name, category } = isAnswers.assert(answers);
	if (category === undefined) throw new Error("A rule needs a category.");
	const identifier = plop.renderString("{{camelCase name}}", { name });

	editLines(PLUGIN_INDEX_PATH, (lines) => {
		const rulesStart = findLine(lines, (line) => line === "\trules: {");
		insertSorted(
			lines,
			[0, rulesStart],
			RULE_IMPORT_REGEXP,
			`import ${identifier} from "$oxc-rules/${category}/${name}";`,
		);

		const start = findLine(lines, (line) => line === "\trules: {");
		const end = findLine(lines, (line) => line === "\t},", start);
		insertSorted(lines, [start, end], RULE_ENTRY_REGEXP, `\t\t"${name}": ${identifier},`);
	});

	editLines(MANIFEST_PATH, (lines) => {
		const keyLine = findLine(lines, (line) => line === `\t\t\tkey: "${category}",`);
		const start = findLine(lines, (line) => line === "\t\t\trules: [", keyLine);
		const end = findLine(lines, (line) => line === "\t\t\t],", start);
		insertSorted(lines, [start, end], MANIFEST_ENTRY_REGEXP, `\t\t\t\t{ name: "${name}" },`);
	});

	return `Registered ${name} in ${PLUGIN_INDEX_PATH} and ${MANIFEST_PATH}`;
};

function setPackageGenerator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("package", {
		actions: [
			createEnsureAvailableAction(getPackageTargets),
			createAddAction("package/package.json", "{{location}}/{{name}}/package.json"),
			createAddAction("package/tsconfig.json", "{{location}}/{{name}}/tsconfig.json"),
			createAddAction("package/vitest.config.ts", "{{location}}/{{name}}/vitest.config.ts"),
			createAddAction("package/index.ts", "{{location}}/{{name}}/src/index.ts"),
			installAction,
			createRunAction("node", ["--run", "references:sync"]),
			() =>
				"Next: root coverage holds src/ to 100%, so `turbo run test` fails until the placeholder export is replaced with tested code.",
		],
		description: "A private @small-rules/* workspace package in packages/ or tools/.",
		prompts: [
			{
				name: "location",
				choices: [
					{ name: "packages/ (code the plugin ships)", value: "packages" },
					{ name: "tools/ (build and test tooling)", value: "tools" },
				],
				message: "Where does it live?",
				type: "list",
			},
			{
				name: "name",
				message: "Package name (without @small-rules/):",
				type: "input",
				validate: (input: string, answers?: PlopTypes.Answers) =>
					checkName({ ...answers, name: input }, getPackageTargets),
			},
			{
				name: "description",
				message: "One-line description:",
				type: "input",
				validate: validateNotEmpty,
			},
		],
	});
}

function setOpenCodePluginGenerator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("opencode-plugin", {
		actions: [
			createEnsureAvailableAction(getOpenCodePluginTargets),
			createAddAction("opencode-plugin/package.json", ".opencode/packages/plugins/{{name}}/package.json"),
			createAddAction("opencode-plugin/index.ts", ".opencode/packages/plugins/{{name}}/plugin/index.ts"),
			createAddAction("opencode-plugin/loader.ts", ".opencode/plugins/{{name}}.ts"),
			installAction,
		],
		description:
			"An OpenCode plugin: its package in .opencode/packages/plugins and its loader in .opencode/plugins.",
		prompts: [
			{
				name: "name",
				message: "Plugin id (kebab-case):",
				type: "input",
				validate: (input: string) => checkName({ name: input }, getOpenCodePluginTargets),
			},
		],
	});
}

function setRuleGenerator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("rule", {
		actions: [
			createEnsureAvailableAction(getRuleTargets),
			createAddAction("rule/rule.ts", "src/rules/{{category}}/{{name}}.ts"),
			createAddAction("rule/rule.test.ts", "src/rules/{{category}}/{{name}}.test.ts"),
			createAddAction("rule/rule.mdx", "documentation/src/content/docs/rules/{{category}}/{{name}}.mdx"),
			registerRuleAction,
		],
		description: "A lint rule: source, test, and docs page, registered in the plugin and the docs manifest.",
		prompts: [
			{
				name: "category",
				choices: [...readCategories()],
				message: "Category:",
				type: "list",
			},
			{
				name: "name",
				message: "Rule name (kebab-case):",
				type: "input",
				validate: (input: string, answers?: PlopTypes.Answers) =>
					checkName({ ...answers, name: input }, getRuleTargets),
			},
			{
				name: "description",
				message: "One-line description (meta.docs.description):",
				type: "input",
				validate: validateNotEmpty,
			},
			{
				name: "message",
				message: "Report message:",
				type: "input",
				validate: validateNotEmpty,
			},
			{
				name: "title",
				default: (answers: PlopTypes.Answers) => String(answers.name),
				message: "Docs page title:",
				type: "input",
			},
		],
	});
}

// oxlint-disable-next-line small-rules/starts-with-verb -- Turborepo names the export.
export default function config(plop: PlopTypes.NodePlopAPI): void {
	// `{{{json description}}}` writes a JSON string, quotes and all.
	plop.setHelper("json", (value: string) => JSON.stringify(value));

	setPackageGenerator(plop);
	setOpenCodePluginGenerator(plop);
	setRuleGenerator(plop);
}
