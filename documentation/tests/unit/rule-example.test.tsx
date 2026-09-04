import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RuleExample } from "$components/rule-example";

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const answerExample = "const answer = 42;";
const basicExample = "example";
const printExample = 'print("hello")';

function restoreClipboardAndTimers(): void {
	vi.useRealTimers();
	if (clipboardDescriptor === undefined) Reflect.deleteProperty(navigator, "clipboard");
	else Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
}

describe("rule-example", () => {
	it.each([
		["pass", "Correct"],
		["fail", "Incorrect"],
	] as const)("renders the default %s state", (type, title) => {
		expect.assertions(2);
		const { container } = render(
			<RuleExample type={type}>
				<code>{basicExample}</code>
			</RuleExample>,
		);

		const example = container.querySelector("[data-rule-example]");

		expect(example?.classList.contains(`RuleExample--${type}`)).toBe(true);
		expect(screen.getByText(title).textContent).toBe(title);
	});

	it("renders a custom title", () => {
		expect.assertions(1);
		render(
			<RuleExample title="Allowed callback" type="pass">
				<code>{basicExample}</code>
			</RuleExample>,
		);

		const title = screen.getByText("Allowed callback");

		expect(title.className).toBe("RuleExample-title");
	});

	it("composes the rendered code child", () => {
		expect.assertions(1);
		const { container } = render(
			<RuleExample type="fail">
				<pre>
					<code>{printExample}</code>
				</pre>
			</RuleExample>,
		);

		const content = container.querySelector(".RuleExample-content");

		expect(content?.textContent).toBe('print("hello")');
	});

	it("copies the rendered code", async () => {
		expect.assertions(1);
		const user = userEvent.setup();
		const writeText = vi.spyOn(navigator.clipboard, "writeText");
		render(
			<RuleExample type="pass">
				<pre>
					<code>{answerExample}</code>
				</pre>
			</RuleExample>,
		);

		await user.click(screen.getByRole("button", { name: "Copy example" }));

		expect(writeText).toHaveBeenCalledWith(answerExample);
	});

	it("announces the copied state", async () => {
		expect.assertions(2);
		const user = userEvent.setup();
		render(
			<RuleExample type="pass">
				<code>{basicExample}</code>
			</RuleExample>,
		);
		const copyButton = screen.getByRole("button", { name: "Copy example" });

		await user.click(copyButton);

		expect(copyButton.dataset.copied).toBe("");
		expect(copyButton.getAttribute("aria-label")).toBe("Example copied");
	});

	it("resets the copied state after 1.5 seconds", async () => {
		expect.assertions(2);
		vi.useFakeTimers();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) },
		});
		try {
			render(
				<RuleExample type="pass">
					<code>{basicExample}</code>
				</RuleExample>,
			);
			const copyButton = screen.getByRole("button", { name: "Copy example" });
			fireEvent.click(copyButton);
			await act(async () => {
				await Promise.resolve();
			});

			act(function advanceCopiedTimer(): void {
				vi.advanceTimersByTime(1_500);
			});

			expect(Object.hasOwn(copyButton.dataset, "copied")).toBe(false);
			expect(copyButton.getAttribute("aria-label")).toBe("Copy example");
		} finally {
			restoreClipboardAndTimers();
		}
	});
});
