import { fileURLToPath } from "node:url";
import { getOxlintAsync } from "@howmanysmall/lint-configurations/get-oxlint-async";

const tsconfigPath = fileURLToPath(new URL("tsconfig.json", import.meta.url));
const configuration = await getOxlintAsync({
	rootDirectory: import.meta.dirname,
	tsconfigPath,
});

export default configuration;
