import nodePath from "node:path";
import { describe } from "vitest";
import rule from "$oxc-rules/react/prefer-context-stack";

import { tsx } from "./rule-testers";

const FIXTURES = nodePath.join(import.meta.dirname, "fixtures", "prefer-context-stack");
const WITH_CONTEXT_STACK = nodePath.join(FIXTURES, "with-context-stack");
const WITHOUT_CONTEXT_STACK = nodePath.join(FIXTURES, "without-context-stack");
const FIXTURE_ONLY_CONTEXT_STACK = nodePath.join(FIXTURES, "fixture-only");

describe("prefer-context-stack", () => {
	tsx.run("prefer-context-stack", rule, {
		invalid: [
			{
				filename: "tests/fixtures/prefer-context-stack/with-context-stack/src/screens/basic.tsx",
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></ContextStack>;
}`,
				errors: [{ messageId: "preferContextStack" }],
				documentation: { id: "fail", title: "Nested context providers" },
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "report-only.tsx"),
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "alias-report-only.tsx"),
				code: `import Stack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				output: `import Stack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <Stack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}><App /></Stack>;
}`,
				errors: [{ messageId: "preferContextStack" }],
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "comment.tsx"),
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>{/* keep */}<LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "multiple-identifiers.tsx"),
				code: `import ContextStack from "../providers/context-stack";
import { ContextStack as LocalContextStack } from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				errors: [{ messageId: "preferContextStack" }],
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "empty-inner.tsx"),
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}></LocaleContext.Provider></ThemeContext.Provider>;
}`,
				output: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ContextStack providers={[<ThemeContext.Provider value={theme} />, <LocaleContext.Provider value={locale} />]}></ContextStack>;
}`,
				errors: [{ messageId: "preferContextStack" }],
			},
		],
		valid: [
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "providers", "context-stack.tsx"),
				code: `export default function ContextStack({ children, locale, theme }: { children: React.ReactNode; locale: string; theme: string }) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider></ThemeContext.Provider>;
}`,
			},
			{
				filename: "tests/fixtures/prefer-context-stack/with-context-stack/src/screens/single.tsx",
				code: `import ContextStack from "../providers/context-stack";

export function Example(theme: string) {
    return <ThemeContext.Provider value={theme}><App /></ThemeContext.Provider>;
}`,
				documentation: { id: "pass", title: "Single context provider" },
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "not-direct.tsx"),
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><Toolbar /><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
			},
			{
				filename: nodePath.join(WITHOUT_CONTEXT_STACK, "src", "screens", "missing.tsx"),
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
			},
			{
				filename: nodePath.join(FIXTURE_ONLY_CONTEXT_STACK, "src", "screens", "fixture.tsx"),
				code: `export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}><LocaleContext.Provider value={locale}><App /></LocaleContext.Provider></ThemeContext.Provider>;
}`,
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "fragment-wrapper.tsx"),
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>
        <>
            <LocaleContext.Provider value={locale}><App /></LocaleContext.Provider>
        </>
    </ThemeContext.Provider>;
}`,
			},
			{
				filename: nodePath.join(WITH_CONTEXT_STACK, "src", "screens", "conditional-child.tsx"),
				code: `import ContextStack from "../providers/context-stack";

export function Example(locale: string, theme: string) {
    return <ThemeContext.Provider value={theme}>{maybeLocale && <LocaleContext.Provider value={locale}><App /></LocaleContext.Provider>}</ThemeContext.Provider>;
}`,
			},
		],
	});
});
