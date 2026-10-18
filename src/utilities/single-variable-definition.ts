import { getConstInitializer } from "$oxc-utilities/static-expression-utilities";

import type { Definition, ESTree, Variable } from "oxlint-plugin-utilities";

export function getSingleDefinition(variable?: Variable): Definition | undefined {
	if (variable?.defs.length !== 1) return undefined;
	return variable.defs[0];
}

export function getSingleConstInitializer(variable?: Variable): ESTree.Expression | undefined {
	const definition = getSingleDefinition(variable);
	return definition === undefined ? undefined : getConstInitializer(definition);
}
