import { describe } from "vitest";
import rule from "$oxc-rules/no-async-in-system";

import { ts } from "./rule-testers";

describe("no-async-in-system", () => {
	ts.run("no-async-in-system", rule, {
		invalid: [
			{
				code: `const Players = game.GetService("Players");
				function socialSystem(): Planck.SystemReturn {
					Players.GetFriendsAsync(player.UserId);
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const UserService = game.GetService("UserService");
				const userSystem: PlanckSystem = () => {
					UserService.GetUserInfosByUserIdsAsync(userIds);
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const DataStoreService = game.GetService("DataStoreService");
				const store = DataStoreService.GetDataStore("Profiles");
				const pages = store.ListVersionsAsync("profile");
				const dataSystem: SystemFunction = () => {
					store["GetAsync"]("profile");
					pages?.AdvanceToNextPageAsync?.();
				};`,
				errors: [{ messageId: "noAsyncInSystem" }, { messageId: "noAsyncInSystem" }],
			},
			{
				code: `const Players = game.GetService("Players");
				function collectUpdates() {
					world.forEach(() => Players.GetFriendsAsync(player.UserId));
					async function loadFriendsAsync() {
						await Players.GetFriendsAsync(player.UserId);
					}
				}
				export = { name: "collect", system: collectUpdates } satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const Players = game.GetService("Players");
				export const descriptor: SystemTableLike = {
					system: function run() {
						queue(() => Players.GetFriendsAsync(player.UserId));
					},
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const UserService = game.GetService("UserService");
				const users = UserService;
				const descriptor: System = {
					["system"]: () => users.GetUserInfosByUserIdsAsync(userIds),
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const customSystem: CustomSystem = () => players.GetFriendsAsync(player.UserId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: [{ additionalRobloxRootNames: ["players"], additionalSystemTypeNames: ["CustomSystem"] }],
			},
			{
				code: `const system: SystemFunction = () => game.GetService("Players").GetFriendsAsync(userId);`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
		],
		valid: [
			`declare function declaredSystem(): SystemReturn;`,
			`function helper() { loadCharacterAsync(); }`,
			`function typedHelper(): void { loadCharacterAsync(); }`,
			`const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`const external = library.Players;
				const system: SystemFunction = () => external.GetFriendsAsync(userId);`,
			`namespace Players {
					export function GetFriendsAsync(): Promise<void> {
						return Promise.resolve();
					}
				}
				const system: SystemFunction = () => Players.GetFriendsAsync();`,
			`import * as Players from "external-library";
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`const game = externalGame;
				const Players = game.GetService("Players");
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`let Players = game.GetService("Players");
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			`declare const Players: ExternalPlayers;
				const system: SystemFunction = () => Players.GetFriendsAsync(userId);`,
			{
				code: `const system: SystemFunction = () => players.GetFriendsAsync(userId);`,
				options: [{ additionalRobloxRootNames: [] }],
			},
			`function namespacedSystem(): Planck.SystemReturn {
					service.commitAsync();
					CharacterUtilities.loadCharacterAsync(player);
					loadCharacterAsync();
					service["saveAsync"]();
					service?.flushAsync?.();
				}`,
			`function characterSystem(): SystemReturn {
				return async () => {
					await loadCharacterAsync();
				};
			}`,
			`const characterSystem: SystemFunction = async () => {
				await CharacterUtilities.loadCharacterAsync(player);
			};`,
			`const descriptor = {
				system() {
					loadCharacterAsync();
				},
			};`,
			`function helper() { loadCharacterAsync(); }
			const descriptor = { system: () => {} } satisfies System<Context>;`,
			`const descriptor = {
				...base,
				[key]: () => loadCharacterAsync(),
				"other": loadCharacterAsync,
				system: missingSystem,
			} satisfies System<Context>;`,
			`const descriptor = { system: createSystem() } satisfies System<Context>;`,
			`const system: System = createSystem();`,
			`declare const system: System;`,
			`const system: SystemFunction = () => {
				(callback as () => void)();
				service[method]();
			};`,
			`function customSystem(): CustomSystemResult {
				return () => loadCharacterAsync();
			}`,
		],
	});
});
