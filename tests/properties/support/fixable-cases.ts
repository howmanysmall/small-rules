import { GENERAL_FIXABLE_CASES } from "./fixable-cases-general";
import { REACT_FIXABLE_CASES } from "./fixable-cases-react";
import { ROBLOX_FIXABLE_CASES } from "./fixable-cases-roblox";

import type { FixableCase } from "./fixable-case";

export const FIXABLE_CASES: ReadonlyArray<FixableCase> = [
	...GENERAL_FIXABLE_CASES,
	...REACT_FIXABLE_CASES,
	...ROBLOX_FIXABLE_CASES,
];
