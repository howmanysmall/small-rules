import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RuleOptionsTable } from "@/components/rule-options-table";

import type { ObjectOption } from "@/data/rule-options";

const inlineOption = {
	defaultValue: {
		displayValue: "roblox-ts",
		kind: "inline",
	},
	description: "Selects the runtime environment.",
	name: "environment",
	required: false,
	type: '"node" | "roblox-ts"',
} satisfies ObjectOption;

const complexOption = {
	defaultValue: {
		copyValue: '[{"name":"useEffect"}]',
		displayValue: '[\n\t{\n\t\t"name": "useEffect"\n\t}\n]',
		kind: "complex",
		summary: "1 hook",
	},
	description: "Configures recognized effect hooks.",
	name: "hooks",
	required: true,
	type: "Array<HookConfiguration>",
} satisfies ObjectOption;

describe("RuleOptionsTable", () => {
	it("renders inline and expandable option metadata", async () => {
		const user = userEvent.setup();
		const { container } = render(<RuleOptionsTable options={[inlineOption, complexOption]} />);

		expect(screen.getByText("environment")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("Optional")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("roblox-ts")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("hooks")).toBeInstanceOf(HTMLElement);
		expect(screen.getByText("Required")).toBeInstanceOf(HTMLElement);

		const disclosure = screen.getByRole("button", { name: "1 hook" });
		const detail = container.querySelector<HTMLElement>(".rule-option__detail");
		expect(disclosure.getAttribute("aria-expanded")).toBe("false");
		expect(detail?.hidden).toBe(true);

		await user.click(disclosure);

		expect(disclosure.getAttribute("aria-expanded")).toBe("true");
		expect(detail?.hidden).toBe(false);
	});

	it("copies a complex default and announces success", async () => {
		const user = userEvent.setup();
		const writeText = vi.spyOn(navigator.clipboard, "writeText");
		render(<RuleOptionsTable options={[complexOption]} />);

		await user.click(screen.getByRole("button", { name: "Copy default JSON: hooks" }));

		expect(writeText).toHaveBeenCalledExactlyOnceWith(complexOption.defaultValue.copyValue);
		expect(screen.getByRole("button", { name: "Copied: hooks" }).dataset.state).toBe("copied");
		expect(screen.getByText("Copied")).toBeInstanceOf(HTMLElement);
	});
});
