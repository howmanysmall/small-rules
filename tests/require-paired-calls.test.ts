import { describe } from "vitest";
import rule from "$oxc-rules/require-paired-calls";

import { js } from "./rule-testers";

describe("require-paired-calls", () => {
	js.run("require-paired-calls", rule, {
		invalid: [
			// Basic unpaired opener
			{
				code: `
function test() {
    debug.profilebegin("task");
    doWork();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Unpaired closer (no opener)
			{
				code: `
function test() {
    doWork();
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedCloser" }],
			},

			// Missing closer on early return
			{
				code: `
function test() {
    debug.profilebegin("task");
    if (error) return;
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Missing closer on throw
			{
				code: `
function test() {
    debug.profilebegin("task");
    if (error) throw new Error("fail");
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Missing closer in try block (exception path)
			{
				code: `
function test() {
    debug.profilebegin("task");
    try {
        riskyOperation();
        debug.profileend();
    } catch (e) {
        handleError(e);
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Break skips closer when opener lives inside loop
			{
				code: `
function test() {
    for (const item of items) {
        debug.profilebegin("loop");
        if (item.stop) break;
        debug.profileend();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Continue skips closer when opener lives inside loop
			{
				code: `
function test() {
    for (const item of items) {
        debug.profilebegin("loop");
        if (item.skip) continue;
        process(item);
        debug.profileend();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Labeled continue skipping closer in outer loop
			{
				code: `
function test(matrix) {
    outer: for (const row of matrix) {
        debug.profilebegin("row");
        for (const cell of row) {
            if (cell.skip) continue outer;
        }
        debug.profileend();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Labeled break skipping closer in outer loop
			{
				code: `
    function test(matrix) {
        outer: for (const row of matrix) {
        debug.profilebegin("row");
        for (const cell of row) {
            if (cell.stop) break outer;
        }
        debug.profileend();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Alternative opener without closer
			{
				code: `
function test() {
    Iris.Window("Title");
    if (condition) return;
    Iris.End();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								openerAlternatives: ["Iris.Window"],
								requireSync: false,
							},
						],
					},
				],
			},

			// Wrong LIFO order
			{
				code: `
function test() {
    debug.profilebegin("a");
    debug.profilebegin("b");
    debug.profileend(); // closes b
    // a is still open at function exit
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Multiple consecutive openers (when disallowed)
			{
				code: `
function test() {
    debug.profilebegin("task");
    debug.profilebegin("task");
    debug.profileend();
    debug.profileend();
}
`,
				errors: [{ messageId: "multipleOpeners" }],
				options: [
					{
						allowMultipleOpeners: false,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Too many closers
			{
				code: `
function test() {
    debug.profilebegin("task");
    debug.profileend();
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedCloser" }],
			},

			// Contextual error: empty stack
			{
				code: `
function test() {
    Iris.End();
}
`,
				errors: [{ data: { closer: "Iris.End" }, messageId: "unpairedCloser" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								openerAlternatives: ["Iris.Window", "Iris.Combo"],
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Contextual error: wrong closer when stack has opener
			{
				code: `
function test() {
    Iris.CollapsingHeader(["Units"]);
    debug.profileend();
}
`,
				errors: [
					// Iris.CollapsingHeader never closed
					{ messageId: "unpairedOpener" },
					{ data: { closer: "debug.profileend", expected: "Iris.End" }, messageId: "unexpectedCloser" },
				],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								platform: "roblox",
								requireSync: true,
							},
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Contextual error: multiple expected closers
			{
				code: `
function test() {
    db.transaction();
    Iris.End();
}
`,
				errors: [
					{ messageId: "unpairedOpener" },
					{
						data: { closer: "Iris.End", expected: "db.commit' or 'db.rollback" },
						messageId: "unexpectedCloser",
					},
				],
				options: [
					{
						pairs: [
							{
								alternatives: ["db.rollback"],
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Await with requireSync: true
			{
				code: `
async function test() {
    debug.profilebegin("task");
    await fetch("/api");
    debug.profileend();
}
`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Yield with requireSync: true
			{
				code: `
function* test() {
    debug.profilebegin("task");
    yield 1;
    debug.profileend();
}
`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// For-await-of with requireSync: true
			{
				code: `
async function test() {
    debug.profilebegin("task");
    for await (const item of asyncIterable) {
        process(item);
    }
    debug.profileend();
}
`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Roblox yielding function auto-closes profiles
			{
				code: `
function test() {
    debug.profilebegin("task");
    task.wait(1);
    debug.profileend();
}
`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Roblox wait() function
			{
				code: `
function test() {
    debug.profilebegin("task");
    wait(1);
    debug.profileend();
}
`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Roblox WaitForChild method
			{
				code: `
function test() {
    debug.profilebegin("task");
    const part = workspace.WaitForChild("Part");
    debug.profileend();
}
`,
				errors: [{ messageId: "robloxYieldViolation" }],
			},

			// Nested profiles both auto-closed by yielding
			{
				code: `
function test() {
    debug.profilebegin("outer");
    debug.profilebegin("inner");
    task.wait(0.1);
    debug.profileend();
    debug.profileend();
}
`,
				errors: [{ messageId: "robloxYieldViolation" }, { messageId: "unpairedCloser" }],
			},

			// Conditional opener without guaranteed closer
			{
				code: `
function test() {
    if (shouldProfile) {
        debug.profilebegin("task");
    }
    doWork();
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedCloser" }],
			},

			// Switch without closer in all branches
			{
				code: `
function test(val) {
    debug.profilebegin("switch");
    switch (val) {
        case 1:
            debug.profileend();
            break;
        case 2:
            return; // missing closer
    }
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Max nesting depth exceeded
			{
				code: `
function test() {
    debug.profilebegin("a");
    debug.profilebegin("b");
    debug.profilebegin("c");
    debug.profileend();
    debug.profileend();
    debug.profileend();
}
`,
				errors: [{ messageId: "maxNestingExceeded" }],
				options: [
					{
						maxNestingDepth: 2,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Missing closer in if branch
			{
				code: `
function test() {
    debug.profilebegin("task");
    if (condition1) {
        debug.profileend();
    } else if (condition2) {
        debug.profileend();
    }
    // No closer if both conditions false
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Async generator with yield
			{
				code: `
async function* test() {
    debug.profilebegin("task");
    yield 1;
    debug.profileend();
}
`,
				errors: [{ messageId: "asyncViolation" }],
			},

			// Return in loop body with opener before loop
			{
				code: `
function test() {
    debug.profilebegin("task");
    for (const item of items) {
        if (item.found) return item;
    }
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Throw in loop body with opener before loop
			{
				code: `
function test() {
    debug.profilebegin("task");
    for (const item of items) {
        if (item.bad) throw new Error("bad");
    }
    debug.profileend();
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// BUG FIX: Single opener in if-block without else (no closer)
			{
				code: `
function test() {
    if (shouldOpen) {
        debug.profilebegin("task");
        doWork();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// BUG FIX: Multiple openers in if-block without else (no closers)
			{
				code: `
function test() {
    Iris.CollapsingHeader(["Units"]);
    if (condition) {
        Iris.Combo(["Units"], { index: state });
        Iris.Window(["Popup"]);
    }
    Iris.End();
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								openerAlternatives: ["Iris.Window", "Iris.Combo"],
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// BUG FIX: Nested if-blocks with missing closers
			{
				code: `
function test() {
    if (outer) {
        Iris.Window(["Outer"]);
        if (inner) {
            Iris.Combo(["Inner"]);
        }
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.Window",
								openerAlternatives: ["Iris.Combo"],
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// BUG FIX: Multiple openers with partial closers in if-block
			{
				code: `
function test() {
    if (condition) {
        Iris.Window(["A"]);
        Iris.Combo(["B"]);
        Iris.Tree(["C"]);
        Iris.End();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.Window",
								openerAlternatives: ["Iris.Combo", "Iris.Tree"],
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// BUG FIX: Openers in both if and else branches without closers
			{
				code: `
function test() {
    if (condition) {
        Iris.Window(["A"]);
    } else {
        Iris.Combo(["B"]);
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.Window",
								openerAlternatives: ["Iris.Combo"],
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Repeated wrong closers reuse the expected-closer cache
			{
				code: `
function test() {
    db.transaction();
    Iris.End();
    Iris.End();
}
`,
				errors: [
					{ messageId: "unpairedOpener" },
					{ data: { closer: "Iris.End", expected: "db.commit" }, messageId: "unexpectedCloser" },
					{ data: { closer: "Iris.End", expected: "db.commit" }, messageId: "unexpectedCloser" },
				],
				options: [
					{
						pairs: [
							{
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
							{
								closer: "Iris.End",
								opener: "Iris.Window",
								requireSync: false,
							},
						],
					},
				],
			},

			// Duplicate closer candidates are de-duplicated in expected-closer messages
			{
				code: `
function test() {
    cache.open();
    ui.close();
}
`,
				errors: [
					{
						data: { closer: "cache.close' or 'cache.abort", opener: "cache.open", paths: "function exit" },
						messageId: "unpairedOpener",
					},
					{
						data: { closer: "ui.close", expected: "cache.close' or 'cache.abort" },
						messageId: "unexpectedCloser",
					},
				],
				options: [
					{
						pairs: [
							{
								alternatives: ["cache.abort"],
								closer: "cache.close",
								opener: "cache.open",
								requireSync: false,
							},
							{
								alternatives: ["cache.close"],
								closer: "cache.abort",
								opener: "cache.open",
								requireSync: false,
							},
							{
								closer: "ui.close",
								opener: "ui.open",
								requireSync: false,
							},
						],
					},
				],
			},

			// Unpaired openers report all configured closer names
			{
				code: `
function test() {
    lock.acquire();
}
`,
				errors: [
					{
						data: { closer: "lock.release' or 'lock.free", opener: "lock.acquire", paths: "function exit" },
						messageId: "unpairedOpener",
					},
				],
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},

			// Multiple closer labels are shown for async violations
			{
				code: `
async function test() {
    lock.acquire();
    await acquirePermit();
    lock.release();
}
`,
				errors: [
					{
						data: { asyncType: "await", closer: "lock.release' or 'lock.free", opener: "lock.acquire" },
						messageId: "asyncViolation",
					},
				],
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: true,
							},
						],
					},
				],
			},

			// Multiple closer labels are shown when a yielding Roblox call auto-closes profiles
			{
				code: `
function test() {
    Span.start();
    task.wait();
    Span.stop();
}
`,
				errors: [
					{
						data: { closer: "Span.stop' or 'Span.abort", yieldingFunction: "task.wait" },
						messageId: "robloxYieldViolation",
					},
				],
				options: [
					{
						pairs: [
							{
								alternatives: ["Span.abort"],
								closer: "Span.stop",
								opener: "Span.start",
								platform: "roblox",
								requireSync: true,
								yieldingFunctions: ["task.wait"],
							},
						],
					},
				],
			},

			// Early exits report all configured closer names
			{
				code: `
function test() {
    lock.acquire();
    if (failed) return;
    lock.release();
}
`,
				errors: [
					{
						data: {
							closer: "lock.release' or 'lock.free",
							opener: "lock.acquire",
							paths: "return at line 4",
						},
						messageId: "unpairedOpener",
					},
				],
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},

			// Loop exits report all configured closer names
			{
				code: `
function test(items) {
    for (const item of items) {
        lock.acquire();
        if (item.done) break;
        lock.release();
    }
}
`,
				errors: [
					{
						data: {
							closer: "lock.release' or 'lock.free",
							opener: "lock.acquire",
							paths: "break at line 5",
						},
						messageId: "unpairedOpener",
					},
				],
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},

			// Closing an older opener before the top opener is out of order
			{
				code: `
function test() {
    db.transaction();
    lock.acquire();
    db.commit();
    lock.release();
}
`,
				errors: [{ messageId: "wrongOrder" }],
				options: [
					{
						pairs: [
							{
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
							{
								closer: "lock.release",
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},
			{
				code: `
function test() {
    a.open();
    b.open();
    a.close();
    b.close();
}
`,
				errors: [{ messageId: "wrongOrder" }],
				options: [
					{
						pairs: [
							{
								closer: "a.close",
								opener: "a.open",
								requireSync: false,
							},
							{
								closer: "b.close",
								opener: "b.open",
								requireSync: false,
							},
						],
					},
				],
			},

			// Closing an older opener before the top opener reports the actual still-open pair
			{
				code: `
function test() {
    outer.begin();
    inner.begin();
    outer.end();
    inner.end();
}
`,
				errors: [
					{
						data: { actual: "inner.begin", closer: "outer.end", expected: "outer.begin" },
						messageId: "wrongOrder",
					},
				],
				options: [
					{
						pairs: [
							{
								closer: "outer.end",
								opener: "outer.begin",
								requireSync: false,
							},
							{
								closer: "inner.end",
								opener: "inner.begin",
								requireSync: false,
							},
						],
					},
				],
			},

			// Complete switch branches must all close an opener that predates the switch
			{
				code: `
function test(kind) {
    debug.profilebegin("switch");
    switch (kind) {
        case "ready":
            debug.profileend();
            break;
        default:
            doWork();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},

			// Complete if branches must all close every opener that predates the branch
			{
				code: `
function test(kind) {
    outer.begin();
    inner.begin();
    if (kind === "inner") {
        inner.end();
    } else {
        outer.end();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }, { messageId: "unpairedOpener" }, { messageId: "wrongOrder" }],
				options: [
					{
						pairs: [
							{
								closer: "outer.end",
								opener: "outer.begin",
								requireSync: false,
							},
							{
								closer: "inner.end",
								opener: "inner.begin",
								requireSync: false,
							},
						],
					},
				],
			},
			// Complete switch branches with a default must all close an opener that predates the switch
			{
				code: `
function test(kind) {
    debug.profilebegin("switch");
    switch (kind) {
        case "ready":
            debug.profileend();
            break;
        default:
            debug.profilebegin("nested");
            debug.profileend();
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},
			// Try/catch branches must all preserve an opener that predates the try
			{
				code: `
function test(enabled) {
    db.transaction();
    try {
        if (enabled) {
            db.commit();
        }
    } catch (error) {
        recover(error);
    }
}
`,
				errors: [{ messageId: "unpairedOpener" }],
				options: [
					{
						pairs: [
							{
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
						],
					},
				],
			},
			// Do-while loop exits can bypass an opener created inside the loop
			{
				code: `
function test(items) {
    let index = 0;
    do {
        debug.profilebegin("item");
        if (items[index].done) break;
        debug.profileend();
        index++;
    } while (index < items.length);
}
`,
				errors: [{ messageId: "unpairedOpener" }],
			},
		],
		valid: [
			// Basic pairing - valid
			{
				code: `
function test() {
    debug.profilebegin("task");
    doWork();
    debug.profileend();
}
	`,
			},
			// Dynamic callee calls are not paired-call names
			{
				code: `
function test(makeCall) {
    makeCall()();
}
`,
			},

			// Nested pairs - valid LIFO order
			{
				code: `
function test() {
    debug.profilebegin("outer");
    debug.profilebegin("inner");
    debug.profileend(); // closes inner
    debug.profileend(); // closes outer
}
`,
			},

			// Try-finally - closer guaranteed
			{
				code: `
function test() {
    debug.profilebegin("task");
    try {
        riskyOperation();
    } finally {
        debug.profileend();
    }
}
`,
			},
			// Do-while loops are valid when the closer is reached before loop control exits
			{
				code: `
function test(items) {
    let index = 0;
    do {
        debug.profilebegin("item");
        process(items[index]);
        debug.profileend();
        index++;
    } while (index < items.length);
}
`,
			},
			// Finally blocks may return after closing the active opener
			{
				code: `
function test() {
    debug.profilebegin("task");
    try {
        doWork();
    } finally {
        debug.profileend();
        return;
    }
}
`,
			},

			// Try-catch with closers in both branches
			{
				code: `
function test() {
    debug.profilebegin("task");
    try {
        riskyOperation();
        debug.profileend();
    } catch (e) {
        debug.profileend();
        throw e;
    }
}
`,
			},

			// Conditional closer in both branches
			{
				code: `
function test() {
    debug.profilebegin("task");
    if (condition) {
        debug.profileend();
    } else {
        debug.profileend();
    }
}
`,
			},

			// Loop with pairs inside iteration
			{
				code: `
function test() {
    for (const item of items) {
        debug.profilebegin("item");
        process(item);
        debug.profileend();
    }
}
`,
			},

			// Normal loop completion (no breaks/continues)
			{
				code: `
function test() {
    debug.profilebegin("loop");
    for (let i = 0; i < 10; i++) {
        doWork(i);
    }
    debug.profileend();
}
`,
			},

			// Loop control statements that don't bypass outer closer
			{
				code: `
function test(items) {
    debug.profilebegin("loop");
    for (const item of items) {
        if (!item) continue;
        if (item.done) break;
        process(item);
    }
    debug.profileend();
}
`,
			},

			// Break inside switch should not trigger
			{
				code: `
function test(value) {
    debug.profilebegin("task");
    while (value > 0) {
        switch (value) {
            case 1:
                break;
            default:
                value--;
        }
        value--;
    }
    debug.profileend();
}
`,
			},

			// Labeled continue that keeps outer opener paired
			{
				code: `
function test(matrix) {
    debug.profilebegin("matrix");
    outer: for (const row of matrix) {
        for (const cell of row) {
            if (!cell) continue outer;
            processCell(cell);
        }
    }
    debug.profileend();
}
`,
			},

			// Alternative opener with closer
			{
				code: `
function test() {
    Iris.Window("Title");
    doWork();
    Iris.End();
}
`,
				options: [
					{
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								openerAlternatives: ["Iris.Window"],
								requireSync: false,
							},
						],
					},
				],
			},

			// Multiple Iris widgets sharing the same closer
			{
				code: `
function test(state) {
    Iris.Window(["Main"]);
    Iris.CollapsingHeader(["Units"]);
    Iris.Combo(["Units"], { index: state });
    Iris.End();
    Iris.End();
    Iris.End();
}
`,
				options: [
					{
						allowMultipleOpeners: false,
						pairs: [
							{
								closer: "Iris.End",
								opener: "Iris.CollapsingHeader",
								platform: "roblox",
								requireSync: true,
								yieldingFunctions: ["task.wait", "wait"],
							},
							{
								closer: "Iris.End",
								opener: "Iris.Window",
								platform: "roblox",
								requireSync: true,
								yieldingFunctions: ["task.wait", "wait"],
							},
							{
								closer: "Iris.End",
								opener: "Iris.Combo",
								platform: "roblox",
								requireSync: true,
								yieldingFunctions: ["task.wait", "wait"],
							},
						],
					},
				],
			},

			// Separate functions have their own scopes
			{
				code: `
function outer() {
    debug.profilebegin("outer");
    inner();
    debug.profileend();
}

function inner() {
    debug.profilebegin("inner");
    doWork();
    debug.profileend();
}
`,
			},

			// Callbacks have separate scopes
			{
				code: `
function test() {
    debug.profilebegin("outer");
    items.forEach(item => {
        debug.profilebegin("inner");
        process(item);
        debug.profileend();
    });
    debug.profileend();
}
`,
			},

			// Switch with closers in all branches
			{
				code: `
function test(val) {
    switch (val) {
        case 1:
            debug.profilebegin("one");
            doWork();
            debug.profileend();
            break;
        case 2:
            debug.profilebegin("two");
            doWork();
            debug.profileend();
            break;
        default:
            debug.profilebegin("default");
            doWork();
            debug.profileend();
    }
}
`,
			},

			// No paired calls at all
			{
				code: `
function test() {
    doWork();
    return 42;
}
`,
			},

			// Member calls with non-identifier objects or properties are ignored
			{
				code: `
function test() {
    debug.profilebegin("task");
    getProfiler().profilebegin("nested");
    debug[getEndName()]();
    debug.profileend();
}
`,
			},

			// Await is allowed while a non-sync pair is open
			{
				code: `
async function test() {
    db.transaction();
    await db.users.insert({ name: "Ada" });
    db.commit();
}
`,
				options: [
					{
						pairs: [
							{
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
						],
					},
				],
			},

			// For-await loops are allowed while a non-sync pair is open
			{
				code: `
async function test(items) {
    db.transaction();
    for await (const item of items) {
        await process(item);
    }
    db.commit();
}
`,
				options: [
					{
						pairs: [
							{
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
						],
					},
				],
			},

			// Custom pair configuration
			{
				code: `
function test() {
    db.transaction();
    try {
        db.users.insert({ name: "test" });
        db.commit();
    } catch (err) {
        db.rollback();
        throw err;
    }
}
`,
				options: [
					{
						pairs: [
							{
								alternatives: ["db.rollback"],
								closer: "db.commit",
								opener: "db.transaction",
								requireSync: false,
							},
						],
					},
				],
			},

			// Array closers
			{
				code: `
function test() {
    lock.acquire();
    doWork();
    lock.release();
}
`,
				options: [
					{
						pairs: [
							{
								closer: ["lock.release", "lock.free"],
								opener: "lock.acquire",
								requireSync: false,
							},
						],
					},
				],
			},
			// Conditional closers can be intentionally optional
			{
				code: `
function test() {
    debug.profilebegin("maybe");
    if (condition) {
        debug.profileend();
    } else {
        doWork();
    }
}
`,
				options: [
					{
						allowConditionalClosers: true,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},

			// Computed member calls are ignored because static names are required
			{
				code: `
function test() {
    const begin = "profilebegin";
    const end = "profileend";
    debug[begin]("task");
    debug[end]();
}
`,
			},

			// Literal computed members are also ignored because static names are required
			{
				code: `
function test() {
    debug["profilebegin"]("task");
    debug["profileend"]();
}
`,
			},

			// Labeled breaks to non-loop blocks should not be treated as loop exits
			{
				code: `
function test(ready) {
    debug.profilebegin("task");
    done: {
        if (ready) break done;
        doWork();
    }
    debug.profileend();
}
`,
			},

			// Conditional closers can be intentionally optional in try/catch branches
			{
				code: `
function test() {
    debug.profilebegin("task");
    try {
        debug.profileend();
    } catch (error) {
        recover(error);
    }
}
`,
				options: [
					{
						allowConditionalClosers: true,
						pairs: [
							{
								closer: "debug.profileend",
								opener: "debug.profilebegin",
								platform: "roblox",
								requireSync: true,
							},
						],
					},
				],
			},
		],
	});
});

describe("require-paired-calls - coverage locks", () => {
	js.run("require-paired-calls - nested function stack isolation", rule, {
		invalid: [],
		valid: [
			{
				code: `
function test() {
    debug.profilebegin("outer");

    function inner() {
        debug.profilebegin("inner");
        doWork();
        debug.profileend();
    }

    inner();
    debug.profileend();
}
`,
			},
		],
	});
});
