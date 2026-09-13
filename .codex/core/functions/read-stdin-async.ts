import { stdin } from "node:process";

export async function readStdinAsync(): Promise<string> {
	stdin.setEncoding("utf8");
	let input = "";
	for await (const chunk of stdin) input += chunk;
	return input;
}
