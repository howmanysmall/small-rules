All notable changes to `@pobammer-ts/small-rules` are documented here.

## Unreleased

## [2.12.0] - 2026-07-31

## Fixed

- **no-dead-store**: Stop false positives for compound assignments and values read across loop iterations in [#32](https://github.com/howmanysmall/small-rules/pull/32).
- **no-instance-methods-without-this**: Ignore TypeScript overload signatures and abstract methods without bodies in [#33](https://github.com/howmanysmall/small-rules/pull/33).
- **require-async-suffix**: Ignore overridden async methods and class fields whose names follow a base-class contract in [#35](https://github.com/howmanysmall/small-rules/pull/35).

## [2.11.0] - 2026-07-29

## Fixed

- **no-render-helper-functions**: Report JSX-returning named function expressions returned from another function, while continuing to ignore PascalCase components and hooks - by @howmanysmall in [#31](https://github.com/howmanysmall/small-rules/pull/31)
- **prevent-abbreviations**: Resolve the imported root of nested member and TypeScript qualified-name chains, so imported namespaces such as `MenuPrimitive.Root.Props` are not reported as abbreviations - by @howmanysmall in [#31](https://github.com/howmanysmall/small-rules/pull/31)

## [2.10.0] - 2026-07-28

## Fixed

- **prefer-context-stack**, **prefer-local-portal-component**, and **prefer-padding-components** no longer report the native provider, portal, or padding implementation inside the corresponding component definition files ([#27](https://github.com/howmanysmall/small-rules/pull/27)).
- **no-render-helper-functions** allows render helpers passed directly as JSX attribute values, while continuing to report the same helpers used as JSX children ([#27](https://github.com/howmanysmall/small-rules/pull/27)).

## [2.9.0] - 2026-07-27

## Added

- Add eight rules covering dead stores, floating-point equality, variadic spreads, compound-word spelling, isolated callbacks, loop-iterable mutation, trivial assertions, and void return values in [#24](https://github.com/howmanysmall/small-rules/pull/24) and [#25](https://github.com/howmanysmall/small-rules/pull/25).

## [2.8.0] - 2026-07-26

## Added
- **no-filter-map-chain** and **prefer-direct-hook-imports** are now available, with the React hook rule recommended - [#23](https://github.com/howmanysmall/small-rules/pull/23)

## Fixed
- **no-async-in-system**, **no-render-helper-functions**, **prevent-abbreviations**, and **require-async-suffix** now handle returned callbacks, external props, and constrained object properties correctly - [#19](https://github.com/howmanysmall/small-rules/pull/19), [#23](https://github.com/howmanysmall/small-rules/pull/23)

## [2.7.0] - 2026-07-13

No user-facing changes to lint rules, diagnostics, options, or supported syntax.

## [2.6.0] - 2026-07-13

## Changed
- **no-async-in-system**: Detect yielding Roblox APIs using class-aware service, instance, and typed-receiver analysis, while ignoring unrelated `Async`-named calls. [#17](https://github.com/howmanysmall/small-rules/pull/17) [67aef25](https://github.com/howmanysmall/small-rules/commit/67aef25)

## [2.5.2] - 2026-07-12

No user-facing changes.

## [2.5.1] - 2026-07-12

No user-facing changes.

## [2.5.0] - 2026-07-12

## Added

- Add `no-async-in-system` to report `Async`-suffixed calls inside synchronous Planck systems, with configurable `additionalSystemTypeNames` support ([#14](https://github.com/howmanysmall/small-rules/pull/14)).

## [2.4.1] - 2026-07-07

## Fixed

- **no-restricted-property-assignment**: Make `allowFiles` globs match absolute filenames through their paths relative to the working directory, while retaining basename matching - [#13](https://github.com/howmanysmall/small-rules/pull/13)

## [2.4.0] - 2026-07-07

## Added

- **no-restricted-property-assignment**: Support glob patterns for restricted object names and property names, including patterns such as `_G*` and `__*__` ([#12](https://github.com/howmanysmall/small-rules/pull/12)).

## [2.3.0] - 2026-06-30

## Added

- **no-restricted-property-assignment**: Add the `allowFiles` glob option for exempting matching files from restricted property assignment and update diagnostics in [#11](https://github.com/howmanysmall/small-rules/pull/11).

## [2.2.1] - 2026-06-30

No user-facing changes in this release.

## [2.2.0] - 2026-06-30

## Added

- **no-restricted-property-assignment**: Add configurable diagnostics for writes and updates to restricted properties, with glob patterns, computed-property control, custom messages, and file allowlists ([#10](https://github.com/howmanysmall/small-rules/pull/10)).

## Fixed

- **require-throw-error-capture**: Stop treating object-literal property keys as variable names when checking anonymous functions ([#9](https://github.com/howmanysmall/small-rules/pull/9)).

## [2.1.0] - 2026-06-23

## 🚀 Added
- **no-array-constructor-index-assignment**: Flag contiguous `new Array<T>()` index initialization and offer an array-literal autofix - by @howmanysmall [<samp>(17ad2)</samp>](https://github.com/howmanysmall/small-rules/commit/17ad2aa)
- **no-recursive**: Report direct and mutual recursion, including async, generator, arrow-function, and class-method calls - by @howmanysmall [<samp>(db9bf)</samp>](https://github.com/howmanysmall/small-rules/commit/db9bf7f)

## 🐞 Fixed
- **prevent-abbreviations**: Stop checking member and qualified type names rooted at imported bindings - by @howmanysmall [<samp>(071c7)</samp>](https://github.com/howmanysmall/small-rules/commit/071c7e3)
- **require-throw-error-capture**: Avoid autofix variable collisions with catch parameters - by @howmanysmall in [#7](https://github.com/howmanysmall/small-rules/pull/7)

## 🔧 Changed
- **no-commented-code**: Add `maxLines` to allow short commented-out code blocks - by @howmanysmall in [#6](https://github.com/howmanysmall/small-rules/pull/6)
- **no-array-size-assignment**: Add `environment: "standard"` support for `array[array.length] = value` while retaining `roblox-ts` as the default - by @howmanysmall [<samp>(8f243)</samp>](https://github.com/howmanysmall/small-rules/commit/8f24343)
- **require-async-suffix**: Add an `except` allowlist and skip externally constrained object methods - by @howmanysmall in [#7](https://github.com/howmanysmall/small-rules/pull/7)
- **require-throw-error-capture**: Support class-method stack capture and replace `from: "lib"` with `from: "library"`; add `path` filtering for file-based allowlist entries - by @howmanysmall in [#7](https://github.com/howmanysmall/small-rules/pull/7)

## [2.0.0] - 2026-06-16

## ⚠️ Breaking Changes
- Remove `prefer-expect-assertions-count`; use `prefer-expect-assertions` instead [#5](https://github.com/howmanysmall/small-rules/pull/5)

## 🔧 Changed
- `prefer-expect-assertions` now supports `additionalAssertionFunctions` and fixes deterministic `expect.hasAssertions()` calls to `expect.assertions(n)` [#5](https://github.com/howmanysmall/small-rules/pull/5)
- Expand the TypeScript peer dependency from version 6 to `>=5 <8` [900a2](https://github.com/howmanysmall/small-rules/commit/900a20f835e8adf230fbd8bc360320a2f3f0c9fd)

## [1.1.0] - 2026-06-15

## 🚀 Added
- Add 14 user-facing rules covering isolated callbacks, recursion, loop mutations, trivial assertions, empty return values, array construction, async system calls, dead stores, floating-point equality, variadic spreads, restricted assignments, filter/map chains, compound-word spelling, and direct React hook imports. [83eab77](https://github.com/howmanysmall/small-rules/commit/83eab77) [390c6ba](https://github.com/howmanysmall/small-rules/commit/390c6ba) [4cfe8fe](https://github.com/howmanysmall/small-rules/commit/4cfe8fe) [78a4e7f](https://github.com/howmanysmall/small-rules/commit/78a4e7f) [18cbefe](https://github.com/howmanysmall/small-rules/commit/18cbefe)

## 🐞 Fixed
- Correct stable object-property handling in `use-exhaustive-dependencies`, root type scoring in `enforce-ianitor-check-type`, circular static-expression detection, and Oxlint line-directive descriptions. [70e3f84](https://github.com/howmanysmall/small-rules/commit/70e3f84) [2e2f901](https://github.com/howmanysmall/small-rules/commit/2e2f901) [e74342f](https://github.com/howmanysmall/small-rules/commit/e74342f) [3cf8f16](https://github.com/howmanysmall/small-rules/commit/3cf8f16)
- Remove false positives in `no-dead-store`, `no-instance-methods-without-this`, `require-async-suffix`, and `prefer-pascal-case-enums`. [abc6c55](https://github.com/howmanysmall/small-rules/commit/abc6c55) [c2a8102](https://github.com/howmanysmall/small-rules/commit/c2a8102) [6b6a26b](https://github.com/howmanysmall/small-rules/commit/6b6a26b) [ecd7bd9](https://github.com/howmanysmall/small-rules/commit/ecd7bd9)

## 🔧 Changed
- Add configurable allowlists and file-aware matching to `require-throw-error-capture`, plus safer fixes for class methods and catch parameters. [af46db8](https://github.com/howmanysmall/small-rules/commit/af46db8) [5c154dc](https://github.com/howmanysmall/small-rules/commit/5c154dc) [a823f58](https://github.com/howmanysmall/small-rules/commit/a823f58)
- Add `maxLines` to `no-commented-code`, `except` to `require-async-suffix`, and assertion-function counting and deterministic fixes to `prefer-expect-assertions`. [2ffd6d0](https://github.com/howmanysmall/small-rules/commit/2ffd6d0) [9ae3bfb](https://github.com/howmanysmall/small-rules/commit/9ae3bfb) [ff6d751](https://github.com/howmanysmall/small-rules/commit/ff6d751)

## 🗑️ Removed
- Remove `prefer-expect-assertions-count`; configure `prefer-expect-assertions` instead. [ff6d751](https://github.com/howmanysmall/small-rules/commit/ff6d751)
