declare const rule: unknown;
declare const ts: { readonly run: (...arguments_: ReadonlyArray<unknown>) => void };

export const fixture = undefined;

ts.run("invalid-marker", rule, {
	invalid: [
		{
			code: "const invalid = true;",
			documentation: { id: 1, title: "Invalid marker" },
			errors: [{ messageId: "marker" }],
		},
	],
	valid: [],
});
