import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";

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
	/**
	 * True when the rule is not new but was last modified in the latest
	 * release or has unreleased modifications.
	 */
	readonly isUpdated: boolean;
	/**
	 * First release tag containing the last modification commit, e.g.
	 * "v3.0.2". Undefined when the latest modification is unreleased. Equals
	 * `addedIn` when the rule was never modified after it was added.
	 */
	readonly updatedIn: string | undefined;
}

export type GitRunner = (parameters: ReadonlyArray<string>) => string;

/**
 * Finds the repository root by walking up from the current working directory
 * until a `.git` directory is found. Robust against bundlers rewriting
 * `import.meta.url` (Astro/Vite SSR bundles) and against any invocation cwd.
 *
 * @returns Absolute path to the repository root.
 */
function resolveRepositoryRoot(): string {
	let directory = cwd();
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
 * Maps rule names to the first commit seen for them in a `git log
 * --format=__COMMIT__%H --name-only -- src/rules/` stream. Feed it a
 * reverse-chronological log (oldest first) to get first-add commits, or a
 * newest-first log to get last-modification commits.
 *
 * @param logOutput - Raw git log output.
 * @returns Map of rule name to first seen commit sha.
 */
function parseTouchedRules(logOutput: string): Map<string, string> {
	const touchedByRule = new Map<string, string>();
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
		if (!touchedByRule.has(ruleName)) {
			touchedByRule.set(ruleName, currentCommit);
		}
	}

	return touchedByRule;
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
	return parseTouchedRules(logOutput);
}

/**
 * Parses `git log --format=__COMMIT__%H --name-only -- src/rules/` output
 * (newest first) into a map of rule name to the most recent commit touching
 * it.
 *
 * @param logOutput - Raw git log output, newest first.
 * @returns Map of rule name to last modification commit sha.
 */
export function parseLastModuleCommits(logOutput: string): ReadonlyMap<string, string> {
	return parseTouchedRules(logOutput);
}

/**
 * Classifies each rule as "new" or "recently updated". A rule is new when it
 * was added in the latest release or added after it (not yet released). A
 * rule is updated when it is not new but was last modified in the latest
 * release or modified after it (not yet released). New takes precedence over
 * updated.
 *
 * @param addedInByRule - Rule name to first containing release (undefined = unreleased).
 * @param updatedInByRule - Rule name to last-mod containing release (undefined = unreleased).
 * @param latestTag - The most recent release tag.
 * @returns Map of rule name to newness classification.
 */
export function resolveNewness(
	addedInByRule: ReadonlyMap<string, string | undefined>,
	updatedInByRule: ReadonlyMap<string, string | undefined>,
	latestTag: string,
): ReadonlyMap<string, RuleNewness> {
	return new Map(
		Array.from(addedInByRule, ([ruleName, addedIn]) => {
			const updatedIn = updatedInByRule.has(ruleName) ? updatedInByRule.get(ruleName) : addedIn;
			const isNew = addedIn === undefined || addedIn === latestTag;
			return [
				ruleName,
				{
					addedIn,
					isNew,
					isUpdated: !isNew && (updatedIn === undefined || updatedIn === latestTag),
					updatedIn,
				},
			];
		}),
	);
}

/**
 * Derives rule newness from git history. Runs one `tag --contains` call per
 * distinct add or last-mod commit. Returns an empty map when no release tags
 * exist (e.g. Shallow clones).
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

	const lastModuleByRule = parseLastModuleCommits(
		run(["log", `--format=${COMMIT_MARKER}%H`, "--name-only", "--", RULE_DIRECTORY]),
	);

	const firstReleaseByCommit = new Map<string, string | undefined>();
	const commitSet = new Set([...addedInByRule.values(), ...lastModuleByRule.values()]);
	for (const commit of commitSet) {
		firstReleaseByCommit.set(
			commit,
			firstLine(run(["tag", "--contains", commit, "--list", "v*", "--sort=version:refname"])),
		);
	}

	const addedInWithRelease = new Map<string, string | undefined>();
	for (const [ruleName, commit] of addedInByRule) {
		addedInWithRelease.set(ruleName, firstReleaseByCommit.get(commit));
	}

	const updatedInWithRelease = new Map<string, string | undefined>();
	for (const [ruleName, commit] of lastModuleByRule) {
		updatedInWithRelease.set(ruleName, firstReleaseByCommit.get(commit));
	}

	const newness = new Map(resolveNewness(addedInWithRelease, updatedInWithRelease, latestTag));
	const manifestRules = new Set(
		ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name)),
	);

	for (const ruleName of newness.keys()) {
		if (!manifestRules.has(ruleName)) newness.delete(ruleName);
	}

	return newness;
}

function runGit(parameters: ReadonlyArray<string>): string {
	// sonar(no-os-command-from-path): git is a fixed system binary, not a
	// user-writable PATH entry.
	return execFileSync("git", [...parameters], {
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
			console.warn("[rule-newness] git history unavailable; New and Updated badges disabled");
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
