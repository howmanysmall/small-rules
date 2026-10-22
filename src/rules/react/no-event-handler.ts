import { createReactEffectRule } from "$oxc-utilities/react-effect-rule";

const noEventHandler = createReactEffectRule("no-event-handler", {
	checkEffect(context, analysis, effect): void {
		for (const ifStatement of analysis.scope.getDescendantIfStatements(effect.functionNode)) {
			if (ifStatement.alternate !== null) continue;

			for (const ifTestReference of analysis.scope.getDownstreamReferences(ifStatement.test)) {
				const upstreamReferences = analysis.scope.getUpstreamReferences(ifTestReference);
				const { name } = ifTestReference.identifier;

				if (upstreamReferences.some((reference) => analysis.isState(reference))) {
					context.report({
						data: { name },
						messageId: "avoidEventHandler",
						node: ifTestReference.identifier,
					});
				}

				if (upstreamReferences.some((reference) => analysis.isProp(reference))) {
					context.report({
						data: { name },
						messageId: "avoidPropHandler",
						node: ifTestReference.identifier,
					});
				}
			}
		}
	},
	description: "Disallow using state and an effect as an event handler.",
	messages: {
		avoidEventHandler:
			'Avoid using state and effects as an event handler. Instead, call the code that uses "{{name}}" directly when the event occurs.',
		avoidPropHandler:
			'Avoid using props and effects as an event handler. Instead, move the code that uses "{{name}}" to the parent component.',
	},
	skipEffectsWithCleanup: true,
});

export default noEventHandler;
