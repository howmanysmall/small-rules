import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, it } from "vitest";
import { isMaybeString, isString, isUndefined } from "@small-rules/arktype-utilities";
import { type } from "arktype";
import { parseYAML } from "confbox";

const isSteps = type({ "name?": isMaybeString, "run?": isMaybeString }).array();

const isChecksJob = type({
	"steps?": isSteps.or(isUndefined),
});

const isChecks = type({
	"jobs?": type({ "[string]": isChecksJob }).or(isUndefined),
});

const checks = isChecks.assert(parseYAML(readFileSync(".github/workflows/checks.yaml", "utf8")));

function git(repository: string, ...arguments_: ReadonlyArray<string>): string {
	return execFileSync("git", arguments_, { cwd: repository, encoding: "utf8" }).trim();
}

function collectChangedFiles(command: string): Buffer {
	const repository = mkdtempSync(nodePath.join(tmpdir(), "small-rules-changed-files-"));
	try {
		git(repository, "init", "--initial-branch=main");
		git(repository, "config", "user.name", "CI Test");
		git(repository, "config", "user.email", "ci@example.com");
		git(repository, "config", "commit.gpgsign", "false");
		writeFileSync(nodePath.join(repository, "example.txt"), "base\n");
		git(repository, "add", "example.txt");
		git(repository, "commit", "-m", "base");

		git(repository, "checkout", "-b", "feature");
		writeFileSync(nodePath.join(repository, "docs.txt"), "pull request\n");
		git(repository, "add", "docs.txt");
		git(repository, "commit", "-m", "pull request");
		const head = git(repository, "rev-parse", "HEAD");

		git(repository, "checkout", "main");
		git(repository, "mv", "example.txt", "renamed.txt");
		git(repository, "commit", "-m", "advance base");
		const base = git(repository, "rev-parse", "HEAD");

		execFileSync("bash", ["--noprofile", "--norc", "-e", "-c", command], {
			cwd: repository,
			env: { BASE_SHA: base, HEAD_SHA: head, PATH: "/usr/bin:/bin", RUNNER_TEMP: repository },
		});

		return readFileSync(nodePath.join(repository, "changed-files"));
	} finally {
		rmSync(repository, { force: true, recursive: true });
	}
}

describe("changed file collection", () => {
	// Bug: an advancing base makes validation lint files absent from the merge.
	// Oracle: a PR that only changes docs.txt must select exactly docs.txt.
	it("selects only pull request changes after the base branch advances", ({ expect }) => {
		expect.assertions(1);

		const command = isString.assert(
			checks.jobs?.check?.steps?.find((step) => step.name === "Collect changed files")?.run,
		);

		expect(collectChangedFiles(command)).toStrictEqual(Buffer.from("docs.txt\0"));
	});
});
