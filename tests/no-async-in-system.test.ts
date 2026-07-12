import { describe } from "vitest";
import rule from "$oxc-rules/no-async-in-system";

import { ts } from "./rule-testers";

describe("no-async-in-system", () => {
	ts.run("no-async-in-system", rule, {
		invalid: [
			{
				code: `function namespacedSystem(): Planck.SystemReturn {
					service.commitAsync();
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `function characterSystem(): SystemReturn {
					return () => {
						CharacterUtilities.loadCharacterAsync(player);
					};
				}`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const characterSystem: PlanckSystem = () => {
					loadCharacterAsync();
					service["saveAsync"]();
					service?.flushAsync?.();
				};`,
				errors: [
					{ messageId: "noAsyncInSystem" },
					{ messageId: "noAsyncInSystem" },
					{ messageId: "noAsyncInSystem" },
				],
			},
			{
				code: `function collectUpdates() {
					world.forEach(() => offerRejoinAsync(player));
					async function offerRejoinAsync() {
						await loadCharacterAsync();
					}
				}
				export = { name: "collect", system: collectUpdates } satisfies System<Context>;`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `export const descriptor: SystemTableLike = {
					system: function run() {
						queue(() => saveAsync());
					},
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const descriptor: System = {
					["system"]: () => publishAsync(),
				};`,
				errors: [{ messageId: "noAsyncInSystem" }],
			},
			{
				code: `const customSystem: CustomSystem = () => syncAsync();`,
				errors: [{ messageId: "noAsyncInSystem" }],
				options: [{ additionalSystemTypeNames: ["CustomSystem"] }],
			},
		],
		valid: [
			`declare function declaredSystem(): SystemReturn;`,
			`function helper() { loadCharacterAsync(); }`,
			`function typedHelper(): void { loadCharacterAsync(); }`,
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
