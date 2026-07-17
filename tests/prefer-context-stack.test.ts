import { join } from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/prefer-context-stack";

import { tsx } from "./rule-testers";

const FIXTURES = join(import.meta.dirname, "fixtures", "prefer-context-stack");
const WITH_CONTEXT_STACK = join(FIXTURES, "with-context-stack");
const WITHOUT_CONTEXT_STACK = join(FIXTURES, "without-context-stack");
const FIXTURE_ONLY_CONTEXT_STACK = join(FIXTURES, "fixture-only");

describe("prefer-context-stack", () => {
	tsx.run("prefer-context-stack", rule, {
		invalid: [
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				documentation: { id: "fail", title: "Nested context providers" },
				errors: [{ messageId: "preferContextStack" }],
				filename: "tests/fixtures/prefer-context-stack/with-context-stack/src/screens/basic.tsx",
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></ContextStack>;
}`,
			},
			{
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "report-only.tsx"),
			},
			{
				code: `import Stack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "alias-report-only.tsx"),
				output: `import Stack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <Stack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></Stack>;
}`,
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>{/* keep */}<LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "comment.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";
import { ContextStack as LocalContextStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "multiple-identifiers.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "empty-inner.tsx"),
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}></ContextStack>;
}`,
			},
		],
		valid: [
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(theme: string) {
    return <ThemeContext.Provider value={theme}><App /></ThemeContext.Provider>;
}`,
				documentation: { id: "pass", title: "Single context provider" },
				filename: "tests/fixtures/prefer-context-stack/with-context-stack/src/screens/single.tsx",
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><Toolbar /><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "not-direct.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(WITHOUT_CONTEXT_STACK, "src", "screens", "missing.tsx"),
			},
			{
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				filename: join(FIXTURE_ONLY_CONTEXT_STACK, "src", "screens", "fixture.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>
        <>
            <LocaleContext.Provider value={locale}><App /></LocaleContext.Provider>
        </>
    </ThemeContext.Provider>;
}`,
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "fragment-wrapper.tsx"),
			},
			{
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>{maybeLocale && <LocaleContext.Provider value={locale}><App /></LocaleContext.Provider>}</ThemeContext.Provider>;
}`,
				filename: join(WITH_CONTEXT_STACK, "src", "screens", "conditional-child.tsx"),
			},
		],
	});
});
