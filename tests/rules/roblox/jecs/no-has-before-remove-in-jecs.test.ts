import { describe } from "vitest";

import rule from "$oxc-rules/roblox/jecs/no-has-before-remove-in-jecs";

import { ts } from "./rule-testers";

describe("no-has-before-remove-in-jecs", () => {
	ts.run("no-has-before-remove-in-jecs", rule, {
		invalid: [
			// Catches a redundant presence check around Jecs component removal.
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"if (gameWorld.has(entity, Component)) {",
					"\tgameWorld.remove(entity, Component);",
					"}",
				].join("\n"),
				output: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"gameWorld.remove(entity, Component);",
				].join("\n"),
				errors: [{ messageId: "removeWithoutHas" }],
				documentation: { id: "fail", title: "guarded Jecs component removal" },
			},
			{
				code: [
					'import * as jecs from "@rbxts/jecs";',
					"const gameWorld = jecs.world();",
					"if (gameWorld.has(getEntity(), Component)) gameWorld.remove(getEntity(), Component);",
				].join("\n"),
				output: null,
				errors: [{ messageId: "removeWithoutHas" }],
			},
		],
		valid: [
			{
				code: [
					'import { world } from "@rbxts/jecs";',
					"const gameWorld = world();",
					"gameWorld.remove(entity, Component);",
				].join("\n"),
				documentation: { id: "pass", title: "direct Jecs component removal" },
			},
			"if (world.has(entity, Component)) world.remove(entity, Component);",
			'import { world as makeWorld } from "other-package";\nconst gameWorld = makeWorld();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity, Component)) { log(entity); gameWorld.remove(entity, Component); }',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component); else recover();',
			'import { world } from "@rbxts/jecs";\nconst a = world();\nconst b = world();\nif (a.has(entity, Component)) b.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.contains(entity)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity, Component)) gameWorld.delete(entity);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (condition) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld["has"](entity, Component)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity, Component)) { debugger; }',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(...args)) gameWorld.remove(...args);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(...entities, Component)) gameWorld.remove(...entities, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = world();\nif (gameWorld.has(entity, ComponentA)) gameWorld.remove(entity, ComponentB);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = {};\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst gameWorld = getWorld();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nif (world().has(entity, Component)) world().remove(entity, Component);',
			'import { world } from "@rbxts/jecs";\nconst factory = world;\nconst gameWorld = factory();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
			'import * as jecs from "@rbxts/jecs";\nconst namespace = jecs;\nconst gameWorld = namespace.world();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
			'import * as jecs from "@rbxts/jecs";\nconst gameWorld = getJecs().world();\nif (gameWorld.has(entity, Component)) gameWorld.remove(entity, Component);',
		],
	});
});
