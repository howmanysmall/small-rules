import { describe } from "vitest";
import { tsx } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/react/no-nested-hook-calls";

describe("no-nested-hook-calls", () => {
	tsx.run("no-nested-hook-calls", rule, {
		invalid: [
			{
				code: 'const health = useAttribute(useCharacter(), "Health");',
				errors: [{ data: { inner: "useCharacter", outer: "useAttribute" }, messageId: "nestedHookCall" }],
				documentation: { id: "fail", title: "Hook call nested in a hook argument" },
			},
			{
				code: "useThing(useValue().Name);",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(useValue().method());",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "React.useState(React.useContext(Context));",
				errors: [{ data: { inner: "useContext", outer: "useState" }, messageId: "nestedHookCall" }],
			},
			{
				code: "hooks.useThing(hooks.useValue());",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(format(useValue()));",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useA(useB(useC()));",
				errors: [
					{ data: { inner: "useB", outer: "useA" }, messageId: "nestedHookCall" },
					{ data: { inner: "useC", outer: "useB" }, messageId: "nestedHookCall" },
				],
			},
			{
				code: "useThing(useA(), useB());",
				errors: [
					{ data: { inner: "useA", outer: "useThing" }, messageId: "nestedHookCall" },
					{ data: { inner: "useB", outer: "useThing" }, messageId: "nestedHookCall" },
				],
			},
			{
				code: "useEffect(callback, [useValue()]);",
				errors: [{ data: { inner: "useValue", outer: "useEffect" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing({ value: useValue() });",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(...useValues());",
				errors: [{ data: { inner: "useValues", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(flag ? useA() : useB());",
				errors: [
					{ data: { inner: "useA", outer: "useThing" }, messageId: "nestedHookCall" },
					{ data: { inner: "useB", outer: "useThing" }, messageId: "nestedHookCall" },
				],
			},
			{
				code: "useThing(useA() ?? useB());",
				errors: [
					{ data: { inner: "useA", outer: "useThing" }, messageId: "nestedHookCall" },
					{ data: { inner: "useB", outer: "useThing" }, messageId: "nestedHookCall" },
				],
			},
			{
				code: "useThing(<frame Size={useSize()} />);",
				errors: [{ data: { inner: "useSize", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(useValue() as Value);",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(useValue()!);",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				// oxlint-disable-next-line no-template-curly-in-string -- the placeholder is the code under test.
				code: "useThing(`${useValue()}`);",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(useFactory()());",
				errors: [{ data: { inner: "useFactory", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useThing(() => 1, useValue());",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useOverlay(function Overlay() { return useThing(useValue()); });",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
			{
				code: "useValue().useThing();",
				errors: [{ data: { inner: "useValue", outer: "useThing" }, messageId: "nestedHookCall" }],
			},
		],
		valid: [
			{
				code: ["const character = useCharacter();", 'const health = useAttribute(character, "Health");'].join(
					"\n",
				),
				documentation: { id: "pass", title: "Hook result assigned before use" },
			},
			"useThing();",
			"useThing(value);",
			"useThing(getValue());",
			"useThing(usevalue());",
			"usething(useValue());",
			"print(useValue());",
			"useThing(() => useValue());",
			"useThing(function () { return useValue(); });",
			"useOverlay(function Overlay() { const value = useValue(); return value; });",
			"function useCustom() { const value = useValue(); return useThing(value); }",
		],
	});
});
