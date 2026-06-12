import { describe } from "vitest";
import rule from "$oxc-rules/ban-instances";

import { tsx } from "./rule-testers";

describe("ban-instances", () => {
	// @ts-expect-error The RuleTester types from @types/eslint are stricter than our rule's runtime shape
	tsx.run("ban-instances", rule, {
		invalid: [
			// Array config - new Instance()
			{
				code: 'new Instance("Part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: 'const part = new Instance("Part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			{
				code: 'new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Array config - JSX (lowercase = Roblox Instance)
			{
				code: "<part />;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<frame><textlabel /></frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Frame"] }],
			},
			// Object config with custom messages - new Instance()
			{
				code: 'new Instance("Script");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
			},
			{
				code: 'new Instance("Part");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Part: "Use MeshPart instead" } }],
			},
			// Object config with custom messages - JSX (lowercase)
			{
				code: "<script />;",
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
			},
			// Case-insensitive lookup - UITextSizeConstraint
			{
				code: "<uitextsizeconstraint />;",
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
			},
			{
				code: 'new Instance("UITextSizeConstraint");',
				errors: [{ messageId: "bannedInstanceCustom" }],
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
			},
			// Case-insensitive new Instance() - lowercase string matches
			{
				code: 'new Instance("part");',
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			// Multiple errors
			{
				code: 'new Instance("Part"); new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			{
				code: "<part />;  <frame />;",
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Mixed new Instance() and JSX
			{
				code: '<part />; new Instance("Frame");',
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part", "Frame"] }],
			},
			// Nested JSX - only inner lowercase element errors
			{
				code: "<Frame><part /></Frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Part"] }],
			},
			// Nested JSX - outer lowercase element errors
			{
				code: "<frame><Part /></frame>;",
				errors: [{ messageId: "bannedInstance" }],
				options: [{ bannedInstances: ["Frame"] }],
			},
			// bannedProperties: JSX property bans
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: "<uisizeconstraint maxsize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: imperative property bans
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MaxSize = new Vector2(100, 100);',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: 'const c = new Instance("uisizeconstraint"); c.MaxSize = new Vector2(100, 100);',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.maxsize = new Vector2(100, 100);',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: computed string-literal property assignment
			{
				code: 'const c = new Instance("UISizeConstraint"); c["MaxSize"] = new Vector2(100, 100);',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: property-only bans (no bannedInstances entry for the class)
			{
				code: "<uiaspectratioconstraint AspectRatio={16} />;",
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [
					{ bannedProperties: { UIAspectRatioConstraint: { AspectRatio: "Use a different approach" } } },
				],
			},
			{
				code: 'const c = new Instance("UIAspectRatioConstraint"); c.AspectRatio = 16;',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [
					{ bannedProperties: { UIAspectRatioConstraint: { AspectRatio: "Use a different approach" } } },
				],
			},
			{
				code: '{ const c = new Instance("UISizeConstraint"); c.MaxSize = new Vector2(100, 100); }',
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: "<uisizeconstraint native:MaxSize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedPropertyCustom" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: default message (empty custom message)
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedProperty" }],
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "" } } }],
			},
			// combined class + property bans on same JSX element
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedPropertyCustom" }],
				options: [
					{
						bannedInstances: ["UISizeConstraint"],
						bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } },
					},
				],
			},
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				errors: [{ messageId: "bannedInstanceCustom" }, { messageId: "bannedPropertyCustom" }],
				options: [
					{
						bannedInstances: { UISizeConstraint: "Use something else" },
						bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } },
					},
				],
			},
		],
		valid: [
			// No options
			'new Instance("Part");',
			// No config (empty bannedInstances)
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: [] }],
			},
			// Empty object config
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: {} }],
			},
			// Non-banned classes - new Instance()
			{
				code: 'new Instance("MeshPart");',
				options: [{ bannedInstances: ["Part"] }],
			},
			// Capitalized JSX = custom React component (NOT Roblox Instance)
			{
				code: "<Part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<Frame />;",
				options: [{ bannedInstances: ["Frame"] }],
			},
			{
				code: "<Script />;",
				options: [{ bannedInstances: { Script: "Should not error" } }],
			},
			// Non-banned lowercase JSX
			{
				code: "<meshPart />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Not Instance constructor
			{
				code: 'new SomethingElse("Part");',
				options: [{ bannedInstances: ["Part"] }],
			},
			// Variable argument (not a literal)
			{
				code: "new Instance(className);",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Non-string literal argument
			{
				code: "new Instance(123);",
				options: [{ bannedInstances: ["Part"] }],
			},
			// No arguments
			{
				code: "new Instance();",
				options: [{ bannedInstances: ["Part"] }],
			},
			// JSX member expression (skipped)
			{
				code: "<Foo.Part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			{
				code: "<foo.part />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// Object config - non-banned
			{
				code: 'new Instance("MeshPart");',
				options: [{ bannedInstances: { Part: "Use MeshPart instead" } }],
			},
			// bannedProperties: non-banned property on banned class
			{
				code: "<uisizeconstraint MinSize={new Vector2(10, 10)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MinSize = new Vector2(10, 10);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: wrong class
			{
				code: "<frame MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			{
				code: 'const c = new Instance("Frame"); c.MaxSize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: untracked variable
			{
				code: "c.MaxSize = new Vector2(100, 100);",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: capital JSX component (not a Roblox Instance)
			{
				code: "<UISizeConstraint MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: no bannedProperties config (only bannedInstances, different class)
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedInstances: ["Part"] }],
			},
			// bannedProperties: empty class property config
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: {} } }],
			},
			// bannedProperties: JSX spread attribute
			{
				code: "<uisizeconstraint {...props} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: assignment to a tracked variable itself
			{
				code: 'let c = new Instance("UISizeConstraint"); c = new Instance("Frame");',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: computed non-literal property assignment
			{
				code: 'const c = new Instance("UISizeConstraint"); c[propertyName] = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: assignment on a non-identifier expression
			{
				code: 'const c = new Instance("UISizeConstraint"); getConstraint().MaxSize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: initializer is not a new expression
			{
				code: "const c = getConstraint(); c.MaxSize = new Vector2(100, 100);",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
			// bannedProperties: Instance class name is dynamic
			{
				code: "const c = new Instance(className); c.MaxSize = new Vector2(100, 100);",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
			},
		],
	});
});
