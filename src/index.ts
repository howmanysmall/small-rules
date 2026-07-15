import arrayTypeGeneric from "$oxc-rules/array-type-generic";
import banInstances from "$oxc-rules/ban-instances";
import banReactFc from "$oxc-rules/ban-react-fc";
import banTypes from "$oxc-rules/ban-types";
import directiveDisableEnablePair from "$oxc-rules/directive-disable-enable-pair";
import directiveNoAggregatingEnable from "$oxc-rules/directive-no-aggregating-enable";
import directiveNoDuplicateDisable from "$oxc-rules/directive-no-duplicate-disable";
import directiveNoRestrictedDisable from "$oxc-rules/directive-no-restricted-disable";
import directiveNoUnlimitedDisable from "$oxc-rules/directive-no-unlimited-disable";
import directiveNoUnusedEnable from "$oxc-rules/directive-no-unused-enable";
import directiveNoUse from "$oxc-rules/directive-no-use";
import directiveRequireDescription from "$oxc-rules/directive-require-description";
import enforceIanitorCheckType from "$oxc-rules/enforce-ianitor-check-type";
import memoizedEffectDependencies from "$oxc-rules/memoized-effect-dependencies";
import noArrayConstructorElements from "$oxc-rules/no-array-constructor-elements";
import noArrayConstructorIndexAssignment from "$oxc-rules/no-array-constructor-index-assignment";
import noArraySizeAssignment from "$oxc-rules/no-array-size-assignment";
import noAsyncConstructor from "$oxc-rules/no-async-constructor";
import noAsyncInSystem from "$oxc-rules/no-async-in-system";
import noCascadingSetState from "$oxc-rules/no-cascading-set-state";
import noColor3Constructor from "$oxc-rules/no-color3-constructor";
import noCommentedCode from "$oxc-rules/no-commented-code";
import noConstantConditionWithBreak from "$oxc-rules/no-constant-condition-with-break";
import noError from "$oxc-rules/no-error";
import noEventsInEventsCallback from "$oxc-rules/no-events-in-events-callback";
import noGiantComponent from "$oxc-rules/no-giant-component";
import noGodComponents from "$oxc-rules/no-god-components";
import noIanitorInFunctionBody from "$oxc-rules/no-ianitor-in-function-body";
import noIanitorSuccessAccess from "$oxc-rules/no-ianitor-success-access";
import noIdentityMap from "$oxc-rules/no-identity-map";
import noIncrementDecrement from "$oxc-rules/no-increment-decrement";
import noInlinePropertyOnMemoComponent from "$oxc-rules/no-inline-property-on-memo-component";
import noInstanceMethodsWithoutThis from "$oxc-rules/no-instance-methods-without-this";
import noNativePropertiesSpread from "$oxc-rules/no-native-properties-spread";
import noNewInstanceInUseMemo from "$oxc-rules/no-new-instance-in-use-memo";
import noPrint from "$oxc-rules/no-print";
import noRecursive from "$oxc-rules/no-recursive";
import noRedundantAspectRatioConstraint from "$oxc-rules/no-redundant-aspect-ratio-constraint";
import noRenderHelperFunctions from "$oxc-rules/no-render-helper-functions";
import noRestrictedPropertyAssignment from "$oxc-rules/no-restricted-property-assignment";
import noSpecFileExtension from "$oxc-rules/no-spec-file-extension";
import noStaticReactCreateElement from "$oxc-rules/no-static-react-create-element";
import noTableCreateMap from "$oxc-rules/no-table-create-map";
import noTaskWait from "$oxc-rules/no-task-wait";
import noUnderscoreReactProperties from "$oxc-rules/no-underscore-react-properties";
import noUnusedImports from "$oxc-rules/no-unused-imports";
import noUnusedUseMemo from "$oxc-rules/no-unused-use-memo";
import noUseMemoSimpleExpression from "$oxc-rules/no-use-memo-simple-expression";
import noUselessConstants from "$oxc-rules/no-useless-constants";
import noUselessDefault from "$oxc-rules/no-useless-default";
import noUselessUseEffect from "$oxc-rules/no-useless-use-effect";
import noUselessUseMemo from "$oxc-rules/no-useless-use-memo";
import noUselessUseSpring from "$oxc-rules/no-useless-use-spring";
import noWarn from "$oxc-rules/no-warn";
import onlyTypeImports from "$oxc-rules/only-type-imports";
import preferClassProperties from "$oxc-rules/prefer-class-properties";
import preferConstantDispatch from "$oxc-rules/prefer-constant-dispatch";
import preferContextStack from "$oxc-rules/prefer-context-stack";
import preferEarlyReturn from "$oxc-rules/prefer-early-return";
import preferExpectAssertions from "$oxc-rules/prefer-expect-assertions";
import preferHoistedJsxElements from "$oxc-rules/prefer-hoisted-jsx-elements";
import preferHoistedJsxObjectProperties from "$oxc-rules/prefer-hoisted-jsx-object-properties";
import preferIdiv from "$oxc-rules/prefer-idiv";
import preferLocalPortalComponent from "$oxc-rules/prefer-local-portal-component";
import preferMathMinMax from "$oxc-rules/prefer-math-min-max";
import preferModdingInspect from "$oxc-rules/prefer-modding-inspect";
import preferModuleScopeConstants from "$oxc-rules/prefer-module-scope-constants";
import preferPaddingComponents from "$oxc-rules/prefer-padding-components";
import preferPascalCaseEnums from "$oxc-rules/prefer-pascal-case-enums";
import preferSequenceOverloads from "$oxc-rules/prefer-sequence-overloads";
import preferSingleWorldQuery from "$oxc-rules/prefer-single-world-query";
import preferSingularEnums from "$oxc-rules/prefer-singular-enums";
import preferTernaryConditionalRendering from "$oxc-rules/prefer-ternary-conditional-rendering";
import preferUDim2Shorthand from "$oxc-rules/prefer-udim2-shorthand";
import preferUseReducer from "$oxc-rules/prefer-use-reducer";
import preventAbbreviations from "$oxc-rules/prevent-abbreviations";
import reactHooksStrictReturn from "$oxc-rules/react-hooks-strict-return";
import requireAsyncSuffix from "$oxc-rules/require-async-suffix";
import requireModuleLevelInstantiation from "$oxc-rules/require-module-level-instantiation";
import requireNamedEffectFunctions from "$oxc-rules/require-named-effect-functions";
import requirePairedCalls from "$oxc-rules/require-paired-calls";
import requireReactComponentKeys from "$oxc-rules/require-react-component-keys";
import requireReactDisplayNames from "$oxc-rules/require-react-display-names";
import requireSwitchCaseBraces from "$oxc-rules/require-switch-case-braces";
import requireThrowErrorCapture from "$oxc-rules/require-throw-error-capture";
import requireUnicodeRegex from "$oxc-rules/require-unicode-regex";
import rerenderMemoWithDefaultValue from "$oxc-rules/rerender-memo-with-default-value";
import strictComponentBoundaries from "$oxc-rules/strict-component-boundaries";
import useExhaustiveDependencies from "$oxc-rules/use-exhaustive-dependencies";
import useHookAtTopLevel from "$oxc-rules/use-hook-at-top-level";
import { definePlugin } from "oxlint-plugin-utilities";

const smallRules = definePlugin({
	meta: { name: "small-rules" },
	rules: {
		"array-type-generic": arrayTypeGeneric,
		"ban-instances": banInstances,
		"ban-react-fc": banReactFc,
		"ban-types": banTypes,
		"directive-disable-enable-pair": directiveDisableEnablePair,
		"directive-no-aggregating-enable": directiveNoAggregatingEnable,
		"directive-no-duplicate-disable": directiveNoDuplicateDisable,
		"directive-no-restricted-disable": directiveNoRestrictedDisable,
		"directive-no-unlimited-disable": directiveNoUnlimitedDisable,
		"directive-no-unused-enable": directiveNoUnusedEnable,
		"directive-no-use": directiveNoUse,
		"directive-require-description": directiveRequireDescription,
		"enforce-ianitor-check-type": enforceIanitorCheckType,
		"memoized-effect-dependencies": memoizedEffectDependencies,
		"no-array-constructor-elements": noArrayConstructorElements,
		"no-array-constructor-index-assignment": noArrayConstructorIndexAssignment,
		"no-array-size-assignment": noArraySizeAssignment,
		"no-async-constructor": noAsyncConstructor,
		"no-async-in-system": noAsyncInSystem,
		"no-cascading-set-state": noCascadingSetState,
		"no-color3-constructor": noColor3Constructor,
		"no-commented-code": noCommentedCode,
		"no-constant-condition-with-break": noConstantConditionWithBreak,
		"no-error": noError,
		"no-events-in-events-callback": noEventsInEventsCallback,
		"no-giant-component": noGiantComponent,
		"no-god-components": noGodComponents,
		"no-ianitor-in-function-body": noIanitorInFunctionBody,
		"no-ianitor-success-access": noIanitorSuccessAccess,
		"no-identity-map": noIdentityMap,
		"no-increment-decrement": noIncrementDecrement,
		"no-inline-property-on-memo-component": noInlinePropertyOnMemoComponent,
		"no-instance-methods-without-this": noInstanceMethodsWithoutThis,
		"no-native-properties-spread": noNativePropertiesSpread,
		"no-new-instance-in-use-memo": noNewInstanceInUseMemo,
		"no-print": noPrint,
		"no-recursive": noRecursive,
		"no-redundant-aspect-ratio-constraint": noRedundantAspectRatioConstraint,
		"no-render-helper-functions": noRenderHelperFunctions,
		"no-restricted-property-assignment": noRestrictedPropertyAssignment,
		"no-spec-file-extension": noSpecFileExtension,
		"no-static-react-create-element": noStaticReactCreateElement,
		"no-table-create-map": noTableCreateMap,
		"no-task-wait": noTaskWait,
		"no-underscore-react-props": noUnderscoreReactProperties,
		"no-unused-imports": noUnusedImports,
		"no-unused-use-memo": noUnusedUseMemo,
		"no-use-memo-simple-expression": noUseMemoSimpleExpression,
		"no-useless-constants": noUselessConstants,
		"no-useless-default": noUselessDefault,
		"no-useless-use-effect": noUselessUseEffect,
		"no-useless-use-memo": noUselessUseMemo,
		"no-useless-use-spring": noUselessUseSpring,
		"no-warn": noWarn,
		"only-type-imports": onlyTypeImports,
		"prefer-class-properties": preferClassProperties,
		"prefer-constant-dispatch": preferConstantDispatch,
		"prefer-context-stack": preferContextStack,
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
