import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import nodePath from "node:path";

import { ruleManifest } from "./rule-manifest";

export interface RuleNewness {
	/**
	 * First release tag containing the add commit, e.g. "v2.14.0". Undefined
	 * when unreleased.
	 */
	readonly addedIn: string | undefined;
	/**
	 * True when the rule was added in the latest release or is not yet released.
	 */
	readonly isNew: boolean;
}

export type GitRunner = (arguments_: ReadonlyArray<string>) => string;

/**
 * Finds the repository root by walking up from the current working directory
 * until a `.git` directory is found. Robust against bundlers rewriting
 * `import.meta.url` (Astro/Vite SSR bundles) and against any invocation cwd.
 *
 * @returns Absolute path to the repository root.
 */
function resolveRepositoryRoot(): string {
	let directory = process.cwd();
	while (true) {
		if (existsSync(nodePath.join(directory, ".git"))) return directory;

		const parent = nodePath.dirname(directory);
		if (parent === directory) return directory;
		directory = parent;
	}
}

const repositoryRoot = resolveRepositoryRoot();
const RULE_DIRECTORY = "src/rules/";
const COMMIT_MARKER = "__COMMIT__";
/**
 * Returns the first non-empty line of a command's output, or undefined when
 * empty.
 *
 * @param output - Command output.
 * @returns First non-empty line, or undefined.
 */
function firstLine(output: string): string | undefined {
	const line = output.split("\n", 1)[0]?.trim();
	return line === "" ? undefined : line;
}

/**
 * Parses `git log --reverse --diff-filter=A --format=__COMMIT__%H --name-only
 * -- src/rules/` output into a map of rule name (filename minus `.ts`) to the
 * first commit that added it.
 *
 * @param logOutput - Raw git log output.
 * @returns Map of rule name to first add commit sha.
 */
export function parseAddCommits(logOutput: string): ReadonlyMap<string, string> {
	const addedInByRule = new Map<string, string>();
	let currentCommit: string | undefined;

	for (const line of logOutput.split("\n")) {
		if (line.startsWith(COMMIT_MARKER)) {
			currentCommit = line.slice(COMMIT_MARKER.length);
			continue;
		}
		const relativePath = line.slice(RULE_DIRECTORY.length);
		if (
			currentCommit === undefined ||
			!line.startsWith(RULE_DIRECTORY) ||
			!line.endsWith(".ts") ||
			relativePath.split("/").length > 2
		) {
			continue;
		}
		const ruleName = nodePath.basename(line, ".ts");
		if (!addedInByRule.has(ruleName)) addedInByRule.set(ruleName, currentCommit);
	}

	return addedInByRule;
}

/**
 * Classifies each rule as "new". A rule is new when it was added in the latest release or added after it (not yet
 * released). This single expression is the entire freshness policy.
 *
 * @param addedInByRule - Rule name to first containing release (undefined = unreleased).
 * @param latestTag - The most recent release tag.
 * @returns Map of rule name to newness classification.
 */
export function resolveNewness(
	addedInByRule: ReadonlyMap<string, string | undefined>,
	latestTag: string,
): ReadonlyMap<string, RuleNewness> {
	return new Map(
		Array.from(addedInByRule, ([ruleName, addedIn]) => [
			ruleName,
			{ addedIn, isNew: addedIn === undefined || addedIn === latestTag },
		]),
	);
}

/**
 * Derives rule newness from git history. Runs one `tag --contains` call per distinct add commit. Returns an empty map
 * when no release tags exist (e.g. Shallow clones)..
 *
 * @param run - Git command runner.
 * @returns Map of rule name to newness classification, filtered to manifest rules.
 */
export function createRuleNewness(run: GitRunner): ReadonlyMap<string, RuleNewness> {
	const latestTag = firstLine(run(["tag", "--list", "v*", "--sort=-version:refname"]));
	if (latestTag === undefined) return new Map();

	const addedInByRule = parseAddCommits(
		run([
			"log",
			"--reverse",
			"--diff-filter=A",
			`--format=${COMMIT_MARKER}%H`,
			"--name-only",
			"--",
			RULE_DIRECTORY,
		]),
	);

	const firstReleaseByCommit = new Map<string, string | undefined>();
	for (const commit of new Set(addedInByRule.values())) {
		firstReleaseByCommit.set(
			commit,
			firstLine(run(["tag", "--contains", commit, "--list", "v*", "--sort=version:refname"])),
		);
	}

	const addedInWithRelease = new Map<string, string | undefined>();
	for (const [ruleName, commit] of addedInByRule) {
		addedInWithRelease.set(ruleName, firstReleaseByCommit.get(commit));
	}

	const newness = new Map(resolveNewness(addedInWithRelease, latestTag));
	const manifestRules = new Set(
		ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name)),
	);
	for (const ruleName of newness.keys()) if (!manifestRules.has(ruleName)) newness.delete(ruleName);
	return newness;
}

function runGit(arguments_: ReadonlyArray<string>): string {
	// sonar(no-os-command-from-path): git is a fixed system binary, not a
	// user-writable PATH entry.
	return execFileSync("git", [...arguments_], {
		cwd: repositoryRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	});
}

let cachedNewness: ReadonlyMap<string, RuleNewness> | undefined;

/**
 * Memoized classification backed by an injected git runner. Test seam: the
 * singleton uses the real runner; tests inject fakes or throwing runners
 * without module mocking. Never throws: when git history is unavailable the
 * site builds with zero badges.
 *
 * @param run - Git command runner.
 * @returns Map of rule name to newness classification.
 */
export function getRuleNewnessWith(run: GitRunner): ReadonlyMap<string, RuleNewness> {
	if (cachedNewness === undefined) {
		try {
			cachedNewness = createRuleNewness(run);
		} catch {
			console.warn("[rule-newness] git history unavailable; New badges disabled");
			cachedNewness = new Map();
		}
	}
	return cachedNewness;
}

/**
 * Lazy memoized singleton backed by the repository's real git history.
 *
 * @returns Map of rule name to newness classification.
 */
export function getRuleNewness(): ReadonlyMap<string, RuleNewness> {
	return getRuleNewnessWith(runGit);
}
