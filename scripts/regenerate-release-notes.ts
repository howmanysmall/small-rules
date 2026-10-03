#!/usr/bin/env bun

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { cwd, exit } from "node:process";
import { cancel, confirm, intro, isCancel, log, multiselect, note, outro, spinner } from "@clack/prompts";
import { Octokit } from "@octokit/rest";
import {
	countChangedLines,
	getReleaseTitle,
	listReleaseTagsAsync,
	readCommuniqueDefaults,
} from "@small-rules/release-notes";
import { bold, cyan, dim, green, red, yellow } from "ansis";
import { exec } from "tinyexec";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

import type { CANCEL_SYMBOL, Option } from "@clack/prompts";
import type { CommuniqueDefaults } from "@small-rules/release-notes";

const RELEASES_DIRECTORY = "documentation/src/content/releases";

type Target = "documentation" | "github";
type Outcome = "changed" | "failed" | "unchanged";

interface Context {
	readonly defaults: CommuniqueDefaults;
	readonly dryRun: boolean;
	readonly environment: Readonly<Record<string, string>>;
	readonly model: string;
	readonly octokit: Octokit | undefined;
	readonly rootDirectory: string;
	readonly targets: ReadonlySet<Target>;
	readonly temporaryDirectory: string;
}

interface Credentials {
	readonly apiKey: string;
	readonly githubToken: string;
}

interface Plan {
	readonly dryRun: boolean;
	readonly model: string;
	readonly modelOverridden: boolean;
	readonly tags: ReadonlyArray<string>;
	readonly targets: ReadonlySet<Target>;
}

const TARGET_LABELS: Readonly<Record<Target, string>> = {
	documentation: RELEASES_DIRECTORY,
	github: "GitHub releases",
};

const name = getScriptName(true);

function exitIfCancelled<TValue>(value: TValue | typeof CANCEL_SYMBOL): TValue {
	if (isCancel(value)) {
		cancel("Nothing was changed.");
		exit(0);
	}

	return value;
}

function fail(message: string): never {
	cancel(message);
	exit(1);
}

function isPresent(value?: string): value is string {
	return value !== undefined && value !== "";
}

async function succeedsAsync(command: string, parameters: ReadonlyArray<string>): Promise<boolean> {
	const result = await exec(command, [...parameters], { throwOnError: false });
	return result.exitCode === 0;
}

async function resolveGitHubTokenAsync(token?: string): Promise<string | undefined> {
	if (isPresent(token)) return token;

	const result = await exec("gh", ["auth", "token"], { throwOnError: false });
	const output = result.stdout.trim();
	return output !== "" && result.exitCode === 0 ? output : undefined;
}

async function resolveCredentialsAsync(apiKey?: string, githubToken?: string): Promise<Credentials> {
	if (!(await succeedsAsync("communique", ["--version"]))) {
		fail("communique is not on PATH. Run `mise install` first.");
	}
	if (!isPresent(apiKey)) fail("Set COMMUNIQUE_OPENROUTER_API_KEY (or OPENAI_API_KEY).");

	const resolvedGitHubToken = await resolveGitHubTokenAsync(githubToken);
	if (resolvedGitHubToken === undefined) fail("Set GITHUB_TOKEN or log in with `gh auth login`.");

	return { apiKey, githubToken: resolvedGitHubToken };
}

function createTagOptions(available: ReadonlyArray<string>): Array<Option<string>> {
	const options = available.map((tag): Option<string> => ({ label: tag, value: tag }));
	const [latest] = options;
	if (latest !== undefined) latest.hint = "latest";
	return options;
}

async function selectTagsAsync(
	available: ReadonlyArray<string>,
	requested: ReadonlyArray<string> | undefined,
	yes: boolean,
): Promise<ReadonlyArray<string>> {
	if (requested !== undefined) {
		const unknown = requested.filter((tag) => !available.includes(tag));
		if (unknown.length > 0) fail(`No committed release notes for ${unknown.join(", ")}.`);
		return available.filter((tag) => requested.includes(tag));
	}

	if (yes) return available;

	return exitIfCancelled(
		await multiselect({
			initialValues: [...available],
			maxItems: 12,
			message: "Which releases should be regenerated?",
			options: createTagOptions(available),
			required: true,
		}),
	);
}

async function selectTargetsAsync(documentation: boolean, github: boolean, yes: boolean): Promise<ReadonlySet<Target>> {
	const initialValues = new Array<Target>();
	if (documentation) initialValues.push("documentation");
	if (github) initialValues.push("github");
	if (yes || initialValues.length < 2) return new Set(initialValues);

	const selected = exitIfCancelled(
		await multiselect<Target>({
			initialValues,
			message: "Where should the regenerated notes go?",
			options: [
				{ hint: RELEASES_DIRECTORY, label: "Documentation site", value: "documentation" },
				{ hint: "edits the existing release body", label: "GitHub releases", value: "github" },
			],
			required: true,
		}),
	);
	return new Set(selected);
}

async function findMissingTagsAsync(tags: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
	const results = await Promise.all(
		tags.map(async (tag) => succeedsAsync("git", ["rev-parse", "--quiet", "--verify", `refs/tags/${tag}`])),
	);
	return tags.filter((_, index) => results[index] !== true);
}

async function ensureTagsFetchedAsync(tags: ReadonlyArray<string>, yes: boolean): Promise<void> {
	const missing = await findMissingTagsAsync(tags);
	if (missing.length === 0) return;

	log.warn(`${missing.length} tag(s) are missing locally: ${dim(missing.join(", "))}`);
	const shouldFetch = yes || exitIfCancelled(await confirm({ message: "Run `git fetch --tags` now?" }));
	if (!shouldFetch) fail("communique needs every selected tag locally.");

	const fetching = spinner();
	fetching.start("Fetching tags");
	if (!(await succeedsAsync("git", ["fetch", "--tags", "--force", "origin"]))) {
		fetching.error("git fetch --tags failed");
		exit(1);
	}

	fetching.stop("Fetched tags");
}

function formatChanges(before: string | undefined, after: string): string {
	if (before === undefined) return green("new");
	const { added, removed } = countChangedLines(before, after);
	const addedText = `+${added}`;
	const removedText = `-${removed}`;
	return `${green(addedText)} ${red(removedText)}`;
}

async function readOptionalFileAsync(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, "utf8");
	} catch {
		return undefined;
	}
}

interface SaveResult {
	readonly changed: boolean;
	readonly previous: string | undefined;
}

async function saveDocumentationAsync(context: Context, tag: string, notes: string): Promise<SaveResult> {
	const documentPath = nodePath.join(context.rootDirectory, RELEASES_DIRECTORY, `${tag}.md`);
	const previous = await readOptionalFileAsync(documentPath);
	if (previous === notes) return { changed: false, previous };

	if (!context.dryRun) await writeFile(documentPath, notes);
	return { changed: true, previous };
}

async function saveGitHubReleaseAsync(
	octokit: Octokit,
	context: Context,
	tag: string,
	notes: string,
): Promise<SaveResult> {
	const { owner, repository } = context.defaults;
	const { data } = await octokit.rest.repos.getReleaseByTag({ owner, repo: repository, tag });
	const previous = data.body ?? undefined;
	if (previous === notes) return { changed: false, previous };

	if (!context.dryRun) {
		await octokit.rest.repos.updateRelease({ body: notes, owner, release_id: data.id, repo: repository });
	}

	return { changed: true, previous };
}

/**
 * Compares the notes against each selected target separately, so a target
 * that is already current never hides one that is stale.
 *
 * @param context - The run configuration.
 * @param tag - The release being saved.
 * @param notes - The regenerated release notes.
 * @returns The first changed target's result, or an unchanged result.
 */
async function saveAsync(context: Context, tag: string, notes: string): Promise<SaveResult> {
	const results = new Array<SaveResult>();
	if (context.targets.has("documentation")) results.push(await saveDocumentationAsync(context, tag, notes));
	if (context.octokit !== undefined) results.push(await saveGitHubReleaseAsync(context.octokit, context, tag, notes));

	return results.find(({ changed }) => changed) ?? { changed: false, previous: undefined };
}

async function regenerateAsync(context: Context, tag: string, label: string): Promise<Outcome> {
	const prefix = `${label} ${bold(tag)}`;
	const progress = spinner({ indicator: "timer" });
	progress.start(`${prefix} ${dim("asking communique…")}`);

	const outputPath = nodePath.join(context.temporaryDirectory, `${tag}.md`);
	const result = await exec(
		"communique",
		["generate", tag, "--model", context.model, "--output", outputPath, "--quiet"],
		{
			nodeOptions: { cwd: context.rootDirectory, env: context.environment },
			throwOnError: false,
		},
	);
	if (result.exitCode !== 0) {
		progress.error(`${prefix} ${red("communique failed")}`);
		const details = (result.stderr || result.stdout).trim();
		if (details !== "") log.message(dim(details));
		return "failed";
	}

	const notes = await readFile(outputPath, "utf8");
	let saved: SaveResult;
	try {
		saved = await saveAsync(context, tag, notes);
	} catch (error) {
		progress.error(`${prefix} ${red("failed to save")}`);
		log.message(dim(String(error)));
		return "failed";
	}

	if (!saved.changed) {
		progress.stop(`${prefix} ${dim("unchanged")}`);
		return "unchanged";
	}

	progress.stop(`${prefix} ${formatChanges(saved.previous, notes)} ${dim(getReleaseTitle(notes) ?? tag)}`);
	return "changed";
}

function showPlan({ dryRun, model, modelOverridden, tags, targets }: Plan): void {
	const newest = tags.at(0) ?? "";
	const range = tags.length > 1 ? `${tags.at(-1) ?? ""} → ${newest}` : newest;
	const overrideNote = modelOverridden ? dim(" (override)") : "";
	const lines = [
		`${dim("model")}     ${cyan(model)}${overrideNote}`,
		`${dim("releases")}  ${bold(String(tags.length))} ${dim(range)}`,
		`${dim("targets")}   ${Array.from(targets, (target) => TARGET_LABELS[target]).join(", ")}`,
	];
	if (dryRun) lines.push(yellow("dry run: nothing will be written"));
	note(lines.join("\n"), "Regeneration plan");
}

async function regenerateAllAsync(context: Context, tags: ReadonlyArray<string>): Promise<Record<Outcome, number>> {
	const counts: Record<Outcome, number> = { changed: 0, failed: 0, unchanged: 0 };
	const width = String(tags.length).length;
	for (const [index, tag] of tags.entries()) {
		const label = dim(`[${String(index + 1).padStart(width)}/${tags.length}]`);
		// oxlint-disable-next-line no-await-in-loop -- one release at a time keeps the spinner readable and the spend bounded
		counts[await regenerateAsync(context, tag, label)] += 1;
	}

	return counts;
}

function showSummary(counts: Record<Outcome, number>, dryRun: boolean, targets: ReadonlySet<Target>): void {
	const changedLabel = dryRun ? "would change" : "updated";
	const parts = [green(`${counts.changed} ${changedLabel}`), dim(`${counts.unchanged} unchanged`)];
	if (counts.failed > 0) parts.push(red(`${counts.failed} failed`));

	const shouldReview = !dryRun && counts.changed > 0 && targets.has("documentation");
	const reviewHint = shouldReview ? dim(`\nReview with \`git diff ${RELEASES_DIRECTORY}\`.`) : "";
	outro(`${parts.join(dim(" · "))}${reviewHint}`);
}

const command = createBaseCommand(
	name,
	"1.0.0",
	"Regenerates committed release notes with the model configured in `communique.toml`.",
)
	.env("COMMUNIQUE_OPENROUTER_API_KEY=<value:string>", "OpenRouter API key passed to communique.", {
		required: false,
	})
	.env("OPENAI_API_KEY=<value:string>", "Fallback API key passed to communique.", { required: false })
	.env("GITHUB_TOKEN=<value:string>", "GitHub token; falls back to `gh auth token`.", { required: false })
	.env("GH_TOKEN=<value:string>", "Alternative GitHub token environment variable.", { required: false })
	.option("-t, --tags <tags:string[]>", "Regenerate only these tags, skipping the release picker.")
	.option("-m, --model <model:string>", "Override the `communique.toml` model for this run.")
	.option("--no-documentation", "Do not rewrite the documentation site's release notes.")
	.option("--no-github", "Do not edit the GitHub release bodies.")
	.option("-n, --dry-run", "Generate notes and report changes without writing anything.", { default: false })
	.option("-y, --yes", "Accept every default and skip the confirmation prompt.", { default: false })
	.example("Pick releases interactively", "nr release-notes:regenerate")
	.example("Preview two releases", "nr release-notes:regenerate --tags v3.1.0,v3.0.2 --dry-run")
	.example("Everything, no prompts", "nr release-notes:regenerate --yes")
	.action(async (options): Promise<void> => {
		const { documentation, dryRun, github, model: modelOverride, tags: requestedTags, yes } = options;
		const rootDirectory = cwd();
		intro(bold(cyan(` ${name} `)));

		const defaults = readCommuniqueDefaults(
			await readFile(nodePath.join(rootDirectory, "communique.toml"), "utf8"),
		);
		const model = modelOverride ?? defaults.model;
		const credentials = await resolveCredentialsAsync(
			options.communiqueOpenrouterApiKey ?? options.openaiApiKey,
			options.githubToken ?? options.ghToken,
		);

		const available = await listReleaseTagsAsync(nodePath.join(rootDirectory, RELEASES_DIRECTORY));
		if (available.length === 0) fail(`No release notes found in ${RELEASES_DIRECTORY}.`);

		const tags = await selectTagsAsync(available, requestedTags, yes);
		const targets = await selectTargetsAsync(documentation, github, yes);
		if (targets.size === 0) {
			fail("Both --no-documentation and --no-github were passed, so there is nowhere to write.");
		}

		await ensureTagsFetchedAsync(tags, yes);
		showPlan({ dryRun, model, modelOverridden: modelOverride !== undefined, tags, targets });

		const shouldContinue =
			yes || exitIfCancelled(await confirm({ message: `Regenerate ${tags.length} release note(s)?` }));
		if (!shouldContinue) {
			cancel("Nothing was changed.");
			return;
		}

		const temporaryDirectory = await mkdtemp(nodePath.join(tmpdir(), `${name}-`));
		const context: Context = {
			defaults,
			dryRun,
			environment: { GITHUB_TOKEN: credentials.githubToken, OPENAI_API_KEY: credentials.apiKey },
			model,
			octokit: targets.has("github") ? new Octokit({ auth: credentials.githubToken }) : undefined,
			rootDirectory,
			targets,
			temporaryDirectory,
		};

		let counts: Record<Outcome, number>;
		try {
			counts = await regenerateAllAsync(context, tags);
			showSummary(counts, dryRun, targets);
		} finally {
			await rm(temporaryDirectory, { force: true, recursive: true });
		}

		if (counts.failed > 0) exit(1);
	});

await command.parse();
