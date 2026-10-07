import { env } from "node:process";

const DEFAULT_PROPERTY_RUNS = 100;

/**
 * Runs per property test. Pull requests use the fixed default so they stay
 * fast; the scheduled deep-tests workflow raises it through `PROPERTY_RUNS`.
 */
// biome-ignore lint/style/noProcessEnv: the deep-tests workflow sets the run count.
export const PROPERTY_RUNS = parsePropertyRuns(env.PROPERTY_RUNS);

function parsePropertyRuns(value: string | undefined): number {
	const runs = Number(value);
	return Number.isInteger(runs) && runs > 0 ? runs : DEFAULT_PROPERTY_RUNS;
}
