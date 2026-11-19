import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/roblox/jecs/prefer-single-world-query-in-jecs";

describe("prefer-single-world-query-in-jecs", () => {
	ts.run("prefer-single-world-query-in-jecs", rule, {
		invalid: [
			// A string key is never a Jecs entity or component, so merging
			// would change what the call does: reported, fix withheld.
			{
				code: `
const host = config.get("server", "host");
const port = config.get("server", "port");
`,
				output: null,
				errors: [{ messageId: "preferSingleGet" }],
			},
			{
				code: `
const hasRead = flags.has(user, "read");
const hasWrite = flags.has(user, "write");
if (hasRead && hasWrite) {}
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Basic get case: two world.get calls on same world and entity
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
`,
				output: `
const [componentA, componentB] = world.get(entity, ComponentA, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
				documentation: { id: "fail", title: "repeated world get calls" },
			},
			// Three get components
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
`,
				output: `
const [componentA, componentB, componentC] = world.get(entity, ComponentA, ComponentB, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Four get components (max for Jecs)
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
const componentD = world.get(entity, ComponentD);
`,
				output: `
const [componentA, componentB, componentC, componentD] = world.get(entity, ComponentA, ComponentB, ComponentC, ComponentD);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Catches merging past the four components Jecs get accepts, which
			// leaves the fifth variable undefined.
			{
				code: `
const componentA = world.get(entity, ComponentA);
const componentB = world.get(entity, ComponentB);
const componentC = world.get(entity, ComponentC);
const componentD = world.get(entity, ComponentD);
const componentE = world.get(entity, ComponentE);
const componentF = world.get(entity, ComponentF);
`,
				output: `
const [componentA, componentB, componentC, componentD] = world.get(entity, ComponentA, ComponentB, ComponentC, ComponentD);
const [componentE, componentF] = world.get(entity, ComponentE, ComponentF);
`,
				errors: [{ messageId: "preferSingleGet" }, { messageId: "preferSingleGet" }],
			},
			// Method call on world object
			{
				code: `
const componentA = this.world.get(entity, ComponentA);
const componentB = this.world.get(entity, ComponentB);
`,
				output: `
const [componentA, componentB] = this.world.get(entity, ComponentA, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Multiple different entities (should only group matching entity)
			{
				code: `
const componentA = world.get(entityA, ComponentA);
const componentB = world.get(entityA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
				output: `
const [componentA, componentB] = world.get(entityA, ComponentA, ComponentB);
const componentC = world.get(entityB, ComponentC);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Complex expression as entity
			{
				code: `
const componentA = world.get(entities[0], ComponentA);
const componentB = world.get(entities[0], ComponentB);
`,
				output: `
const [componentA, componentB] = world.get(entities[0], ComponentA, ComponentB);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Has() calls combined in && expression
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB) { doSomething(); }
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
if (hasAll) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
hasA = false;
if (hasA && hasB) { doSomething(); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Three has() calls in &&
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const hasC = world.has(entity, ComponentC);
if (hasA && hasB && hasC) { doSomething(); }
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB, ComponentC);
if (hasAll) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Has() in while loop condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
while (hasA && hasB) { doSomething(); }
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
while (hasAll) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Has() in ternary
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const result = hasA && hasB ? "yes" : "no";
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
const result = hasAll ? "yes" : "no";
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Has() in for loop condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
for (; hasA && hasB;) { doSomething(); }
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
for (; hasAll;) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Has() in do/while condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
do { doSomething(); } while (hasA && hasB);
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
do { doSomething(); } while (hasAll);
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Has() in nested if condition
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if ((hasA && hasB) === true) { doSomething(); }
`,
				output: `
const hasAll = world.has(entity, ComponentA, ComponentB);
if ((hasAll) === true) { doSomething(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Flushes a has() group when the next consecutive query changes
			// entity
			{
				code: `
const hasA = world.has(entityA, ComponentA);
const hasB = world.has(entityA, ComponentB);
const hasC = world.has(entityB, ComponentC);
if (hasA && hasB) { doSomething(); }
if (hasC) { doSomethingElse(); }
`,
				output: `
const hasAll = world.has(entityA, ComponentA, ComponentB);
const hasC = world.has(entityB, ComponentC);
if (hasAll) { doSomething(); }
if (hasC) { doSomethingElse(); }
`,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when a component reads an earlier result
			// (the merged call runs before any variable exists)
			{
				code: `
const first = world.get(entity, First);
const target = world.get(entity, Target);
const data = world.get(entity, pair(Relation, target));
const other = world.get(entity, Other);
`,
				output: null,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// A nested function only reads the result later
			{
				code: `
const first = world.get(entity, First);
const second = world.get(entity, () => first);
`,
				output: `
const [first, second] = world.get(entity, First, () => first);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// Reports without a fix while a merged flag is still read elsewhere
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB) { doSomething(); }
if (hasA) { doSomethingElse(); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
const copy = hasA;
if (hasA && hasB) { doSomething(); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when the chain holds other operands
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB && ready) { doSomething(); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when the chain precedes the declarations
			{
				code: `
function check() { return hasA && hasB; }
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when the merged name is already taken
			{
				code: `
const hasAll = compute();
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, ComponentB);
if (hasA && hasB) { doSomething(hasAll); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when a component reads an earlier flag
			{
				code: `
const hasA = world.has(entity, ComponentA);
const hasB = world.has(entity, pair(Relation, hasA));
if (hasA && hasB) { doSomething(); }
`,
				output: null,
				errors: [{ messageId: "preferSingleHas" }],
			},
			// Reports without a fix when the merged get would drop annotations
			{
				code: `
const position: Vector3 | undefined = world.get(entity, Position);
const velocity: Vector3 | undefined = world.get(entity, Velocity);
`,
				output: null,
				errors: [{ messageId: "preferSingleGet" }],
			},
			{
				code: `
const position = world.get(entity, Position);
const velocity: Vector3 | undefined = world.get(entity, Velocity);
`,
				output: null,
				errors: [{ messageId: "preferSingleGet" }],
			},
			// An annotated get outside the group leaves the group's fix alone
			{
				code: `
const owner: Entity = world.get(other, Owner);
const position = world.get(entity, Position);
const velocity = world.get(entity, Velocity);
`,
				output: `
const owner: Entity = world.get(other, Owner);
const [position, velocity] = world.get(entity, Position, Velocity);
`,
				errors: [{ messageId: "preferSingleGet" }],
			},
		],
		valid: [
			// A single annotated get has nothing to merge
			{
				code: "const position: Vector3 | undefined = world.get(entity, Position);",
			},
			// Single world.get call (nothing to optimize)
			{
				code: "const componentA = world.get(entity, ComponentA);",
				documentation: { id: "pass", title: "single world get call" },
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
			// Multiple declarators are left alone because the fixer replaces
			// whole declarations
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
