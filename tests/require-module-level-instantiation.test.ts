import { describe } from "vitest";
import rule from "$oxc-rules/require-module-level-instantiation";

import { tsx } from "./rule-testers";

describe("require-module-level-instantiation", () => {
	tsx.run("require-module-level-instantiation", rule, {
		invalid: [
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function useStoryModesState() {
    const log = new Log();
    log.Info("test");
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

const handler = () => {
    const log = new Log();
};`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

class MyClass {
    doThing() {
        const log = new Log();
    }
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import { Logger } from "@company/logging";

function init() {
    const logger = new Logger();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Logger: "@company/logging" } }],
			},

			{
				code: `
import { Logger as Log } from "@company/logging";

function init() {
    const log = new Log();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Logger: "@company/logging" } }],
			},
			{
				code: `
import { "Logger" as Log } from "@company/logging";

function init() {
    const log = new Log();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Logger: "@company/logging" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { Server } from "@rbxts/net";

function setup() {
    const log = new Log();
    const server = new Server();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }, { messageId: "mustBeModuleLevel" }],
				options: [
					{
						classes: {
							Log: "@rbxts/rbxts-sleitnick-log",
							Server: "@rbxts/net",
						},
					},
				],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function outer() {
    function inner() {
        const log = new Log();
    }
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

(function() {
    const log = new Log();
})();`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

items.forEach(() => {
    const log = new Log();
});`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import * as Logging from "@rbxts/rbxts-sleitnick-log";

function init() {
    const log = new Logging.Log();
}`,
				errors: [{ messageId: "mustBeModuleLevel" }],
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
		],
		valid: [
			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

const log = new Log();

function useStoryModesState() {
    log.Info("test");
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import { Logger } from "@company/logging";

const logger = new Logger();

function init() {
    logger.info("initialized");
}`,
				options: [{ classes: { Logger: "@company/logging" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { SomeOther } from "some-package";

function init() {
    const other = new SomeOther();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@other/log-library";

function init() {
    const log = new Log();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function init() {
    const log = new Log();
}`,
				options: [{ classes: {} }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";

function init() {
    const log = new Log();
}`,
			},

			{
				code: `
import { Log } from "@different/package";

function init() {
    const log = new Log();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
			{
				code: `
import * as Logging from "@rbxts/rbxts-sleitnick-log";

function init() {
    const log = new Logging.NotTracked();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},

			{
				code: `
import Log from "@rbxts/rbxts-sleitnick-log";
import { Server } from "@rbxts/net";

const log = new Log();
const server = new Server();

function setup() {
    log.Info("setup");
    server.start();
}`,
				options: [
					{
						classes: {
							Log: "@rbxts/rbxts-sleitnick-log",
							Server: "@rbxts/net",
						},
					},
				],
			},

			{
				code: `
const log = new Log();
`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
				sourceType: "script",
			},
			{
				code: `
import * as Logging from "@rbxts/rbxts-sleitnick-log";

function init() {
    const log = new Logging["Log"]();
}`,
				options: [{ classes: { Log: "@rbxts/rbxts-sleitnick-log" } }],
			},
		],
	});
});
