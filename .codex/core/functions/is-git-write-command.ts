const COMMAND_SEPARATOR = /[;|&()]/u;
const WHITESPACE = /\s+/u;

const GIT_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set([
	"--attr-source",
	"--config-env",
	"--exec-path",
	"--git-dir",
	"--list-cmds",
	"--namespace",
	"--super-prefix",
	"--work-tree",
	"-c",
	"-C",
]);

function hasGitWriteSubcommand(words: ReadonlyArray<string>, gitIndex: number): boolean {
	for (let index = gitIndex + 1; index < words.length; index += 1) {
		const word = words[index] ?? "";
		if (word === "commit" || word === "push") return true;
		if (!word.startsWith("-")) return false;
		if (GIT_OPTIONS_WITH_VALUE.has(word)) index += 1;
	}

	return false;
}

export function isGitWriteCommand(command: string): boolean {
	return command.split(COMMAND_SEPARATOR).some((segment) => {
		const words = segment.trim().split(WHITESPACE);
		return words.some((word, index) => word === "git" && hasGitWriteSubcommand(words, index));
	});
}
