import { describe } from "vitest";
import rule from "$oxc-rules/no-task-wait";

import { js } from "./rule-testers";

describe("no-task-wait", () => {
	js.run("no-task-wait", rule, {
		invalid: [
			{
				code: "task.wait();",
				errors: [{ messageId: "noTaskWait" }],
			},
			{
				code: "task.wait(1);",
				errors: [{ messageId: "noTaskWait" }],
			},
			{
				code: "const elapsed = task.wait(0.1);",
				errors: [{ messageId: "noTaskWait" }],
			},
			{
				code: 'task["wait"](0.1);',
				errors: [{ messageId: "noTaskWait" }],
			},
			{
				code: "Promise.delay(0).await();",
				errors: [{ messageId: "noPromiseDelayAwait" }],
			},
			{
				code: "const result = Promise.delay(1).await();",
				errors: [{ messageId: "noPromiseDelayAwait" }],
			},
			{
				code: 'Promise["delay"](1)["await"]();',
				errors: [{ messageId: "noPromiseDelayAwait" }],
			},
		],
		valid: [
			"callback();",
			"task.delay(1, callback);",
			"advanceFrameLoopBy(1);",
			"wait(1);",
			"object.wait();",
			"task.spawn(callback);",
			"task[methodName]();",
			"other.delay(1).await();",
			"delay(1).await();",
			"Promise.delay.await();",
			"Promise.resolve(1).await();",
			"Promise.delay(1).andThen(callback);",
			"Promise[methodName](1).await();",
		],
	});
});
