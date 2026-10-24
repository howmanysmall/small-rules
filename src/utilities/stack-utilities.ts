/**
 * Replaces the top entry of a stack with a copy that has `updates` merged in.
 *
 * @template TEntry - Stack entry type.
 * @param stack - Stack whose last entry is the top.
 * @param updates - Fields to overwrite on the top entry.
 */
export function mergeIntoStackTop<TEntry extends object>(stack: Array<TEntry>, updates: Partial<TEntry>): void {
	const top = stack.at(-1);
	if (top !== undefined) {
		stack[stack.length - 1] = { ...top, ...updates };
	}
}
