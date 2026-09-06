import { exit } from "node:process";
import { Command, ValidationError } from "@cliffy/command";

import { ShowHelpError } from "$script-classes/errors/show-help-error";

export interface ExtraOptions {
	readonly showHelpWithoutArguments?: boolean;
}

export function createBaseCommand(name: string, version: string, description: string, options?: ExtraOptions): Command {
	const baseCommand = new Command()
		.error((error, command) => {
			if (error instanceof ShowHelpError) {
				command.showHelp();
				exit(0);
			}

			if (error instanceof ValidationError) {
				command.showHelp();
				console.error(error.message);
				exit(error.exitCode);
			}

			console.error(error);
			exit(1);
		})
		.name(name)
		.version(version)
		.description(description)
		.help({
			colors: true,
			hints: true,
			types: true,
		});

	if (options?.showHelpWithoutArguments === true) {
		baseCommand.action(() => {
			throw new ShowHelpError("No command specified.");
		});
	}

	return baseCommand;
}
