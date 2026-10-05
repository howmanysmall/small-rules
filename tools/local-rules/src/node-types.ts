import { CHILD_KEYS } from "yuku-ast";

export const NODE_TYPES: ReadonlyArray<string> = Object.keys(CHILD_KEYS);

export function isNodeTypeName(value: string): boolean {
	return Object.hasOwn(CHILD_KEYS, value);
}
