import { describe } from "vitest";
import rule from "$oxc-rules/no-instance-methods-without-this";

import { tsx } from "./rule-testers";

describe("no-instance-methods-without-this", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("no-instance-methods-without-this", rule, {
		invalid: [
			// Private methods without this
			{
				code: `
class MyClass {
    private notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Protected methods without this
			{
				code: `
class MyClass {
    protected notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Public methods without this
			{
				code: `
class MyClass {
    public notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Default visibility (public) without this
			{
				code: `
class MyClass {
    notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Empty method without this
			{
				code: `
class MyClass {
    private empty(): void {}
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Method with only parameters, no this
			{
				code: `
class MyClass {
    private add(a: number, b: number): number {
        return a + b;
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Computed method names fall back to an unknown method name in diagnostics
			{
				code: `
class MyClass {
    ["notifyChanges"](value: number): void {
        console.log(value);
    }
}
`,
				errors: [
					{
						data: { methodName: "unknown" },
						messageId: "noInstanceMethodWithoutThis",
					},
				],
			},
			// Method calling utility function but no this
			{
				code: `
class MyClass {
    private process(data: any): void {
        const result = processData(data);
        console.log(result);
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }],
			},
			// Multiple methods without this
			{
				code: `
class MyClass {
    private helper1(): void {
        console.log("1");
    }

    private helper2(): void {
        console.log("2");
    }
}
`,
				errors: [{ messageId: "noInstanceMethodWithoutThis" }, { messageId: "noInstanceMethodWithoutThis" }],
			},
		],
		valid: [
			// Static methods are skipped
			{
				code: `
class MyClass {
    static helper(): void {
        console.log("static");
    }
}
`,
			},
			// Methods using this.property
			{
				code: `
class MyClass {
    private value = 0;

    private getValue(): number {
        return this.value;
    }
}
`,
			},
			// Methods using this.method()
			{
				code: `
class MyClass {
    private notify(): void {}

    private process(): void {
        this.notify();
    }
}
`,
			},
			// Methods using super
			{
				code: `
class MyClass extends BaseClass {
    protected override process(): void {
        super.process();
    }
}
`,
			},
			// Method with this in nested function
			{
				code: `
class MyClass {
    private value = 0;

    private process(items: any[]): void {
        items.forEach((item) => {
            console.log(this.value, item);
        });
    }
}
`,
			},
			// Method with this in callback
			{
				code: `
class MyClass {
    private value = 0;

    private async load(): Promise<void> {
        const data = await fetch("url");
        console.log(this.value);
    }
}
`,
			},
			// Method with complex this usage
			{
				code: `
class MyClass {
    private value = 0;

    private update(): void {
        if (this.value > 0) {
            this.value++;
        }
    }
}
`,
			},
			// Method assignment using this
			{
				code: `
class MyClass {
    private value = 0;

    private setValue(newValue: number): void {
        this.value = newValue;
    }
}
`,
			},
			// Getter (not a method, skipped)
			{
				code: `
class MyClass {
    private _value = 0;

    get value(): number {
        return this._value;
    }
}
`,
			},
			// Setter (not a method, skipped)
			{
				code: `
class MyClass {
    private _value = 0;

    set value(v: number) {
        this._value = v;
    }
}
`,
			},
			// Constructor (not a method kind)
			{
				code: `
class MyClass {
    constructor() {
        console.log("constructed");
    }
}
`,
			},
			// Example from issue - using standalone function
			{
				code: `type OnChange = (currentValue: number, previousValue: number) => void;

function notifyChanges(value: number, previousValue: number, onChanges: ReadonlyArray<OnChange>): void {
    for (const onChange of onChanges) onChange(value, previousValue);
}

class MyClass {
    private readonly onChanges = new Array<OnChange>();
    private value = 0;

    public increment(): void {
        const previousValue = this.value;
        const value = previousValue + 1;
        this.value = value;
        notifyChanges(value, previousValue, this.onChanges);
    }
}
`,
			},
		],
	});

	// Configuration tests
	describe("with configuration options", () => {
		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("no-instance-methods-without-this (checkPrivate: false)", rule, {
			invalid: [
				{
					code: `
class MyClass {
    protected notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					errors: [{ messageId: "noInstanceMethodWithoutThis" }],
					options: [{ checkPrivate: false }],
				},
			],
			valid: [
				{
					code: `
class MyClass {
    private notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					options: [{ checkPrivate: false }],
				},
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("no-instance-methods-without-this (checkProtected: false)", rule, {
			invalid: [
				{
					code: `
class MyClass {
    private notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					errors: [{ messageId: "noInstanceMethodWithoutThis" }],
					options: [{ checkProtected: false }],
				},
			],
			valid: [
				{
					code: `
class MyClass {
    protected notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					options: [{ checkProtected: false }],
				},
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("no-instance-methods-without-this (checkPublic: false)", rule, {
			invalid: [
				{
					code: `
class MyClass {
    private notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					errors: [{ messageId: "noInstanceMethodWithoutThis" }],
					options: [{ checkPublic: false }],
				},
			],
			valid: [
				{
					code: `
class MyClass {
    public notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					options: [{ checkPublic: false }],
				},
			],
		});

		// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
		tsx.run("no-instance-methods-without-this (checkPrivate: false, checkProtected: false)", rule, {
			invalid: [
				{
					code: `
class MyClass {
    public notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					errors: [{ messageId: "noInstanceMethodWithoutThis" }],
					options: [{ checkPrivate: false, checkProtected: false }],
				},
			],
			valid: [
				{
					code: `
class MyClass {
    private notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					options: [{ checkPrivate: false, checkProtected: false }],
				},
				{
					code: `
class MyClass {
    protected notifyChanges(value: number): void {
        console.log(value);
    }
}
`,
					options: [{ checkPrivate: false, checkProtected: false }],
				},
			],
		});
	});
});
