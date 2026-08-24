import { definePlugin } from "oxlint-plugin-utilities";

import noChainedTypeAssertions from "$oxc-rules/anti-slop/no-chained-type-assertions";
import noConditionalEmptyObjectSpread from "$oxc-rules/anti-slop/no-conditional-empty-object-spread";
import noKnownValueWidening from "$oxc-rules/anti-slop/no-known-value-widening";
import noModuleMocking from "$oxc-rules/anti-slop/no-module-mocking";
import noObjectParameters from "$oxc-rules/anti-slop/no-object-parameters";
import noReflectApply from "$oxc-rules/anti-slop/no-reflect-apply";
import noReflectGet from "$oxc-rules/anti-slop/no-reflect-get";
import noRuntimeTypeof from "$oxc-rules/anti-slop/no-runtime-typeof";
import noStructuralTermInSymbolNames from "$oxc-rules/anti-slop/no-shape-in-symbol-names";
import noUnknownParameters from "$oxc-rules/anti-slop/no-unknown-parameters";
import noUnknownReturns from "$oxc-rules/anti-slop/no-unknown-returns";
import noUnknownTypeAliases from "$oxc-rules/anti-slop/no-unknown-type-aliases";
import noUnsafeDictionaryType from "$oxc-rules/anti-slop/no-unsafe-dictionary-type";
import noWidenThenAssert from "$oxc-rules/anti-slop/no-widen-then-assert";
import requireSafetyCommentForTypeAssertion from "$oxc-rules/anti-slop/require-safety-comment-for-type-assertion";
import directiveDisableEnablePair from "$oxc-rules/general/directive-disable-enable-pair";
import directiveNoAggregatingEnable from "$oxc-rules/general/directive-no-aggregating-enable";
import directiveNoDuplicateDisable from "$oxc-rules/general/directive-no-duplicate-disable";
import directiveNoRestrictedDisable from "$oxc-rules/general/directive-no-restricted-disable";
import directiveNoUnlimitedDisable from "$oxc-rules/general/directive-no-unlimited-disable";
import directiveNoUnusedEnable from "$oxc-rules/general/directive-no-unused-enable";
import directiveNoUse from "$oxc-rules/general/directive-no-use";
import directiveRequireDescription from "$oxc-rules/general/directive-require-description";
import isolatedFunctions from "$oxc-rules/general/isolated-functions";
import noAsyncConstructor from "$oxc-rules/general/no-async-constructor";
import noCommentedCode from "$oxc-rules/general/no-commented-code";
import noConstantConditionWithBreak from "$oxc-rules/general/no-constant-condition-with-break";
import noDeadStore from "$oxc-rules/general/no-dead-store";
import noError from "$oxc-rules/general/no-error";
import noFilterMapChain from "$oxc-rules/general/no-filter-map-chain";
import noFloatingPointEquality from "$oxc-rules/general/no-floating-point-equality";
import noIdentityMap from "$oxc-rules/general/no-identity-map";
import noIncrementDecrement from "$oxc-rules/general/no-increment-decrement";
import noLoopIterableMutation from "$oxc-rules/general/no-loop-iterable-mutation";
import noRecursive from "$oxc-rules/general/no-recursive";
import noRestrictedPropertyAssignment from "$oxc-rules/general/no-restricted-property-assignment";
import noTrivialAssertions from "$oxc-rules/general/no-trivial-assertions";
import noUnusedImports from "$oxc-rules/general/no-unused-imports";
import noUseOfEmptyReturnValue from "$oxc-rules/general/no-use-of-empty-return-value";
import noUselessConstants from "$oxc-rules/general/no-useless-constants";
import noVariadicSpread from "$oxc-rules/general/no-variadic-spread";
import onlyTypeImports from "$oxc-rules/general/only-type-imports";
import preferClassProperties from "$oxc-rules/general/prefer-class-properties";
import preferEarlyReturn from "$oxc-rules/general/prefer-early-return";
import preferExpectAssertions from "$oxc-rules/general/prefer-expect-assertions";
import preferModuleScopeConstants from "$oxc-rules/general/prefer-module-scope-constants";
import requirePairedCalls from "$oxc-rules/general/require-paired-calls";
import requireSwitchCaseBraces from "$oxc-rules/general/require-switch-case-braces";
import requireThrowErrorCapture from "$oxc-rules/general/require-throw-error-capture";
import requireUnicodeRegex from "$oxc-rules/general/require-unicode-regex";
import arrayTypeGeneric from "$oxc-rules/naming/array-type-generic";
import banTypes from "$oxc-rules/naming/ban-types";
import consistentCompoundWords from "$oxc-rules/naming/consistent-compound-words";
import noSpecFileExtension from "$oxc-rules/naming/no-spec-file-extension";
import preferPascalCaseEnums from "$oxc-rules/naming/prefer-pascal-case-enums";
import preferSingularEnums from "$oxc-rules/naming/prefer-singular-enums";
import preventAbbreviations from "$oxc-rules/naming/prevent-abbreviations";
import requireAsyncSuffix from "$oxc-rules/naming/require-async-suffix";
import banReactFc from "$oxc-rules/react/ban-react-fc";
import memoizedEffectDependencies from "$oxc-rules/react/memoized-effect-dependencies";
import noAdjustStateOnPropChange from "$oxc-rules/react/no-adjust-state-on-prop-change";
import noCascadingSetState from "$oxc-rules/react/no-cascading-set-state";
import noChainStateUpdates from "$oxc-rules/react/no-chain-state-updates";
import noDerivedState from "$oxc-rules/react/no-derived-state";
import noEventHandler from "$oxc-rules/react/no-event-handler";
import noExternalStoreSubscription from "$oxc-rules/react/no-external-store-subscription";
import noGiantComponent from "$oxc-rules/react/no-giant-component";
import noGodComponents from "$oxc-rules/react/no-god-components";
import noInitializeState from "$oxc-rules/react/no-initialize-state";
import noInlinePropertyOnMemoComponent from "$oxc-rules/react/no-inline-property-on-memo-component";
import noNewInstanceInUseMemo from "$oxc-rules/react/no-new-instance-in-use-memo";
import noPassDataToParent from "$oxc-rules/react/no-pass-data-to-parent";
import noPassLiveStateToParent from "$oxc-rules/react/no-pass-live-state-to-parent";
import noRenderHelperFunctions from "$oxc-rules/react/no-render-helper-functions";
import noResetAllStateOnPropChange from "$oxc-rules/react/no-reset-all-state-on-property-change";
import noStaticReactCreateElement from "$oxc-rules/react/no-static-react-create-element";
import noUnderscoreReactProperties from "$oxc-rules/react/no-underscore-react-properties";
import noUnusedUseMemo from "$oxc-rules/react/no-unused-use-memo";
import noUseMemoSimpleExpression from "$oxc-rules/react/no-use-memo-simple-expression";
import noUselessUseEffect from "$oxc-rules/react/no-useless-use-effect";
import noUselessUseMemo from "$oxc-rules/react/no-useless-use-memo";
import noUselessUseSpring from "$oxc-rules/react/no-useless-use-spring";
import preferConstantDispatch from "$oxc-rules/react/prefer-constant-dispatch";
import preferContextStack from "$oxc-rules/react/prefer-context-stack";
import preferDirectHookImports from "$oxc-rules/react/prefer-direct-hook-imports";
import preferHoistedJsxElements from "$oxc-rules/react/prefer-hoisted-jsx-elements";
import preferHoistedJsxObjectProperties from "$oxc-rules/react/prefer-hoisted-jsx-object-properties";
import preferLocalPortalComponent from "$oxc-rules/react/prefer-local-portal-component";
import preferPaddingComponents from "$oxc-rules/react/prefer-padding-components";
import preferTernaryConditionalRendering from "$oxc-rules/react/prefer-ternary-conditional-rendering";
import preferUseReducer from "$oxc-rules/react/prefer-use-reducer";
import reactHooksStrictReturn from "$oxc-rules/react/react-hooks-strict-return";
import requireNamedEffectFunctions from "$oxc-rules/react/require-named-effect-functions";
import requireReactComponentKeys from "$oxc-rules/react/require-react-component-keys";
import requireReactDisplayNames from "$oxc-rules/react/require-react-display-names";
import rerenderMemoWithDefaultValue from "$oxc-rules/react/rerender-memo-with-default-value";
import strictComponentBoundaries from "$oxc-rules/react/strict-component-boundaries";
import useExhaustiveDependencies from "$oxc-rules/react/use-exhaustive-dependencies";
import useHookAtTopLevel from "$oxc-rules/react/use-hook-at-top-level";
import banInstances from "$oxc-rules/roblox/ban-instances";
import enforceIanitorCheckType from "$oxc-rules/roblox/enforce-ianitor-check-type";
import noArrayConstructorElements from "$oxc-rules/roblox/no-array-constructor-elements";
import noArrayConstructorIndexAssignment from "$oxc-rules/roblox/no-array-constructor-index-assignment";
import noArraySizeAssignment from "$oxc-rules/roblox/no-array-size-assignment";
import noAsyncInSystem from "$oxc-rules/roblox/no-async-in-system";
import noColor3Constructor from "$oxc-rules/roblox/no-color3-constructor";
import noEventsInEventsCallback from "$oxc-rules/roblox/no-events-in-events-callback";
import noIanitorInFunctionBody from "$oxc-rules/roblox/no-ianitor-in-function-body";
import noIanitorSuccessAccess from "$oxc-rules/roblox/no-ianitor-success-access";
import noInstanceMethodsWithoutThis from "$oxc-rules/roblox/no-instance-methods-without-this";
import noNativePropertiesSpread from "$oxc-rules/roblox/no-native-properties-spread";
import noPrint from "$oxc-rules/roblox/no-print";
import noRedundantAspectRatioConstraint from "$oxc-rules/roblox/no-redundant-aspect-ratio-constraint";
import noTableCreateMap from "$oxc-rules/roblox/no-table-create-map";
import noTaskWait from "$oxc-rules/roblox/no-task-wait";
import noUselessDefault from "$oxc-rules/roblox/no-useless-default";
import noWarn from "$oxc-rules/roblox/no-warn";
import preferIdiv from "$oxc-rules/roblox/prefer-idiv";
import preferMathMinMax from "$oxc-rules/roblox/prefer-math-min-max";
import preferModdingInspect from "$oxc-rules/roblox/prefer-modding-inspect";
import preferSequenceOverloads from "$oxc-rules/roblox/prefer-sequence-overloads";
import preferSingleWorldQuery from "$oxc-rules/roblox/prefer-single-world-query";
import preferUDim2Shorthand from "$oxc-rules/roblox/prefer-udim2-shorthand";
import requireModuleLevelInstantiation from "$oxc-rules/roblox/require-module-level-instantiation";

const smallRules = definePlugin({
	meta: { name: "small-rules" },
	rules: {
		"array-type-generic": arrayTypeGeneric,
		"ban-instances": banInstances,
		"ban-react-fc": banReactFc,
		"ban-types": banTypes,
		"consistent-compound-words": consistentCompoundWords,
		"directive-disable-enable-pair": directiveDisableEnablePair,
		"directive-no-aggregating-enable": directiveNoAggregatingEnable,
		"directive-no-duplicate-disable": directiveNoDuplicateDisable,
		"directive-no-restricted-disable": directiveNoRestrictedDisable,
		"directive-no-unlimited-disable": directiveNoUnlimitedDisable,
		"directive-no-unused-enable": directiveNoUnusedEnable,
		"directive-no-use": directiveNoUse,
		"directive-require-description": directiveRequireDescription,
		"enforce-ianitor-check-type": enforceIanitorCheckType,
		"isolated-functions": isolatedFunctions,
		"memoized-effect-dependencies": memoizedEffectDependencies,
		"no-adjust-state-on-prop-change": noAdjustStateOnPropChange,
		"no-array-constructor-elements": noArrayConstructorElements,
		"no-array-constructor-index-assignment": noArrayConstructorIndexAssignment,
		"no-array-size-assignment": noArraySizeAssignment,
		"no-async-constructor": noAsyncConstructor,
		"no-async-in-system": noAsyncInSystem,
		"no-cascading-set-state": noCascadingSetState,
		"no-chain-state-updates": noChainStateUpdates,
		"no-chained-type-assertions": noChainedTypeAssertions,
		"no-color3-constructor": noColor3Constructor,
		"no-commented-code": noCommentedCode,
		"no-conditional-empty-object-spread": noConditionalEmptyObjectSpread,
		"no-constant-condition-with-break": noConstantConditionWithBreak,
		"no-dead-store": noDeadStore,
		"no-derived-state": noDerivedState,
		"no-error": noError,
		"no-event-handler": noEventHandler,
		"no-events-in-events-callback": noEventsInEventsCallback,
		"no-external-store-subscription": noExternalStoreSubscription,
		"no-filter-map-chain": noFilterMapChain,
		"no-floating-point-equality": noFloatingPointEquality,
		"no-giant-component": noGiantComponent,
		"no-god-components": noGodComponents,
		"no-ianitor-in-function-body": noIanitorInFunctionBody,
		"no-ianitor-success-access": noIanitorSuccessAccess,
		"no-identity-map": noIdentityMap,
		"no-increment-decrement": noIncrementDecrement,
		"no-initialize-state": noInitializeState,
		"no-inline-property-on-memo-component": noInlinePropertyOnMemoComponent,
		"no-instance-methods-without-this": noInstanceMethodsWithoutThis,
		"no-known-value-widening": noKnownValueWidening,
		"no-loop-iterable-mutation": noLoopIterableMutation,
		"no-module-mocking": noModuleMocking,
		"no-native-properties-spread": noNativePropertiesSpread,
		"no-new-instance-in-use-memo": noNewInstanceInUseMemo,
		"no-object-parameters": noObjectParameters,
		"no-pass-data-to-parent": noPassDataToParent,
		"no-pass-live-state-to-parent": noPassLiveStateToParent,
		"no-print": noPrint,
		"no-recursive": noRecursive,
		"no-redundant-aspect-ratio-constraint": noRedundantAspectRatioConstraint,
		"no-reflect-apply": noReflectApply,
		"no-reflect-get": noReflectGet,
		"no-render-helper-functions": noRenderHelperFunctions,
		"no-reset-all-state-on-prop-change": noResetAllStateOnPropChange,
		"no-restricted-property-assignment": noRestrictedPropertyAssignment,
		"no-runtime-typeof": noRuntimeTypeof,
		"no-shape-in-symbol-names": noStructuralTermInSymbolNames,
		"no-spec-file-extension": noSpecFileExtension,
		"no-static-react-create-element": noStaticReactCreateElement,
		"no-table-create-map": noTableCreateMap,
		"no-task-wait": noTaskWait,
		"no-trivial-assertions": noTrivialAssertions,
		"no-underscore-react-props": noUnderscoreReactProperties,
		"no-unknown-parameters": noUnknownParameters,
		"no-unknown-returns": noUnknownReturns,
		"no-unknown-type-aliases": noUnknownTypeAliases,
		"no-unsafe-dictionary-type": noUnsafeDictionaryType,
		"no-unused-imports": noUnusedImports,
		"no-unused-use-memo": noUnusedUseMemo,
		"no-use-memo-simple-expression": noUseMemoSimpleExpression,
		"no-use-of-empty-return-value": noUseOfEmptyReturnValue,
		"no-useless-constants": noUselessConstants,
		"no-useless-default": noUselessDefault,
		"no-useless-use-effect": noUselessUseEffect,
		"no-useless-use-memo": noUselessUseMemo,
		"no-useless-use-spring": noUselessUseSpring,
		"no-variadic-spread": noVariadicSpread,
		"no-warn": noWarn,
		"no-widen-then-assert": noWidenThenAssert,
		"only-type-imports": onlyTypeImports,
		"prefer-class-properties": preferClassProperties,
		"prefer-constant-dispatch": preferConstantDispatch,
		"prefer-context-stack": preferContextStack,
		"prefer-direct-hook-imports": preferDirectHookImports,
		"prefer-early-return": preferEarlyReturn,
		"prefer-expect-assertions": preferExpectAssertions,
		"prefer-hoisted-jsx-elements": preferHoistedJsxElements,
		"prefer-hoisted-jsx-object-properties": preferHoistedJsxObjectProperties,
		"prefer-idiv": preferIdiv,
		"prefer-local-portal-component": preferLocalPortalComponent,
		"prefer-math-min-max": preferMathMinMax,
		"prefer-modding-inspect": preferModdingInspect,
		"prefer-module-scope-constants": preferModuleScopeConstants,
		"prefer-padding-components": preferPaddingComponents,
		"prefer-pascal-case-enums": preferPascalCaseEnums,
		"prefer-sequence-overloads": preferSequenceOverloads,
		"prefer-single-world-query": preferSingleWorldQuery,
		"prefer-singular-enums": preferSingularEnums,
		"prefer-ternary-conditional-rendering": preferTernaryConditionalRendering,
		"prefer-udim2-shorthand": preferUDim2Shorthand,
		"prefer-use-reducer": preferUseReducer,
		"prevent-abbreviations": preventAbbreviations,
		"react-hooks-strict-return": reactHooksStrictReturn,
		"require-async-suffix": requireAsyncSuffix,
		"require-module-level-instantiation": requireModuleLevelInstantiation,
		"require-named-effect-functions": requireNamedEffectFunctions,
		"require-paired-calls": requirePairedCalls,
		"require-react-component-keys": requireReactComponentKeys,
		"require-react-display-names": requireReactDisplayNames,
		"require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertion,
		"require-switch-case-braces": requireSwitchCaseBraces,
		"require-throw-error-capture": requireThrowErrorCapture,
		"require-unicode-regex": requireUnicodeRegex,
		"rerender-memo-with-default-value": rerenderMemoWithDefaultValue,
		"strict-component-boundaries": strictComponentBoundaries,
		"use-exhaustive-dependencies": useExhaustiveDependencies,
		"use-hook-at-top-level": useHookAtTopLevel,
	},
});

export default smallRules;
