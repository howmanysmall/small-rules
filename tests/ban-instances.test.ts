import { describe } from "vitest";
import rule from "$oxc-rules/roblox/ban-instances";

import { tsx } from "./rule-testers";

describe("ban-instances", () => {
	tsx.run("ban-instances", rule, {
		invalid: [
			// Array config - new Instance()
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: ["Part"] }],
				errors: [{ messageId: "bannedInstance" }],
				documentation: { id: "fail", title: "banned instance construction" },
			},
			{
				code: 'const part = new Instance("Part");',
				options: [{ bannedInstances: ["Part", "Frame"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			{
				code: 'new Instance("Frame");',
				options: [{ bannedInstances: ["Part", "Frame"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			// Array config - JSX (lowercase = Roblox Instance)
			{
				code: "<part />;",
				options: [{ bannedInstances: ["Part"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			{
				code: "<frame><textlabel /></frame>;",
				options: [{ bannedInstances: ["Frame"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			// Object config with custom messages - new Instance()
			{
				code: 'new Instance("Script");',
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
				errors: [{ messageId: "bannedInstanceCustom" }],
			},
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: { Part: "Use MeshPart instead" } }],
				errors: [{ messageId: "bannedInstanceCustom" }],
			},
			// Object config with custom messages - JSX (lowercase)
			{
				code: "<script />;",
				options: [{ bannedInstances: { Script: "Scripts should not be created at runtime" } }],
				errors: [{ messageId: "bannedInstanceCustom" }],
			},
			// Case-insensitive lookup - UITextSizeConstraint
			{
				code: "<uitextsizeconstraint />;",
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
				errors: [{ messageId: "bannedInstanceCustom" }],
			},
			{
				code: 'new Instance("UITextSizeConstraint");',
				options: [{ bannedInstances: { UITextSizeConstraint: "Use something else" } }],
				errors: [{ messageId: "bannedInstanceCustom" }],
			},
			// Case-insensitive new Instance() - lowercase string matches
			{
				code: 'new Instance("part");',
				options: [{ bannedInstances: ["Part"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			// Multiple errors
			{
				code: 'new Instance("Part"); new Instance("Frame");',
				options: [{ bannedInstances: ["Part", "Frame"] }],
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
			},
			{
				code: "<part />;  <frame />;",
				options: [{ bannedInstances: ["Part", "Frame"] }],
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
			},
			// Mixed new Instance() and JSX
			{
				code: '<part />; new Instance("Frame");',
				options: [{ bannedInstances: ["Part", "Frame"] }],
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedInstance" }],
			},
			// Nested JSX - only inner lowercase element errors
			{
				code: "<Frame><part /></Frame>;",
				options: [{ bannedInstances: ["Part"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			// Nested JSX - outer lowercase element errors
			{
				code: "<frame><Part /></frame>;",
				options: [{ bannedInstances: ["Frame"] }],
				errors: [{ messageId: "bannedInstance" }],
			},
			// bannedProperties: JSX property bans
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: "<uisizeconstraint maxsize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			// bannedProperties: imperative property bans
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MaxSize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: 'const c = new Instance("uisizeconstraint"); c.MaxSize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.maxsize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			// bannedProperties: computed string-literal property assignment
			{
				code: 'const c = new Instance("UISizeConstraint"); c["MaxSize"] = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			// bannedProperties: property-only bans (no bannedInstances entry for
			// the class)
			{
				code: "<uiaspectratioconstraint AspectRatio={16} />;",
				options: [
					{ bannedProperties: { UIAspectRatioConstraint: { AspectRatio: "Use a different approach" } } },
				],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: 'const c = new Instance("UIAspectRatioConstraint"); c.AspectRatio = 16;',
				options: [
					{ bannedProperties: { UIAspectRatioConstraint: { AspectRatio: "Use a different approach" } } },
				],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: '{ const c = new Instance("UISizeConstraint"); c.MaxSize = new Vector2(100, 100); }',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			{
				code: "<uisizeconstraint native:MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } } }],
				errors: [{ messageId: "bannedPropertyCustom" }],
			},
			// bannedProperties: default message (empty custom message)
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "" } } }],
				errors: [{ messageId: "bannedProperty" }],
			},
			// combined class + property bans on same JSX element
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [
					{
						bannedInstances: ["UISizeConstraint"],
						bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } },
					},
				],
				errors: [{ messageId: "bannedInstance" }, { messageId: "bannedPropertyCustom" }],
			},
			{
				code: "<uisizeconstraint MaxSize={new Vector2(100, 100)} />;",
				options: [
					{
						bannedInstances: { UISizeConstraint: "Use something else" },
						bannedProperties: { UISizeConstraint: { MaxSize: "Use a different approach" } },
					},
				],
				errors: [{ messageId: "bannedInstanceCustom" }, { messageId: "bannedPropertyCustom" }],
			},
			{
				code: 'new Instance("Part");',
				options: [{ bannedInstances: { Part: "" } }],
				errors: [{ messageId: "bannedInstance" }],
			},
			{
				code: 'const c = new Instance("UISizeConstraint"); c.MaxSize = new Vector2(100, 100);',
				options: [{ bannedProperties: { UISizeConstraint: { MaxSize: "" } } }],
				errors: [{ messageId: "bannedProperty" }],
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
				documentation: { id: "pass", title: "unlisted instance class" },
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
			{
				code: 'const c = new Instance("UISizeConstraint"); function later() { c.MaxSize = new Vector2(100, 100); }',
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
			// bannedProperties: no bannedProperties config (only
			// bannedInstances, different class)
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
			// bannedProperties: destructured Instance declaration is not tracked
			{
				code: 'const { x } = new Instance("UISizeConstraint"); x.MaxSize = new Vector2(100, 100);',
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
