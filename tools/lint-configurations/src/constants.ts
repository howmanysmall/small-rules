export const baseIgnores = [
	"!**/.opencode",
	"!**/.opencode/**",
	".opencode/goals",
	".mise/**",
	"**/*.js",
	"**/routeTree.gen.ts",
	"**/worker-configuration.d.ts",
	"apps/website/src/components/ui/**/*.tsx",
	"**/.wrangler",
	"{apps/website/drizzle/meta/**,lighthouse-reports}/*.json",
	"apps/website/vendor",
] satisfies ReadonlyArray<string>;

export const projectType: "app" | "game" | "package" = "package";
