interface AutofixOption {
	readonly allowAutofix?: boolean;
}

/**
 * Whether a rule's options object opts in to autofix.
 *
 * @param autofixOption - The rule's first option.
 * @returns True only when `allowAutofix` is set to true.
 */
export function isAutofixAllowed(autofixOption?: AutofixOption): boolean {
	return autofixOption?.allowAutofix === true;
}
