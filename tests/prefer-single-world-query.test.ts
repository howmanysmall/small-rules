import { describe } from "vitest";
import rule from "$oxc-rules/prefer-single-world-query";

import { ts } from "./rule-testers";

describe("prefer-single-world-query", () => {
	ts.run("prefer-single-world-query", rule, {
		invalid: [
			// Basic get case: two world.get calls on same world and entity
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entity, ComponentA, ComponentB);
`,
			},
			// Three get components
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB, componentC] = world.get(entity, ComponentA, ComponentB, ComponentC);
`,
			},
			// Four get components (max for Jecs)
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
const componentD = world.get(entity, ComponentD);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB, componentC, componentD] = world.get(entity, ComponentA, ComponentB, ComponentC, ComponentD);
`,
			},
			// Method call on world object
			{
				code: `
const componentA = this.world.get(entity, ComponentA);
const componentB = this.world.get(entity, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = this.world.get(entity, ComponentA, ComponentB);
`,
			},
			// Multiple different entities (should only group matching entity)
			{
				code: `
const componentA = world.get(entityA, ComponentA);
const componentB = world.get(entityA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entityA, ComponentA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
			},
			// Complex expression as entity
			{
				code: `
const componentA = world.get(entities[0], ComponentA);
const componentB = world.get(entities[0], ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				output: `
const [componentA, componentB] = world.get(entities[0], ComponentA, ComponentB);
`,
			},
			// Has() calls combined in && expression
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
if (hasA && hasB) { doSomething(); }
`,
			},
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
hasA = false;
if (hasA && hasB) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
hasA = false;
if (hasA && hasB) { doSomething(); }
`,
			},
			// Three has() calls in &&
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const hasC = world.has(entity, ComponentC);
if (hasA && hasB && hasC) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB, ComponentC);
if (hasA && hasB && hasC) { doSomething(); }
`,
			},
			// Has() in while loop condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
while (hasA && hasB) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
while (hasA && hasB) { doSomething(); }
`,
			},
			// Has() in ternary
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const result = hasA && hasB ? "yes" : "no";
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
const result = hasA && hasB ? "yes" : "no";
`,
			},
			// Has() in for loop condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
for (; hasA && hasB;) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
for (; hasA && hasB;) { doSomething(); }
`,
			},
			// Has() in do/while condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
do { doSomething(); } while (hasA && hasB);
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
do { doSomething(); } while (hasA && hasB);
`,
			},
			// Has() in nested if condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if ((hasA && hasB) === true) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
if ((hasA && hasB) === true) { doSomething(); }
`,
			},
			// Flushes a has() group when the next consecutive query changes entity
			{
				code: `
const hasA = world.has(entityA, ComponentA);
const hasB = world.has(entityA, ComponentB);
const hasC = world.has(entityB, ComponentC);
if (hasA && hasB) { doSomething(); }
if (hasC) { doSomethingElse(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
				output: `
const hasAll = world.has(entityA, ComponentA, ComponentB);
const hasC = world.has(entityB, ComponentC);
if (hasA && hasB) { doSomething(); }
if (hasC) { doSomethingElse(); }
`,
			},
		],
		valid: [
			// Single world.get call (nothing to optimize)
			{
				code: "const componentA = world.get(entity, ComponentA);",
			},
			// Different worlds
			{
				code: `
const componentA = worldA.get(entity, ComponentA);
const componentB = worldB.get(entity, ComponentB);
`,
			},
			// Different entities
			{
				code: `
const componentA = world.get(entityA, ComponentA);
const componentB = world.get(entityB, ComponentB);
`,
			},
			// Not a call expression
			{
				code: "const componentA = world.get;",
			},
			// Wrong number of arguments (not a standard world.get)
			{
				code: "const componentA = world.get(entity);",
			},
			{
				code: "const componentA = world.get(entity, ComponentA, extraArg);",
			},
			// Multiple declarators are left alone because the fixer replaces whole declarations
			{
				code: "const componentA = world.get(entity, ComponentA), componentB = world.get(entity, ComponentB);",
			},
			// Declarations without initializers are not query calls
			{
				code: `
const componentA = world.get(entity, ComponentA);
let componentB: ComponentB | undefined;
const componentC = world.get(entity, ComponentC);
`,
			},
			// Computed property access
			{
				code: "const componentA = world['get'](entity, ComponentA);",
			},
			// Not const declaration
			{
				code: `
let componentA = world.get(entity, ComponentA);
let componentB = world.get(entity, ComponentB);
`,
			},
			// Array destructuring in declaration
			{
				code: `
const [componentA] = world.get(entity, ComponentA);
const [componentB] = world.get(entity, ComponentB);
`,
			},
			// Object destructuring in declaration
			{
				code: `
const { a } = world.get(entity, ComponentA);
const { b } = world.get(entity, ComponentB);
`,
			},
			// Spread element in arguments
			{
				code: "const componentA = world.get(entity, ...components);",
			},
			// Non-identifier variable name
			{
				code: `
const { x } = world.get(entity, ComponentA);
const { y } = world.get(entity, ComponentB);
`,
			},
			// Has() calls used separately (not in &&)
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA) { doA(); }
if (hasB) { doB(); }
`,
			},
			// Has() calls used in || (not &&)
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA || hasB) { doSomething(); }
`,
			},
			// Has() calls used independently
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const x = hasA;
const y = hasB;
`,
			},
			// Single has() call
			{
				code: "const hasA = world.has(entity, ComponentA);",
			},
			// Non-consecutive get() calls (other code between)
			{
				code: `
const a = world.get(entity, ComponentA);
console.log("something");
const b = world.get(entity, ComponentB);
`,
			},
			// Non-consecutive get() calls (function call between)
			{
				code: `
const firstPrimaryPart = world.get(entity, PrimaryPart);
systemFunc(context, 0);
expect(firstPrimaryPart).toBe(mockModel.PrimaryPart);
const secondPrimaryPart = world.get(entity, PrimaryPart);
`,
			},
			// Non-consecutive has() calls
			{
				code: `
const hasA = world.has(entity, ComponentA);
doSomething();
const hasB = world.has(entity, ComponentB);
`,
			},
			// Non-consecutive - let declaration between
			{
				code: `
const a = world.get(entity, ComponentA);
let x = 5;
const b = world.get(entity, ComponentB);
`,
			},
		],
	});
});
