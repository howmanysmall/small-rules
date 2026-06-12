import { describe } from "vitest";
import rule from "$oxc-rules/no-events-in-events-callback";

import { ts } from "./rule-testers";

const options = [{ eventsImportPaths: ["server/networking"] }];

describe("no-events-in-events-callback", () => {
	// @ts-expect-error - RuleTester doesn't support the new format of rules
	ts.run("no-events-in-events-callback", rule, {
		invalid: [
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player, unitKey: string): void => {
    if (unitKey.size() > 0) {
        Events.promptNotification.fire(player, "error");
    }
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const samePlayer = player;
    Events.promptNotification.fire(samePlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const payload = { player };
    const [targetPlayer] = [payload.player];
    Events.promptNotification.fire(targetPlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const payload = { player };
    const { player: targetPlayer } = payload;
    Events.promptNotification.fire(targetPlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    let target: Player | undefined;
    target = player;
    Events.promptNotification.fire(target, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events as ServerEvents } from "server/networking";

ServerEvents.units.unequipUnit.connect((player: Player): void => {
    ServerEvents.promptNotification(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import Events from "server/networking";

Events.units.unequipUnit.connect(({ player }: { readonly player: Player }): void => {
    Events.promptNotification.fire(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { "Events" as ServerEvents } from "server/networking";

ServerEvents.units.unequipUnit.connect((player: Player): void => {
    const payload = condition ? { player } : { player };
    ServerEvents.promptNotification.fire(payload.player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const payload = { ...{ player } };
    const targetPlayer = (first, payload).player;
    Events.promptNotification.fire(targetPlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect(([player = fallbackPlayer]: ReadonlyArray<Player>): void => {
    Events.promptNotification.fire(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

(Events.units.unequipUnit.connect as Connect)((player: Player): void => {
    (Events.promptNotification.fire as Fire)(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    let targetPlayer: Player | undefined;
    ({ targetPlayer } = { targetPlayer: player });
    Events.promptNotification.fire(targetPlayer, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
		],
		valid: [
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
    Events.promptNotification.fire(otherPlayer, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "shared/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    Events.promptNotification.fire(player, "error");
});
`,
				options,
			},
			{
				code: `
import { Events, Functions } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    Functions.units.unequipUnit(player);
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const targetPlayer = getTargetPlayer(player);
    Events.promptNotification.fire(targetPlayer, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.promptNotification.fire(player, "error");
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    task.spawn(() => {
        Events.promptNotification.fire(player, "error");
    });
});
`,
				options,
			},
			{
				code: `
import Networking from "server/networking";

Networking.units.unequipUnit.connect((player: Player): void => {
    Networking.promptNotification.fire(player, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    const payload = condition ? { player } : {};
    Events.promptNotification.fire(payload.player, "error");
});
`,
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect((player: Player): void => {
    Events.promptNotification.fire(player, "error");
});
`,
			},
		],
	});
});
