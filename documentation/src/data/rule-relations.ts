/**
 * Hand-curated semantic relationships between small-rules.
 *
 * This is intentionally sparse. Same-category adjacency is not a relation. Only real problem-family, complementarity,
 * overlap, or conceptual dependency edges belong here. The previous docs "Related Rules" sections were category
 * neighbor spam and should be driven from this map instead.
 *
 * Rule ids match plugin keys in `src/index.ts` / `rule-sidebar.ts`.
 */

export type RuleRelationKind =
	/** Same problem family or complementary checks. Default bidirectional. */
	| "related"
	/** A makes B more useful, or A is a stricter multi-metric companion of B. Directed. */
	| "strengthens"
	/** Different approaches to a similar concern; usually not both required. Directed or bi. */
	| "alternative"
	/** Can flag similar code; boundary is worth documenting. Default bidirectional. */
	| "overlaps"
	/** Understanding/using A assumes the practice B enforces. Directed. */
	| "depends-on-concept"
	/** Enabling A largely replaces B for the covered surface. Directed. */
	| "supersedes";

export interface RuleRelation {
	readonly from: string;
	readonly kind: RuleRelationKind;
	readonly reason: string;
	readonly to: string;
}

/**
 * Undirected kinds are stored once (lexicographically smaller `from` preferred when both directions are equivalent).
 * Directed kinds use explicit `from` → `to`.
 */
export const ruleRelations = [
	// ---------------------------------------------------------------------------
	// Directive comment family
	// ---------------------------------------------------------------------------
	{
		from: "directive-disable-enable-pair",
		kind: "related",
		reason: "Paired disable/enable blocks are the lifecycle counterpart of unused enable cleanup.",
		to: "directive-no-unused-enable",
	},
	{
		from: "directive-disable-enable-pair",
		kind: "related",
		reason: "Both police block-scoped disable/enable directive shape rather than line directives.",
		to: "directive-no-aggregating-enable",
	},
	{
		from: "directive-no-duplicate-disable",
		kind: "related",
		reason: "Duplicate disables and unlimited disables are adjacent directive hygiene checks.",
		to: "directive-no-unlimited-disable",
	},
	{
		from: "directive-no-restricted-disable",
		kind: "related",
		reason: "Restricted-rule disables and description-required disables both constrain when suppressions are allowed.",
		to: "directive-require-description",
	},
	{
		from: "directive-no-unlimited-disable",
		kind: "related",
		reason: "Blanket disables and undescribed disables are the two broadest suppression-quality failures.",
		to: "directive-require-description",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "Banning block directives entirely removes the surface the other directive-* rules refine.",
		to: "directive-disable-enable-pair",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, aggregating enable checks never apply.",
		to: "directive-no-aggregating-enable",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, duplicate-disable checks never apply.",
		to: "directive-no-duplicate-disable",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, restricted-disable policy is moot for blocks.",
		to: "directive-no-restricted-disable",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, unlimited-disable checks never apply.",
		to: "directive-no-unlimited-disable",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, unused-enable cleanup never applies.",
		to: "directive-no-unused-enable",
	},
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "If block directives are forbidden, description requirements never apply to them.",
		to: "directive-require-description",
	},

	// ---------------------------------------------------------------------------
	// Imports, constants, enums, errors
	// ---------------------------------------------------------------------------
	{
		from: "no-useless-constants",
		kind: "related",
		reason: "One inlines single-use constants; the other places SCREAMING_SNAKE constants at module scope.",
		to: "prefer-module-scope-constants",
	},
	{
		from: "prefer-pascal-case-enums",
		kind: "related",
		reason: "Both enforce enum identifier conventions (casing and grammatical number).",
		to: "prefer-singular-enums",
	},
	{
		from: "no-error",
		kind: "related",
		reason: "Both push error handling toward throw-based control flow instead of free global failure helpers.",
		to: "require-throw-error-capture",
	},
	{
		from: "no-print",
		kind: "related",
		reason: "Same banned-global factory: raw print/warn output should become structured Log calls.",
		to: "no-warn",
	},

	// ---------------------------------------------------------------------------
	// React: state / reducer / effects
	// ---------------------------------------------------------------------------
	{
		from: "no-cascading-set-state",
		kind: "related",
		reason: "Cascading setState in effects is the runtime symptom prefer-use-reducer is meant to prevent.",
		to: "prefer-use-reducer",
	},
	{
		from: "prefer-constant-dispatch",
		kind: "depends-on-concept",
		reason: "Constant action objects only matter once related state is modeled with useReducer.",
		to: "prefer-use-reducer",
	},
	{
		from: "no-cascading-set-state",
		kind: "related",
		reason: "Both attack effect bodies that manage state as a sequence of imperative updates.",
		to: "no-useless-use-effect",
	},
	{
		from: "memoized-effect-dependencies",
		kind: "related",
		reason: "One requires deps present/correct; the other requires unstable deps be memoized.",
		to: "use-exhaustive-dependencies",
	},
	{
		from: "memoized-effect-dependencies",
		kind: "related",
		reason: "Unstable effect deps and effect anti-patterns are complementary effect-quality checks.",
		to: "no-useless-use-effect",
	},
	{
		from: "no-useless-use-effect",
		kind: "related",
		reason: "Named effect callbacks improve the same effect-debugging surface these anti-patterns pollute.",
		to: "require-named-effect-functions",
	},
	{
		from: "use-exhaustive-dependencies",
		kind: "related",
		reason: "Dependency correctness pairs with requiring readable named effect callbacks.",
		to: "require-named-effect-functions",
	},
	{
		from: "no-useless-use-spring",
		kind: "related",
		reason: "Static spring configs are the spring-specific cousin of useless static memos/effects.",
		to: "no-useless-use-effect",
	},
	{
		from: "no-useless-use-spring",
		kind: "related",
		reason: "Both ban hook wrappers whose values are static enough to leave the hook entirely.",
		to: "no-useless-use-memo",
	},
	{
		from: "react-hooks-strict-return",
		kind: "related",
		reason: "Both enforce hooks-rules-of-hooks style discipline at the component/hook boundary.",
		to: "use-hook-at-top-level",
	},

	// ---------------------------------------------------------------------------
	// React: useMemo / reference stability
	// ---------------------------------------------------------------------------
	{
		from: "no-unused-use-memo",
		kind: "related",
		reason: "Standalone unused memos, trivial memos, and fully-static memos are one wasteful-useMemo family.",
		to: "no-use-memo-simple-expression",
	},
	{
		from: "no-unused-use-memo",
		kind: "related",
		reason: "Unused memos and static-value memos both pay hook cost for no preserved value.",
		to: "no-useless-use-memo",
	},
	{
		from: "no-use-memo-simple-expression",
		kind: "overlaps",
		reason: "Trivial expressions and fully-static expressions can both be flagged as pointless memos.",
		to: "no-useless-use-memo",
	},
	{
		from: "no-new-instance-in-use-memo",
		kind: "related",
		reason: "Memoizing Instance construction is a Roblox-specific useMemo correctness concern.",
		to: "no-useless-use-memo",
	},
	{
		from: "no-inline-property-on-memo-component",
		kind: "related",
		reason: "Inline props and empty default object/array props both defeat memo by identity churn.",
		to: "rerender-memo-with-default-value",
	},
	{
		from: "no-inline-property-on-memo-component",
		kind: "related",
		reason: "Hoisting static JSX object props is the structural fix for inline memo props.",
		to: "prefer-hoisted-jsx-object-properties",
	},
	{
		from: "no-native-properties-spread",
		kind: "related",
		reason: "Both stop per-render table/object copies from invalidating memoized Roblox UI.",
		to: "prefer-hoisted-jsx-object-properties",
	},
	{
		from: "no-native-properties-spread",
		kind: "related",
		reason: "Spreading property bags is a Roblox-specific form of the inline-unstable-props problem.",
		to: "no-inline-property-on-memo-component",
	},
	{
		from: "prefer-hoisted-jsx-elements",
		kind: "related",
		reason: "Whole static elements and static prop objects are the two halves of JSX hoistability.",
		to: "prefer-hoisted-jsx-object-properties",
	},

	// ---------------------------------------------------------------------------
	// React: component shape / architecture
	// ---------------------------------------------------------------------------
	{
		from: "no-giant-component",
		kind: "overlaps",
		reason: "Line-count giants and multi-metric god components both target oversized React components.",
		to: "no-god-components",
	},
	{
		from: "no-god-components",
		kind: "strengthens",
		reason: "God-component scoring includes state-hook pressure that prefer-use-reducer also addresses.",
		to: "prefer-use-reducer",
	},
	{
		from: "ban-react-fc",
		kind: "related",
		reason: "Both protect React debug/profile identity: ban FC types, require displayName on memo/context exports.",
		to: "require-react-display-names",
	},
	{
		from: "no-render-helper-functions",
		kind: "related",
		reason: "Render helpers should become real components; FC annotations are the wrong way to type them.",
		to: "ban-react-fc",
	},
	{
		from: "prefer-context-stack",
		kind: "related",
		reason: "Local wrapper components for nested providers/portals/padding are the same composition move.",
		to: "prefer-local-portal-component",
	},
	{
		from: "prefer-local-portal-component",
		kind: "related",
		reason: "Prefer named local UI wrappers over repeating low-level createPortal/uipadding patterns.",
		to: "prefer-padding-components",
	},
	{
		from: "prefer-context-stack",
		kind: "related",
		reason: "Context stacks and padding wrappers both collapse repeated JSX boilerplate into local components.",
		to: "prefer-padding-components",
	},
	{
		from: "no-static-react-create-element",
		kind: "related",
		reason: "Static createElement should be JSX; static JSX trees should then be hoisted when fully constant.",
		to: "prefer-hoisted-jsx-elements",
	},

	// ---------------------------------------------------------------------------
	// Roblox: Ianitor / construction / arrays / yielding / UI
	// ---------------------------------------------------------------------------
	{
		from: "enforce-ianitor-check-type",
		kind: "related",
		reason: "Ianitor type annotations, hoist-to-module creation, and success-only access form one validator family.",
		to: "no-ianitor-in-function-body",
	},
	{
		from: "enforce-ianitor-check-type",
		kind: "related",
		reason: "Annotated Check<T> validators and success-only result access are complementary Ianitor API hygiene.",
		to: "no-ianitor-success-access",
	},
	{
		from: "no-ianitor-in-function-body",
		kind: "related",
		reason: "Both prevent recreating expensive Ianitor validator machinery on hot paths.",
		to: "no-ianitor-success-access",
	},
	{
		from: "no-ianitor-in-function-body",
		kind: "related",
		reason: "Both require expensive configured constructions to live at module scope.",
		to: "require-module-level-instantiation",
	},
	{
		from: "no-array-constructor-elements",
		kind: "related",
		reason: "Element-form constructors and index-assignment fill patterns are adjacent Array construction smells.",
		to: "no-array-constructor-index-assignment",
	},
	{
		from: "no-array-constructor-elements",
		kind: "related",
		reason: "Constructor initialization and size/length append assignment are both roblox-ts array construction style.",
		to: "no-array-size-assignment",
	},
	{
		from: "no-array-constructor-index-assignment",
		kind: "related",
		reason: "Index fills and size/length appends are two non-push ways to build arrays that should collapse to literals/push.",
		to: "no-array-size-assignment",
	},
	{
		from: "no-array-constructor-elements",
		kind: "related",
		reason: "Both discourage constructor-based array setup before map/transform work in roblox-ts.",
		to: "no-table-create-map",
	},
	{
		from: "no-async-in-system",
		kind: "related",
		reason: "Both ban yielding/wait-style control flow where synchronous execution is required.",
		to: "no-task-wait",
	},
	{
		from: "no-useless-default",
		kind: "related",
		reason: "Redundant default props and UDim2 constructor shorthands are Roblox UI prop-hygiene checks.",
		to: "prefer-udim2-shorthand",
	},
	{
		from: "no-useless-default",
		kind: "related",
		reason: "Default-prop noise and redundant aspect-ratio constraints both strip useless Roblox UI declarations.",
		to: "no-redundant-aspect-ratio-constraint",
	},
	{
		from: "prefer-padding-components",
		kind: "related",
		reason: "Padding component preference and redundant aspect-ratio constraints both simplify Roblox UI layout markup.",
		to: "no-redundant-aspect-ratio-constraint",
	},
	{
		from: "prefer-idiv",
		kind: "related",
		reason: "Both rewrite simple math patterns to clearer/faster Luau builtins (idiv vs min/max).",
		to: "prefer-math-min-max",
	},
] as const satisfies ReadonlyArray<RuleRelation>;

const UNDIRECTED_KINDS = new Set<RuleRelationKind>(["related", "overlaps", "alternative"]);

export function getRelatedRules(ruleName: string): ReadonlyArray<RuleRelation> {
	return ruleRelations.filter((edge) => edge.from === ruleName || edge.to === ruleName);
}

export function getRelatedRuleNames(ruleName: string): ReadonlyArray<string> {
	const names = new Set<string>();
	for (const edge of getRelatedRules(ruleName)) {
		if (edge.from === ruleName) names.add(edge.to);
		if (edge.to === ruleName && UNDIRECTED_KINDS.has(edge.kind)) names.add(edge.from);
		if (edge.to === ruleName && !UNDIRECTED_KINDS.has(edge.kind)) {
			// Directed reverse: still expose the counterpart for docs navigation.
			names.add(edge.from);
		}
	}
	return [...names].toSorted((left, right) => left.localeCompare(right));
}
