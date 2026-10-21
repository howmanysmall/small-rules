import {
	describeEffectOwner,
	getReportableEffectCall,
	isSynchronousStateCall,
} from "$oxc-utilities/react-effect-utilities";

import type { ESTree, Reference } from "oxlint-plugin-utilities";

import type { EffectOwnerDisplay, ReactEffect, ReactEffectAnalysis } from "$oxc-utilities/react-effect-utilities";

export interface StateSetterCall {
	readonly callExpression: ESTree.CallExpression;
	readonly stateName: string;
}

export type ArgumentReferencesPredicate = (
	analysis: ReactEffectAnalysis,
	argumentReferences: ReadonlyArray<Reference>,
) => boolean;

export interface ParentCallbackCall {
	readonly callExpression: ESTree.CallExpression;
	/** The passed references, formatted as `"a" and "b"`. */
	readonly names: string;
	readonly owner: EffectOwnerDisplay;
}

export type PassedReferencesGetter = (analysis: ReactEffectAnalysis, reference: Reference) => ReadonlyArray<Reference>;

/**
 * Resolves a state-setter reference to its call expression and the name of
 * the state it updates, or `undefined` when either cannot be resolved.
 *
 * @param analysis - The effect analysis for the current file.
 * @param reference - A reference that calls a state setter.
 * @returns The call site and state name.
 */
export function getStateSetterCall(analysis: ReactEffectAnalysis, reference: Reference): StateSetterCall | undefined {
	const callExpression = analysis.scope.getCallExpression(reference);
	if (callExpression === undefined) return undefined;

	const stateName = analysis.getStateName(reference);
	if (stateName === undefined) return undefined;

	return { callExpression, stateName };
}

/**
 * Collects the state-setter calls made synchronously inside an effect body
 * whose argument upstream references pass `isReportable`.
 *
 * @param analysis - The effect analysis for the current file.
 * @param effect - The effect to inspect.
 * @param isReportable - Decides from a call's argument upstream references
 *   whether to keep it.
 * @returns The reportable state-setter calls, in source order.
 */
export function getSynchronousStateSetterCalls(
	analysis: ReactEffectAnalysis,
	effect: ReactEffect,
	isReportable: ArgumentReferencesPredicate,
): ReadonlyArray<StateSetterCall> {
	const calls = new Array<StateSetterCall>();
	let size = 0;
	for (const reference of effect.functionReferences) {
		if (!isSynchronousStateCall(analysis, effect, reference)) continue;

		const stateSetterCall = getStateSetterCall(analysis, reference);
		if (stateSetterCall === undefined) continue;

		if (isReportable(analysis, analysis.scope.getArgumentUpstreamReferences(reference))) {
			calls[size++] = stateSetterCall;
		}
	}

	return calls;
}

/**
 * Collects the prop-callback calls inside an effect body that pass at least
 * one reference back up to the parent.
 *
 * @param analysis - The effect analysis for the current file.
 * @param effect - The effect to inspect.
 * @param getPassedReferences - Picks the reportable references a call passes.
 * @returns The reportable calls, in source order.
 */
export function getParentCallbackCalls(
	analysis: ReactEffectAnalysis,
	effect: ReactEffect,
	getPassedReferences: PassedReferencesGetter,
): ReadonlyArray<ParentCallbackCall> {
	const calls = new Array<ParentCallbackCall>();
	let size = 0;
	let owner: EffectOwnerDisplay | undefined;
	for (const reference of effect.functionReferences) {
		const callExpression = getReportableEffectCall(analysis, effect, reference, analysis.isPropCall);
		if (callExpression === undefined) continue;

		const passedReferences = getPassedReferences(analysis, reference);
		if (passedReferences.length === 0) continue;

		owner ??= describeEffectOwner(analysis, effect);
		calls[size++] = { callExpression, names: joinQuotedReferenceNames(passedReferences), owner };
	}

	return calls;
}

/**
 * Formats reference names for a report message, as `"a" and "b"`.
 *
 * @param references - The references to name.
 * @returns The quoted names joined with `and`.
 */
export function joinQuotedReferenceNames(references: ReadonlyArray<Reference>): string {
	return references.map((reference) => `"${reference.identifier.name}"`).join(" and ");
}
