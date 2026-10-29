import { describe } from "vitest";
import { ts, tsx } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/naming/no-inline-parameter-types";

const inlineParameterType = { messageId: "inlineParameterType" } as const;
const componentsOnly = { functions: "components" } as const;

describe("no-inline-parameter-types", () => {
	tsx.run("no-inline-parameter-types", rule, {
		invalid: [
			{
				code: [
					"export function Badge({ label }: Readonly<{ label: string }>): ReactNode {",
					"\treturn <span>{label}</span>;",
					"}",
				].join("\n"),
				errors: [{ data: { parameter: "{ label }" }, messageId: "inlineParameterType" }],
				documentation: { id: "fail", title: "Inline props type" },
			},
			{
				code: "const Badge = ({ label }: { label: string }) => <span>{label}</span>;",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
			{
				code: "const Badge = function ({ label }: { label: string }) { return <span>{label}</span>; };",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
			{
				code: "const Badge = memo(({ label }: { label: string }) => <span>{label}</span>);",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
			{
				code: "const Badge = React.memo(function Badge(properties: { label: string }) { return null; });",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
			{
				code: "const Field = forwardRef((properties: { label: string }, reference: Ref<Element>) => null);",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
			{
				code: "function Badge(properties: Readonly<{ label: string }>) { return null; }",
				options: [componentsOnly],
				errors: [inlineParameterType],
			},
		],
		valid: [
			{
				code: [
					"interface BadgeProperties {",
					"\treadonly label: string;",
					"}",
					"",
					"export function Badge({ label }: Readonly<BadgeProperties>): ReactNode {",
					"\treturn <span>{label}</span>;",
					"}",
				].join("\n"),
				documentation: { id: "pass", title: "Named props interface" },
			},
			{
				code: "function formatLabel(options: { label: string }) { return options.label; }",
				options: [componentsOnly],
			},
			{ code: "const formatLabel = (options: { label: string }) => options.label;", options: [componentsOnly] },
			{ code: "items.map((item: { label: string }) => item.label);", options: [componentsOnly] },
			{ code: "const Badge = wrap((properties: { label: string }) => null);", options: [componentsOnly] },
			{ code: "const BADGE = 1;", options: [componentsOnly] },
			{
				code: "export default function (properties: { label: string }) { return null; }",
				options: [componentsOnly],
			},
			{ code: "type Render = (properties: { label: string }) => void;", options: [componentsOnly] },
			{ code: "function Badge(properties: BadgeProperties) { return null; }", options: [componentsOnly] },
		],
	});

	ts.run("no-inline-parameter-types", rule, {
		invalid: [
			{
				code: "function formatLabel(options: { label: string }): string { return options.label; }",
				errors: [{ data: { parameter: "options" }, messageId: "inlineParameterType" }],
			},
			{
				code: "const formatLabel = (options: { label: string }) => options.label;",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: { label: string } = { label: '' }) { return options.label; }",
				errors: [{ data: { parameter: "options" }, messageId: "inlineParameterType" }],
			},
			{
				code: "function formatLabels(...entries: Array<{ label: string }>) {}",
				errors: [{ data: { parameter: "entries" }, messageId: "inlineParameterType" }],
			},
			{
				code: "class Formatter { constructor(private readonly options: { label: string }) {} }",
				errors: [inlineParameterType],
			},
			{
				code: "class Formatter { format(options: { label: string }): void {} }",
				errors: [inlineParameterType],
			},
			{
				code: "interface Formatter { format(options: { label: string }): void; }",
				errors: [inlineParameterType],
			},
			{
				code: "interface Formatter { (options: { label: string }): void; }",
				errors: [inlineParameterType],
			},
			{
				code: "interface Formatter { new (options: { label: string }): Formatter; }",
				errors: [inlineParameterType],
			},
			{
				code: "type Format = (options: { label: string }) => string;",
				errors: [inlineParameterType],
			},
			{
				code: "type Create = new (options: { label: string }) => Formatter;",
				errors: [inlineParameterType],
			},
			{
				code: "declare function formatLabel(options: { label: string }): string;",
				errors: [inlineParameterType],
			},
			{
				code: "abstract class Formatter { abstract format(options: { label: string }): void; }",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(first: { label: string }, second: { label: string }) {}",
				errors: [inlineParameterType, inlineParameterType],
			},
			{
				code: "function formatLabel(options: ({ label: string })) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: Readonly<Partial<{ label: string }>>) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: Base & { label: string }) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: string | { label: string }) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabels(entries: { label: string }[]) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabels(entries: readonly { label: string }[]) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatPair(pair: [{ label: string }, label?: { label: string }, ...rest: { label: string }[]]) {}",
				errors: [inlineParameterType, inlineParameterType, inlineParameterType],
			},
			{
				code: "function formatPair(pair: [{ label: string }?, ...{ label: string }[]]) {}",
				errors: [inlineParameterType, inlineParameterType],
			},
			{
				code: "function formatLabel(options: { nested: { label: string } }) {}",
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: Readonly<{ label: string }>) {}",
				options: [{ position: "wrapped" }],
				errors: [inlineParameterType],
			},
			{
				code: "function formatLabel(options: ({ label: string })) {}",
				options: [{ position: "bare" }],
				errors: [inlineParameterType],
			},
		],
		valid: [
			"function formatLabel(options: LabelOptions) {}",
			"function formatLabel(options) {}",
			"function formatLabel({ label }) {}",
			"function formatLabel(options: Readonly<LabelOptions>) {}",
			"function formatLabel(options: { [Key in Name]: string }) {}",
			"function formatLabel(options: typeof defaults) {}",
			"function formatLabel(options: LabelOptions['label']) {}",
			"function formatLabel(callback: (options: LabelOptions) => void) {}",
			"function formatLabel(callback: () => { label: string }) {}",
			"function formatLabel(create: new () => { label: string }) {}",
			"function formatLabel(...entries: Array<LabelOptions>) {}",
			"function formatLabel(options: Map<string, number>) {}",
			"function formatLabel(options: Readonly) {}",
			{ code: "function formatLabel(options: Base & { label: string }) {}", options: [{ position: "wrapped" }] },
			{
				code: "function formatLabel(options: string | { label: string }) {}",
				options: [{ position: "wrapped" }],
			},
			{ code: "function formatLabels(entries: { label: string }[]) {}", options: [{ position: "wrapped" }] },
			{ code: "function formatLabel(options: Readonly<{ label: string }>) {}", options: [{ position: "bare" }] },
		],
	});
});
