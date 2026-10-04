import { describe } from "vitest";

import rule from "$oxc-rules/roblox/jecs/prefer-membership-filter-in-jecs";

import { ts } from "./rule-testers";

describe("prefer-membership-filter-in-jecs", () => {
	ts.run("prefer-membership-filter-in-jecs", rule, {
		invalid: [
			// Catches queried component values that are fetched but never consumed.
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, visual, transform] of gameWorld.query(Visual, Transform).with(User)) {",
					"\trender(entity, visual);",
					"}",
				].join("\n"),
				output: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, visual] of gameWorld.query(Visual).with(Transform, User)) {",
					"\trender(entity, visual);",
					"}",
				].join("\n"),
				errors: [{ messageId: "preferMembershipFilter" }],
				documentation: { id: "fail", title: "discarded queried component value" },
			},
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, , transform] of gameWorld.query(Visual, Transform).without(Dead)) {",
					"\tmove(entity, transform);",
					"}",
				].join("\n"),
				output: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, transform] of gameWorld.query(Transform).with(Visual).without(Dead)) {",
					"\tmove(entity, transform);",
					"}",
				].join("\n"),
				errors: [{ messageId: "preferMembershipFilter" }],
			},
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, visual] of gameWorld.query(Visual, getTransform())) use(entity, visual);",
				].join("\n"),
				output: null,
				errors: [{ messageId: "preferMembershipFilter" }],
			},
			{
				code: 'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, { value }] of gameWorld.query(Visual, Transform)) use(entity, value);',
				output: 'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, { value }] of gameWorld.query(Visual).with(Transform)) use(entity, value);',
				errors: [{ messageId: "preferMembershipFilter" }],
			},
			{
				code: 'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld.query(Visual, Transform).with()) use(entity, visual);',
				output: 'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld.query(Visual).with(Transform)) use(entity, visual);',
				errors: [{ messageId: "preferMembershipFilter" }],
			},
		],
		valid: [
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"for (const [entity, visual] of gameWorld.query(Visual).with(Transform, User)) render(entity, visual);",
				].join("\n"),
				documentation: { id: "pass", title: "membership-only components in with" },
			},
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual, transform] of gameWorld.query(Visual, Transform)) render(entity, visual, transform);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual, ...rest] of gameWorld.query(Visual, Transform)) render(entity, visual, rest);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nconst query = gameWorld.query(Visual, Transform);\nfor (const [entity, visual] of query) render(entity, visual);',
			'import { world } from "other-package";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld.query(Visual, Transform)) render(entity, visual);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity] of gameWorld.query(Visual)) render(entity);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, _visual, transform] of gameWorld.query(Visual, Transform)) render(entity, _visual, transform);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld["query"](Visual, Transform)) render(entity, visual);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld.query(Visual, Transform).cached()) render(entity, visual);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (entry of gameWorld.query(Visual, Transform)) use(entry);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const value of gameWorld.query(Visual, Transform)) use(value);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [, visual] of gameWorld.query(Visual, Transform)) use(visual);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [{ id }, visual] of gameWorld.query(Visual, Transform)) use(id, visual);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nfor (const [entity, visual] of gameWorld.query(...components)) use(entity, visual);',
		],
	});
});
