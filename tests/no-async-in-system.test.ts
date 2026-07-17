import { describe } from "vitest";
import rule from "$oxc-rules/no-async-in-system";

import { ts } from "./rule-testers";

const inferredPlayerOptions = [
	{
		callbackParameterTypes: [
			{
				callbackArgumentIndex: 0,
				className: "Player",
				imported: "Events",
				memberPath: ["general", "friendUpdated", "connect"],
				parameterIndex: 0,
				source: "server/network",
			},
		],
	},
];

describe("no-async-in-system", () => {
	ts.run("no-async-in-system", rule, {
		invalid: [
			{
				code: `import { Players, UserService } from "@rbxts/services";
				import { Events } from "server/network";
				const friendUpdatesSystem: SystemFunction = () => {
					Players.GetFriendsAsync(userId);
					world.added(PlayerComponent, () => {
						Players.GetFriendsAsync(userId);
					});
					Events.general.friendUpdated.connect((player, otherUserId) => {
						player.IsFriendsWithAsync(otherUserId);
						UserService.GetUserInfosByUserIdsAsync([otherUserId]);
					});
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: inferredPlayerOptions,
			},
			{
				code: `import { Players as RobloxPlayers } from "@rbxts/services";
				const socialSystem: SystemFunction = () => RobloxPlayers.GetFriendsAsync(userId);`,
				documentation: { id: "fail", title: "async service call in system" },
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				function socialSystem(): SystemReturn {
					initialize();
					return () => Players.GetFriendsAsync(userId);
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				function socialSystem(): SystemReturn {
					const update = () => Players.GetFriendsAsync(userId);
					return update;
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const socialSystem: SystemFunction = () => () => Players.GetFriendsAsync(userId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const system: SystemFunction = () => {
					world.added(PlayerComponent, () => Players.GetFriendsAsync(userId));
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [1], calleePath: ["world", "added"] }],
					},
				],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const callback = () => Players.GetFriendsAsync(userId);
				const system: SystemFunction = () => queue(callback);`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			{
				code: `function socialSystem(): Planck.SystemReturn {
					const player: Player = getPlayer();
					player.IsFriendsWithAsync(otherUserId);
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `function socialSystem(player: Player): SystemReturn {
					player.IsFriendsWithAsync(otherUserId);
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const system: SystemFunction = () => {
					const player: Player | undefined = getPlayer();
					player?.IsFriendsWithAsync(userId);
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const SocialPlayers = Players;
				const system: SystemFunction = () => SocialPlayers.GetFriendsAsync(userId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `function dataSystem(): SystemReturn {
					const store: DataStore = getStore();
					store["GetAsync"]("profile");
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const system: SystemFunction = () => game.GetService("Players").GetFriendsAsync(userId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const descriptor: System<Context> = {
					system: () => Players.GetFriendsAsync(userId),
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const descriptor = {
					["system"]: () => Players.GetFriendsAsync(userId),
				} satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				function run() { Players.GetFriendsAsync(userId); }
				const descriptor = { system: run } satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { Players } from "@rbxts/services";
				const descriptor = {
					"system": () => Players.GetFriendsAsync(userId),
				} satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `import { "Players" as Players } from "@rbxts/services";
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `function collectUpdates() {
					const player: Player = getPlayer();
					queue(() => player.IsFriendsWithAsync(userId));
					queue(async () => player.IsFriendsWithAsync(userId));
				}
				export = { system: collectUpdates } satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
		],
		valid: [
			{
				code: `import { Players } from "@rbxts/services";
			const system: SystemFunction = () => {
				world.added(PlayerComponent, () => Players.GetFriendsAsync(userId));
			};`,
				documentation: { id: "pass", title: "async call in event callback" },
			},
			`import { Players } from "@rbxts/services";
			function system(): SystemReturn {
				Players.GetFriendsAsync(userId);
				return () => updateWorld();
			}`,
			{
				code: `const callback = () => queue(callback);
				const system: SystemFunction = () => queue(callback);`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			`declare function declaredSystem(): SystemReturn;`,
			`function helper() { Players.GetFriendsAsync(userId); }`,
			`import { Players } from "external-library";
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`import Players from "@rbxts/services";
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`namespace Players {
				export function GetFriendsAsync(): Promise<void> {
					return Promise.resolve();
				}
			}
			const system: SystemFunction = () => Players.GetFriendsAsync();`,
			`interface ExternalPlayer { IsFriendsWithAsync(userId: number): Promise<boolean> }
				const system: SystemFunction = () => {
					const player: ExternalPlayer = getPlayer();
					player.IsFriendsWithAsync(userId);
				};`,
			`interface Player { IsFriendsWithAsync(userId: number): Promise<boolean> }
				const system: SystemFunction = () => {
					const player: Player = getPlayer();
					player.IsFriendsWithAsync(userId);
				};`,
			`import type { Player } from "external-library";
				const system: SystemFunction = () => {
					const player: Player = getPlayer();
					player.IsFriendsWithAsync(userId);
				};`,
			`namespace External { export interface Player { IsFriendsWithAsync(userId: number): Promise<boolean> } }
				const system: SystemFunction = () => {
					const player: External.Player = getPlayer();
					player.IsFriendsWithAsync(userId);
				};`,
			`const system: SystemFunction = () => {
				const value: string = "";
				value.IsFriendsWithAsync(userId);
			};`,
			`const system: SystemFunction = () => {
				const value: string | Player = getValue();
				value.IsFriendsWithAsync(userId);
			};`,
			`const system: SystemFunction = () => {
				const value: Player | DataStore = getValue();
				value.GetAsync("key");
			};`,
			`const system: SystemFunction = () => {
				const value: undefined | null = undefined;
				value?.IsFriendsWithAsync(userId);
			};`,
			`const system: SystemFunction = () => {
				const value: UnknownRobloxClass = getValue();
				value.GetAsync("key");
			};`,
			`import { Events } from "server/network";
				const system: SystemFunction = () => {
					Events.general.friendUpdated.connect((player) => player.IsFriendsWithAsync(userId));
				};`,
			{
				code: `import { Events as NetworkEvents } from "server/network";
				const system: SystemFunction = () => {
					NetworkEvents.general.friendUpdated.connect(async (player) => player.IsFriendsWithAsync(userId));
				};`,
				options: inferredPlayerOptions,
			},
			`import { Players } from "@rbxts/services";
				const system: SystemFunction = async () => Players.GetFriendsAsync(userId);`,
			`function namespacedSystem(): Planck.SystemReturn {
				service.commitAsync();
				CharacterUtilities.loadCharacterAsync(player);
				loadCharacterAsync();
			}`,
			`const descriptor = { system: createSystem() } satisfies System<Context>;`,
			`const descriptor = { system: missingSystem } satisfies System<Context>;`,
			`const descriptor = { ...base, system: createSystem() } satisfies System<Context>;`,
			`const descriptor = { 1: createSystem() } satisfies System<Context>;`,
			`const value: SystemFunction = createSystem();`,
			`const key = "system";
				const descriptor = { [key]: () => game.GetService("Players").GetFriendsAsync(userId) } satisfies System<Context>;`,
			`const serviceName = "Players";
				const system: SystemFunction = () => game.GetService(serviceName).GetFriendsAsync(userId);`,
			`const system: SystemFunction = () => game.GetService("Players")[method](userId);`,
			{
				code: `import { Events } from "server/network";
				const system: SystemFunction = () => Events.general.friendUpdated.connect();`,
				options: inferredPlayerOptions,
			},
			{
				code: `import { Events } from "server/network";
				const system: SystemFunction = () => Events.general.friendUpdated.connect(handler);`,
				options: inferredPlayerOptions,
			},
			{
				code: `import { Events } from "server/network";
				const system: SystemFunction = () => Events.general.friendUpdated.connect(({ player }) => player.IsFriendsWithAsync(userId));`,
				options: inferredPlayerOptions,
			},
			`function customSystem(): CustomSystemResult {
				return () => loadCharacterAsync();
			}`,
			// Cover getCalleePath with non-Identifier, non-MemberExpression callee (line 155)
			{
				code: `const system: SystemFunction = () => {
					(function() {})();
				};`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getReferencedFunction: function declaration ref (line 284 true)
			{
				code: `function callback() {}
				const system: SystemFunction = () => queue(callback);`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getReferencedFunction: parameter def is not VariableDeclarator (line 285)
			`function socialSystem(param: () => void): SystemReturn {
				return param;
			}`,
			// Cover getReturnedFunctions: return identifier that doesn't resolve to function (line 366)
			`const result = {};
			function socialSystem(): SystemReturn {
				return result;
			}`,
			// Cover getReferencedFunction: variable with 0 defs (line 281 true branch)
			{
				code: `const system: SystemFunction = () => queue(undefinedVar);`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getReferencedFunction: VariableDeclarator with null init (line 285)
			{
				code: `let callback;
				const system: SystemFunction = () => queue(callback);`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getSynchronousCallbacks: missing argument (line 384)
			{
				code: `const system: SystemFunction = () => {
					queue();
				};`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getSynchronousCallbacks: spread element argument (line 384)
			{
				code: `const system: SystemFunction = () => {
					queue(...[]);
				};`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
			// Cover getSynchronousCallbacks: callback doesn't resolve to function (line 386)
			{
				code: `const notAFunction = 42;
				const system: SystemFunction = () => queue(notAFunction);`,
				options: [
					{
						synchronousCallbacks: [{ callbackArgumentIndexes: [0], calleePath: ["queue"] }],
					},
				],
			},
		],
	});
});
