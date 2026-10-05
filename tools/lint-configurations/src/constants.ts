export const baseIgnores = [
	"!**/.opencode",
	"!**/.opencode/**",
	"**/.opencode/goals",
	"**/*.js",
	".mise/**",
	"**/generated/**",
] satisfies ReadonlyArray<string>;

export const projectType: "app" | "game" | "package" = "package";
