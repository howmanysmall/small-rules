import { describe } from "vitest";
import rule from "$oxc-rules/no-events-in-events-callback";

import { ts } from "./rule-testers";

const options = [{ eventsImportPaths: ["server/networking"] }];

describe("no-events-in-events-callback", () => {
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
				documentation: { id: "fail", title: "event fired inside callback" },
				errors: [{ messageId: "preferFunctions" }],
				options: [{ eventsImportPaths: ["server/networking"] }],
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
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    let targetPlayer: Player | undefined;
	    [targetPlayer = fallbackPlayer] = [player];
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
	    const targetPlayer = condition ? player : player;
	    Events.promptNotification.fire(targetPlayer, "error");
	});
	`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect?.((player: Player): void => {
	    Events.promptNotification.fire?.(player, "error");
	});
	`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect(([, player]: readonly [Player, Player]): void => {
	    Events.promptNotification.fire(player, "error");
	});
	`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    const [targetPlayer, ...remainingPlayers] = [player];
	    Events.promptNotification.fire(targetPlayer, "error", remainingPlayers);
	});
	`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    let alias: Player | undefined;
	    const targetPlayer = alias = player;
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
	    const payload = [...[player]];
	    Events.promptNotification.fire(payload[0], "error");
	});
	`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    let targetPlayer = player;
	    targetPlayer = player;
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
	    let targetPayload: { readonly player: Player } | undefined;
	    targetPayload = payload;
	    Events.promptNotification.fire(targetPayload.player, "error");
	});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events.units.unequipUnit.connect(function(player: Player): void {
    Events.promptNotification.fire(player, "error");
});
`,
				errors: [{ messageId: "preferFunctions" }],
				options,
			},
			{
				code: `
import { Events } from "server/networking";

Events?.units.unequipUnit.connect((player: Player): void => {
    Events?.promptNotification.fire(player, "error");
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
				documentation: { id: "pass", title: "event callback without configured import" },
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect();
	Events.units.unequipUnit.connect(onUnequipUnit);
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	    let targetPlayer = otherPlayer;
	    targetPlayer = otherPlayer;
	    Events.promptNotification.fire(targetPlayer, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    const target = {};
	    target.player = player;
	    Events.promptNotification.fire(target.player, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	    const payload = [otherPlayer];
	    Events.promptNotification.fire(payload[0], "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    getEvents().promptNotification.fire(player, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    Events.promptNotification.fire(...[player, "error"]);
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	    player ||= fallbackPlayer;
	    Events.promptNotification.fire(otherPlayer, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((): void => {
	    Events.promptNotification.fire(player, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events, Functions, createRemotes } from "server/networking";
	import * as Networking from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    Functions.units.unequipUnit(player);
	    Networking.Events.promptNotification.fire(player, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    const payload = (player, otherPlayer);
	    Events.promptNotification.fire(payload, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    const payload = { otherPlayer };
	    Events.promptNotification.fire(payload.otherPlayer, "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	    const payload = [, otherPlayer];
	    Events.promptNotification.fire(payload[1], "error");
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player, otherPlayer: Player): void => {
	    const { ...targetPlayer } = { player };
	    Events.promptNotification.fire(otherPlayer, "error", targetPlayer);
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    function notifyPlayer(): void {
	        Events.promptNotification.fire(player, "error");
	    }

	    notifyPlayer();
	});
	`,
				options,
			},
			{
				code: `
	import { Events } from "server/networking";

	Events.units.unequipUnit.connect((player: Player): void => {
	    const target = player;
	    Events.promptNotification.fire(target, "error");
	});
	`,
				options: [{ eventsImportPaths: ["shared/networking"] }],
			},
		],
	});
});
