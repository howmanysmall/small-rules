import { describe } from "vitest";
import rule from "$oxc-rules/no-constant-condition-with-break";

import { js } from "./rule-testers";

describe("no-constant-condition-with-break", () => {
	// @ts-expect-error - RuleTester doesn't support the new format of rules
	js.run("no-constant-condition-with-break", rule, {
		invalid: [
			{
				code: "if (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "for (; 1;) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { if (done) continue; doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { switch (value) { case 1: break; default: doThing(); } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { const stop = () => { return; }; stop(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "label: { while (true) { break label; } }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { coroutine.yield(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while (true) { task.wait(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (true) { const pause = () => coroutine.yield(); pause(); doThing(); }",
				errors: [{ messageId: "unexpected" }],
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (false) { break; }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "do { doThing(); } while (0);",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ((true && false) || true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while ((false ? true : false)) { doThing(); }",
				errors: [{ messageId: "unexpected" }, { messageId: "unexpected" }],
			},
			{
				code: "while ((+1)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "while ((0, `value`)) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ([]) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if ({}) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (() => true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (class Value {}) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (undefined) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (NaN) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (Infinity) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (typeof value) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (-1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (~1) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "if (condition ? true : true) { doThing(); }",
				errors: [{ messageId: "unexpected" }],
			},
			{
				code: "const value = true ? one : two;",
				errors: [{ messageId: "unexpected" }],
			},
		],
		valid: [
			"if (condition) { doThing(); }",
			"while (true) { if (done) break; doThing(); }",
			"for (; true;) { if (done) break; doThing(); }",
			"outer: while (true) { if (done) break outer; doThing(); }",
			"function run() { while (true) { if (done) return; doThing(); } }",
			"function run() { while (true) { switch (value) { case 1: return; default: doThing(); } } }",
			"while (value) { doThing(); }",
			{
				code: "while (true) { coroutine.yield(); doThing(); }",
				options: [{ loopExitCalls: ["coroutine.yield"] }],
			},
			{
				code: "while (true) { task.wait(); doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (const item of task.wait()) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (let index = task.wait(); index < 10; index += 1) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "do { doThing(); } while (task.wait());",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (; task.wait(); ) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: "for (let index = 0; index < task.wait(); index += 1) { doThing(); }",
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = [task.wait()];
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = [...task.wait()];
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    target = task.wait();
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
async function run() {
    while (true) {
        await task.wait();
        doThing();
    }
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = task.wait() + 1;
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    getValue(...task.wait());
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = condition ? task.wait() : fallback;
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = fallback || task.wait();
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const value = object[task.wait()];
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    new Factory(...task.wait());
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    first, task.wait();
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    tag\`\${task.wait()}\`;
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    \`\${task.wait()}\`;
    doThing();
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
function* run() {
    while (true) {
        yield task.wait();
        doThing();
    }
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    if (done) {
        task.wait();
    } else {
        doThing();
    }
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    const values = [first, ...rest];
    target = first;
    const binary = first + second;
    call(first, ...rest);
    const conditional = condition ? first : second;
    const logical = first || second;
    const member = object.property;
    const computed = object[key];
    new Factory(first, ...rest);
    first, second;
    tag\`\${value}\`;
    \`\${value}\`;
    +value;
    value++;
    do {
        doThing();
    } while (condition);
    for (const key in object) {
        doThing();
    }
    for (const item of values) {
        doThing();
    }
    for (let index = 0; index < size; index += 1) {
        doThing();
    }
    if (done) {
        doThing();
    }
    label: doThing();
    switch (value) {
        case 1:
            doThing();
            break;
    }
    try {
        doThing();
    } catch (error) {
        recover();
    } finally {
        cleanup();
    }
    while (condition) {
        doThing();
    }
    break;
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    try {
        task.wait();
    } catch (error) {
        recover();
    } finally {
        cleanup();
    }
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
			{
				code: `
while (true) {
    try {
        doThing();
    } catch (error) {
        recover();
    } finally {
        task.wait();
    }
}
`,
				options: [{ loopExitCalls: ["task.wait"] }],
			},
		],
	});
});
