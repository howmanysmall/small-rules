import { describe } from "vitest";
import rule from "$oxc-rules/no-async-constructor";

import { tsx } from "./rule-testers";

describe("no-async-constructor", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-async-constructor", rule, {
		invalid: [
			// Await expression in constructor
			{
				code: `
class BadAwait {
    constructor() {
        await this.init();
    }
    async init() {}
}
`,
				errors: [{ messageId: "awaitInConstructor" }],
			},

			// .then() chain
			{
				code: `
class BadThen {
    constructor() {
        fetch('/api').then(r => { this.data = r; });
    }
}
`,
				errors: [{ messageId: "promiseChainInConstructor" }],
			},

			// .catch() chain on async method
			{
				code: `
class BadCatchOnAsync {
    constructor() {
        this.load().catch(console.error);
    }
    async load() {}
}
`,
				errors: [{ messageId: "promiseChainInConstructor" }],
			},

			// .finally() chain on async method
			{
				code: `
class BadFinallyOnAsync {
    constructor() {
        this.load().finally(() => {});
    }
    async load() {}
}
`,
				errors: [{ messageId: "promiseChainInConstructor" }],
			},

			// Async IIFE with arrow function
			{
				code: `
class BadAsyncIIFE {
    constructor() {
        (async () => {
            this.data = await fetchData();
        })();
    }
}
`,
				errors: [{ messageId: "asyncIifeInConstructor" }, { messageId: "awaitInConstructor" }],
			},

			// Async IIFE with function keyword
			{
				code: `
class BadAsyncIIFEFunction {
    constructor() {
        (async function() {
            await setup();
        })();
    }
}
`,
				errors: [{ messageId: "asyncIifeInConstructor" }, { messageId: "awaitInConstructor" }],
			},

			// Unhandled async method call (ExpressionStatement)
			{
				code: `
class BadUnhandled {
    constructor() {
        this.initialize();
    }
    async initialize() {}
}
`,
				errors: [{ messageId: "unhandledAsyncCall" }],
			},

			// Orphaned promise in local variable
			{
				code: `
class BadOrphaned {
    constructor() {
        const p = this.load();
    }
    async load() {}
}
`,
				errors: [{ messageId: "orphanedPromise" }],
			},

			// Multiple unhandled calls
			{
				code: `
class BadMultiple {
    constructor() {
        this.a();
        this.b();
    }
    async a() {}
    async b() {}
}
`,
				errors: [{ messageId: "unhandledAsyncCall" }, { messageId: "unhandledAsyncCall" }],
			},

			// Promise.resolve().then()
			{
				code: `
class BadPromiseResolve {
    constructor() {
        Promise.resolve().then(() => this.setup());
    }
    setup() {}
}
`,
				errors: [{ messageId: "promiseChainInConstructor" }],
			},

			// Nested .then() chains
			{
				code: `
class BadNestedThen {
    constructor() {
        this.load().then(x => x.process()).then(y => {});
    }
    async load() {}
}
`,
				errors: [{ messageId: "promiseChainInConstructor" }, { messageId: "promiseChainInConstructor" }],
			},

			// Await with complex expression
			{
				code: `
class BadAwaitComplex {
    constructor() {
        const data = await fetch('/api').then(r => r.json());
    }
}
`,
				errors: [{ messageId: "awaitInConstructor" }, { messageId: "promiseChainInConstructor" }],
			},

			// Async method call inside condition
			{
				code: `
class BadConditional {
    constructor() {
        if (true) {
            this.load();
        }
    }
    async load() {}
}
`,
				errors: [{ messageId: "unhandledAsyncCall" }],
			},

			// Async method call inside loop
			{
				code: `
class BadLoop {
    items: Array<number> = [];
    constructor() {
        for (const item of this.items) {
            this.processItem(item);
        }
    }
    async processItem(item: number) {}
}
`,
				errors: [{ messageId: "unhandledAsyncCall" }],
			},

			// Multiple orphaned promises
			{
				code: `
class BadMultipleOrphaned {
    constructor() {
        const p1 = this.loadA();
        const p2 = this.loadB();
    }
    async loadA() {}
    async loadB() {}
}
`,
				errors: [{ messageId: "orphanedPromise" }, { messageId: "orphanedPromise" }],
			},
		],
		valid: [
			// Static factory pattern
			{
				code: `
class GoodFactory {
    private constructor(private data: string) {}
    static async create(): Promise<GoodFactory> {
        const data = await fetchData();
        return new GoodFactory(data);
    }
}
`,
			},

			// Storing promise on this for later consumption
			{
				code: `
class GoodStoredPromise {
    loadPromise: Promise<void>;
    constructor() {
        this.loadPromise = this.load();
    }
    async load() {}
}
`,
			},

			// Init method pattern (async work outside constructor)
			{
				code: `
class GoodInitMethod {
    async init(): Promise<void> {
        await this.loadData();
    }
    async loadData() {}
}
`,
			},

			// Storing async callback (not invoking)
			{
				code: `
class GoodStoredCallback {
    onClick: () => Promise<void>;
    constructor() {
        this.onClick = async () => {
            await this.handle();
        };
    }
    async handle() {}
}
`,
			},

			// Non-async method call is fine
			{
				code: `
class GoodSyncMethod {
    constructor() {
        this.syncMethod();
    }
    syncMethod() {}
}
`,
			},

			// Regular sync constructor
			{
				code: `
class GoodSyncConstructor {
    value: number;
    constructor() {
        this.value = 42;
    }
}
`,
			},

			// Calling external sync function
			{
				code: `
class GoodExternalSync {
    constructor() {
        console.log('init');
    }
}
`,
			},

			// Empty constructor
			{
				code: `
class GoodEmpty {
    constructor() {}
}
`,
			},

			// Constructor with parameters only
			{
				code: `
class GoodParams {
    constructor(private value: number) {}
}
`,
			},

			// Class without constructor
			{
				code: `
class GoodNoConstructor {
    async doSomething() {
        await this.load();
    }
    async load() {}
}
`,
			},

			// Calling method that is NOT async
			{
				code: `
class GoodNonAsyncMethod {
    constructor() {
        this.setup();
    }
    setup() {
        console.log('setup');
    }
}
`,
			},

			// Async method defined but not called in constructor
			{
				code: `
class GoodAsyncNotCalled {
    constructor() {
        this.syncSetup();
    }
    syncSetup() {}
    async asyncMethod() {}
}
`,
			},

			// Storing multiple promises on this
			{
				code: `
class GoodMultipleStored {
    promiseA: Promise<void>;
    promiseB: Promise<void>;
    constructor() {
        this.promiseA = this.loadA();
        this.promiseB = this.loadB();
    }
    async loadA() {}
    async loadB() {}
}
`,
			},

			// Assignment to this with non-async method
			{
				code: `
class GoodAssignSync {
    result: number;
    constructor() {
        this.result = this.calculate();
    }
    calculate(): number {
        return 42;
    }
}
`,
			},

			// Computed property method (not tracked)
			{
				code: `
class GoodComputedMethod {
    constructor() {
        this['dynamicMethod']();
    }
    async dynamicMethod() {}
}
`,
			},

			// Getter/setter (not async methods)
			{
				code: `
class GoodGetterSetter {
    private _value = 0;
    constructor() {
        this.value = 10;
    }
    get value() { return this._value; }
    set value(v: number) { this._value = v; }
}
`,
			},

			// Static async method (not an instance method)
			{
				code: `
class GoodStaticAsync {
    constructor() {
        // This would be a static call, not this.staticMethod()
        console.log('constructed');
    }
    static async staticMethod() {}
}
`,
			},

			// Arrow function property (not a method definition)
			{
				code: `
class GoodArrowProperty {
    asyncFn = async () => {};
    constructor() {
        // this.asyncFn is a property, not a MethodDefinition with async
        console.log('constructed');
    }
}
`,
			},
		],
	});
});
