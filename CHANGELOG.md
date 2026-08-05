All notable changes to `@pobammer-ts/small-rules` are documented here.

## [Unreleased]

### Added

- **prefer-idiv:** Support reciprocal multiplication in prefer-idiv rule
- **require-named-effect-functions:** Add sloptor support

### Build

- **deps:** Bump @biomejs/biome to 2.5.7
- **deps:** Update yuku dependencies to 0.8.3

### Maintenance

- **deps:** Bump pnpm to 11.19.0 and update dependencies

## [v2.12.1] - 2026-08-03

### Fixed

- **prefer-pascal-case-enums:** Skip non-ascii identifiers
- **no-dead-store:** Prevent false positive for post-switch reads
- **no-dead-store:** Handle control-transfer statements in if consequents

### Changed

- **ban-instances:** Improve the code
- **rules:** Extract scope traversal and path merging logic
- Replace named node:path imports with default
- Use default import for node:path
- **no-dead-store:** Remove cast and collapse loop
- **tests:** Use namespaced node:path imports

### Documentation

- **changelog:** Regenerate all release notes

### Continuous Integration

- **release:** Use OpenRouter for communique

### Maintenance

- **tooling:** Exclude CLI scripts from linting and formatting
- **config:** Update LLM system prompt and model settings in communique
- Update local plugin
- Remove oxlint json config
- Rebuild
- Add oxlint configuration file
- **oxlint:** Enable array constructor lint rules

## [v2.12.0] - 2026-07-31

### Added

- **release:** Replace changelogithub with communique for release notes

### Fixed

- **no-dead-store:** Handle compound assignments properly
- **no-dead-store:** Handle reads before writes inside loop steps
- **no-dead-store:** Correctly detect loop-crossing reads for variables
- **no-instance-methods-without-this:** Skip methods without bodies
- **require-async-suffix:** Ignore overridden async members

### Changed

- **vitest:** Remove vite-tsconfig-paths in favor of native support
- **no-dead-store:** Extract observation check logic

### Documentation

- **agents:** Update release workflow documentation with communique

### Build

- **deps:** Add build type to commitlint type-enum configuration
- **workspace:** Add scripts package to monorepo workspace

### Tests

- **no-dead-store:** Use template literals in test case definitions

### Continuous Integration

- **release:** Verify release note generators in workflow

### Maintenance

- **deps:** Update dependencies
- Add communique and git-cliff to toolchain
- **deps:** Update dependencies and add arkenv to catalogs
- **deps:** Update dependencies and configuration rules
- **deps:** Prune unused dependencies and update configuration
- **deps:** Remove unused dependencies from pnpm lockfile
- **changelog:** Add git-cliff and communique configuration files
- **release:** Switch changelog generator to git-cliff
- **changelog:** Update changelog configuration and integration
- **release:** Remove obsolete changelog component
- **release:** Fix trailing newline in changelog footer template

## [v2.11.0] - 2026-07-29

### Added

- **utilities:** Add createRule helper for automated doc urls
- **docs:** Support inline markdown in sidebar titles and page headers
- **scripts:** Commit dupes-viewer html (oops!)
- **opencode:** Add plugin to block npx commands for existing scripts

### Fixed

- **docs:** Remove CNAME file to avoid Worker proxy conflict
- **sidebar:** Update mobile menu footer import path
- **knip:** Add dupes-viewer.ts as entry point
- Resolve root object for nested member and qualified names

### Changed

- **rules:** Migrate rule definitions to createRule utility
- Use InferContextFromRule utility for lint rule contexts
- **rules:** Appease linting
- **utilities:** Combine early return conditions
- **docs:** Extract rule entry lookup logic
- **docs:** Update return type and variable names in getRuleEntry
- **dedupe:** Use Context type for rule context parameter
- **rules:** Consolidate resolved function type definitions
- **no-useless-default:** Kill duplicate type
- **no-useless-default:** Abstract vector component extraction logic
- **rules:** Extract function to shared react-utilities
- **rules:** Simplify promise delay await check in no-task-wait
- **no-render-helper-functions:** Support nested return statements

### Documentation

- Update documentation site URL to custom domain
- **naming:** Format rule titles with inline code and proper casing
- **react:** Format rule titles with proper casing and inline code
- **roblox:** Add code formatting to rule titles
- **rules:** Use inline code formatting in rule titles
- **ban-react-fc:** Add documentation url to rule metadata
- **rules:** Add documentation URLs to rule metadata definitions
- **naming:** Update markdown titles to use proper casing
- **rules:** Update title of no-color3-constructor rule page
- **react:** Remove backticks from require-react-component-keys title
- **readme:** Enhance documentation with badges and cleaner layout
- **documentation:** Wrap rationale slot in section with heading
- **documentation:** Add rationale for no-increment-decrement rule
- **roblox:** Add rationale documentation for no-table-create-map rule
- **roblox:** Add rationale and update title for prefer-math-min-max
- **roblox:** Simplify no-async-in-system rationale
- **rules:** Add rationale for no-recursive lint rule
- **rules:** Expand explanation for no-recursive rule rationale
- **general:** Update rationale for this rule
- **roblox:** Add rationale documentation for ban-instances rule
- **roblox:** Add rationale for no-array-constructor-index-assignment
- Add rationale documentation for no-array-constructor-elements
- **roblox:** Add rationale for no-array-size-assignment rule
- **roblox:** Add rationale documentation for no-color3-constructor rule
- **roblox:** Add rationale for no-events-in-events-callback rule
- Add rationale documentation for no-instance-methods-without-this
- **roblox:** Add rationale for no-native-properties-spread rule
- **rule:** Add rationale for no-redundant-aspect-ratio-constraint
- **roblox:** Add rationale for prefer-sequence-overloads rule
- **roblox:** Add rationale for prefer-modding-inspect rule
- **roblox:** Add custom rationale for no-print rule
- Rewrite documentation prose to be more natural and direct
- **roblox:** Add rationale documentation for no-task-wait rule
- **roblox:** Update rationale for no-task-wait rule documentation
- **roblox:** Add rationale documentation for no-warn rule
- **roblox:** Add rationale and auto-fix details for prefer-idiv rule
- **roblox:** Add rationale for no-useless-default rule
- **roblox:** Add rationale for prefer-single-world-query rule
- **roblox:** Add documentation for prefer-udim2-shorthand rule
- **rule:** Add rationale documentation

### Build

- **deps:** Update development and linting dependencies
- **deps:** Migrate dependencies to explicit pnpm catalogs
- **deps:** Remove @astrojs/language-server from dependencies

### Tests

- **documentation:** Add missing component to boundary tests
- **docs:** Update working directory match count in workflow tests
- **documentation:** Update expected curated rationale rule pages

### Continuous Integration

- **workflows:** Add oxfmt check, docs type checking, and security job
- Specify workflow directory for zizmor scanner
- **workflow:** Disable mise github attestations in ci
- **workflow:** Remove obsolete github attestations configuration

### Style

- **linter:** Relax strictness for sort-imports and typescript checks
- Sort import declarations alphabetically
- **plugin:** Inline single-statement conditional in block-npx-scripts

### Maintenance

- **mise:** Add deploy-docs task to trigger documentation workflow
- **mise:** Remove unused ref argument from deploy-docs task
- **config:** Update token context limits for gpt-5.6 models
- **deps:** Update pnpm-workspace.yaml package extensions
- **config:** Update ignore patterns for codegraph directory
- **config:** Remove opencode-wakatime plugin
- **editor:** Configure astro-language-server in zed settings
- **zed:** Configure biome formatter for astro files
- **deps:** Add @astrojs/check to documentation
- **deps:** Configure astro peer dependencies
- **tooling:** Add duplicates viewer script and mise task
- Update html
- Hate
- **package:** Remove private flag from package configuration
- **repo:** Update documentation homepage url in package.json
- **scripts:** Simplify command execution in dupes-viewer script
- Disable fatal provenance api failures in mise configuration
- **deps:** Add @pnpm/pacquet dependency to pnpm configuration
- **zed:** Remove custom astro-language-server lsp configuration
- **mise:** Add backtickify task for documentation markdown files
- **deps:** Remove @astrojs/language-server from catalog
- **ci:** Run check task twice in ci pipeline
- **config:** Add opencode workspace configuration to knip
- **ci:** Remove duplicate check task from CI workflow
- **hooks:** Update pre-push hook to run check task

## [v2.10.0] - 2026-07-28

### Added

- **docs:** Add JSON syntax highlighting to rule option defaults
- **documentation:** Add syntax highlighting to rule option types

### Fixed

- **rules:** Ignore component definition files in lint rules
- **no-render-helper-functions:** Allow render helpers in jsx attributes

### Performance

- **prevent-abbreviations:** Cache hot-path lookups

### Changed

- **prefer-context-stack:** Simplify early returns and checks

### Style

- **docs:** Replace default themes with custom shiki themes

### Maintenance

- **zed:** Update pkl language server name in settings
- **docs:** Update accent colors and logo to cyan palette

## [v2.9.0] - 2026-07-27

### Added

- **lsps:** Add howmanysmall-lsps plugin and language servers
- **skills:** Add codebase-design, domain-modeling, ubiquitous-language
- **rules:** Add no-dead-store and no-floating-point-equality rules
- **lint:** Add no-variadic-spread rule and fix AST walk recursion
- **rules:** Add rules for compound words, isolated functions, and more

### Changed

- **react-hook-utilities:** Use worklist for AST traversal
- **lint:** Remove variadic spreads from source
- **rules:** Optimize capture lookup to return single match

### Documentation

- Add project context and traversal architecture ADR
- **guidelines:** Add performance guidelines for AST visitors
- Add documentation pages for general and naming rules
- **agents:** Require dynamic docs catalog counts when adding rules

### Tests

- **docs:** Enforce multi-line formatting for documented examples
- **docs:** Update naming category count after new compound-words rule
- **docs:** Derive rule-index category counts from the catalog

### Continuous Integration

- **deps:** Update github actions versions

### Maintenance

- **knip:** Add language-server to ignored dependencies
- **deps:** Update nub version to 0.6.0
- **lsp:** Add LSP server configurations
- Rebuild rules

## [v2.8.0] - 2026-07-26

### Added

- **no-async-in-system:** Detect yielding calls properly
- Replace oxc-parser with yuku-parser 0.6.1
- **opencode:** Add gpt-5.6 model limits
- **docs:** Add package-manager-tabs component and revamp rule examples
- **package-manager-tabs:** Add run command presets
- **hooks:** Add PostToolUse hook to lint changed files
- **hk:** Add betterleaks, sherif, pinact, vale hooks; bump to 1.51.0
- **docs:** Replace rule-options table with interactive React component
- **rule-options-table:** Extract option components into separate files
- **docs:** Replace logo and favicon with new brand assets
- **docs:** Add semantic rule relation data
- **docs:** Establish documentation data contracts
- **docs:** Derive rule facts and examples from source
- **docs:** Add generated rule indexes
- **docs:** Publish committed release notes
- **docs:** Enforce documentation completion gate for new rules
- **ci:** Parameterize mise tools in setup action
- **codex:** Add small-rules environment configuration
- **documentation:** Reactify custom site components
- **docs:** Add manual documentation deployment
- **codex:** Add post-tool-use hook for lint and test on patch
- **hooks:** Add shfmt check and fix support for shell files
- **no-render-helper-functions:** Allow functions as call arguments
- **small-rules:** Add no-filter-map-chain rule
- **rules:** Add direct React hook import rule
- **react:** Add prefer-direct-hook-imports rule
- **deps:** Integrate react-doctor and enable react compiler

### Fixed

- **docs:** Improve contextual menu and table layout for docs site
- **styles:** Constrain right sidebar width on wide screens
- **docs:** Improve documentation accessibility
- **docs:** Normalize rationale markup
- **ci:** Run playwright install in docs package scope
- **prevent-abbreviations:** Skip checks for externally controlled props
- **require-async-suffix:** Skip check for ts satisfies expressions

### Changed

- Migrate from oxc-parser to yuku-parser
- **knip:** Enable workspace mode and clean up unused code
- **pre-commit:** Extract reusable file selector lists
- **rule-options:** Simplify json value validation
- **docs:** Rebuild rule pages from source facts
- **documentation:** Remove unused types and exports

### Documentation

- Add documentation for two new rules

### Build

- **tools:** Add new tool entries
- **config:** Remove gitleaks tool from hooks and lock files
- **mise:** Replace nr commands with node --run
- **deps:** Update project dependencies

### Tests

- **no-async-in-system:** Add missing branch coverage for edge cases
- **no-render-helper-functions:** Catch helper assignments
- **documentation:** Update expected rule count to 92
- **docs:** Dynamic rule counts in tests and update pre-push hooks

### Continuous Integration

- **github-actions:** Bump action versions to latest patches
- **ci:** Trigger docs deployment from release workflow
- **react-doctor:** Add automated code health scanning

### Style

- Disable import/unambiguous rule for type declaration files
- Update bracket formatting and remove unused CSS grid rule
- **rules:** Simplify conditional formatting

### Maintenance

- **codex:** Update model and multi-agent config
- **hk:** Remove astro from oxfmt-js and biome hooks
- **biome:** Enable all linter domains and adjust rules
- Update tool versions in mise.lock
- **hk:** Disable js on oxfmt
- **plugin:** Rebuild rules
- **scripts:** Add format-lint-relevant and test-relevant scripts
- **hooks:** Remove legacy hook scripts and config
- **vitest:** Block documentation as coverage
- **oxlint:** Add react and vitest rules for docs
- **hk:** Replace `nr` with `node --run` in hook commands
- **docs:** Validate and deploy documentation
- **oxlint:** Set standard environment
- Rebuild
- **hooks:** Prepend gh auth token to zizmor execution commands
- Remove useless slop test
- **deps:** Downgrade hk tool version to 1.52.0
- **deps:** Downgrade hk to 1.50.0

## [v2.7.0] - 2026-07-13

### Added

- **default-properties:** Add compact default properties generator
- **ci:** Split checks and gate release on ci

## [v2.6.0] - 2026-07-13

### Added

- **no-async-in-system:** Restrict rule to Roblox-derived async calls
- **no-async-in-system:** Expand Roblox async detection
- **rules:** Generate Roblox yielding catalog

### Changed

- **script:** Fetch roblox api dump from raw github

### Maintenance

- **lint:** Trim oxlint rule set
- **package-json:** Format generated roblox members file

## [v2.5.2] - 2026-07-12

### Continuous Integration

- **release:** Skip git checks when publishing to npm

## [v2.5.1] - 2026-07-12

### Tests

- **release-workflow:** Verify pnpm publish and catalog resolution
- **release-workflow:** Replace named path import with default import

### Continuous Integration

- **release:** Switch publish command from npm to pnpm
- **workflows:** Expand glob pattern in CI trigger paths

### Maintenance

- **deps:** Add confbox to test catalog and pin zx version
- Sort keys and properties across config and source files

## [v2.5.0] - 2026-07-12

### Added

- **zed:** Configure biome and oxfmt to use node run
- **rules:** Add no-async-in-system rule
- **scripts:** Replace bun with zx+nub for json linting

### Changed

- **deps:** Switch to pnpm catalogs

### Continuous Integration

- Replace aube with pnpm and remove aube tooling
- Consolidate ci workflow jobs into a single matrix job
- Replace `nr` with `node --run` in CI workflow
- **workflows:** Extract setup and install steps into composite actions
- Extract reusable checks workflow and simplify ci pipelines

### Maintenance

- **deps:** Switch from aube to pnpm as package manager
- Replace nr with node for build scripts
- Update dev dependencies
- Appease linting
- Regenerate default properties
- **scripts:** Migrate tooling to nub
- **stryker:** Ignore generated directories
- **knip:** Fix pre-push hook issues
- **deps:** Replace `@antfu/ni` npm dep with mise-managed `ni`
- Replace `aube` with `node --run` in tool commands
- Remove package-manager-detector dependency and its patch
- **knip:** Simplify entry glob with wildcard pattern

## [v2.4.1] - 2026-07-07

### Added

- **no-restricted-property-assignment:** Test allowFiles match basename

### Fixed

- **rules:** Match allowFiles against relative paths

## [v2.4.0] - 2026-07-07

### Added

- **no-restricted-property-assignment:** Add glob support
- **rule:** Precompile property restrictions

### Changed

- **rules:** Use shared function and global call helpers

### Maintenance

- Use catalog versioning for deps

## [v2.3.0] - 2026-06-30

### Added

- **rule:** Add allowFiles option minimatch dep

### Changed

- **lint:** Replace manual type guards with ArkType

### Maintenance

- **deps:** Update picomatch to 4.0.4

## [v2.2.1] - 2026-06-30

### Continuous Integration

- Upgrade actions to v5 and tweak release build

## [v2.2.0] - 2026-06-30

### Added

- **mcp:** Add astro-docs remote entry to mcp config
- **codex:** Add MCP server config
- Upgrade Vite to v8 and add new lint rules
- **test:** Switch to custom RuleTester
- **rules:** Add no-restricted-property-assignment rule

### Fixed

- **rule:** Exclude property from name extraction

### Changed

- **rules:** Infer rule contexts automatically
- Simplify autofix option checks
- **rules:** Use createOnce for single-pass rules
- Simplify number extraction JSX checks
- Move shared AST helpers to oxc-utilities
- **no-native-properties-spread:** Use scope check
- **rule-harness:** Use HarnessError
- **rule-harness:** Drop unused helpers

### Documentation

- **skills:** Add similarity-ts docs

### Maintenance

- **deps:** Bump dependencies
- Update lint config and downgrade commitlint deps
- **rules:** Add v8 ignore comments
- **warp:** Add MCP server configuration
- Migrate to pnpm and update CI workflows
- **deps:** Bump deps and update lint rules
- **deps:** Bump oxlint plugin utilities
- Relax biome rule settings
- Rebuild local rule
- **deps:** Prune unused eslint packages
- **deps:** Bump oxfmt, oxlint, skills

## [v2.1.0] - 2026-06-23

### Added

- **no-commented-code:** Add maxLines option
- Add tsgo disable script and JSONC utilities
- **scripts:** Add docs tasks and tsgo dry run
- Documentation site start
- **hooks:** Add .astro and .mdx support to lint/format hooks
- **docs:** Add rule options docs, config aliases
- **rules:** Add class method support, path option
- **rules:** Add except option to require-async-suffix rule
- **scripts:** Add Bun JSON lint script
- **vite:** Add tsconfig paths plugin
- **config:** Enable browser env for documentation linting
- **docs:** Add satteri optional peers types
- **no-array-size-assignment:** Add environment option
- **rules:** Add no-array-constructor-index-assignment rule
- Add no-recursive rule
- Maximize test coverage

### Fixed

- **require-throw-error-capture:** Consider catch parameter
- **test:** Update messageId in no-underscore-react-properties tests
- **rules:** Skip imported type member names in abbreviations checks
- **prevent-abbreviations:** Skip imported members
- **ci:** Pin native TypeScript preview

### Other

- **rules:** Use isNumberRaw for number checks
- **hooks:** Remove redundant 'mise x' prefixes from hook commands

### Changed

- **rules:** Simplify type scoring
- **rules:** Simplify element type extraction
- **rules:** Combine Ianitor validator checks
- Simplify getNestedTypeAnnotation
- **rules:** Simplify ianitor rule
- **type-utilities:** Add isStringRaw helper
- **tests:** Simplify ignore pattern in prevent-abbreviations test
- **rules:** Refactor env option schema to use shared config
- **utilities:** Extract isAllowAutofixOption to option-utilities
- **no-recursive:** Use Color enum

### Documentation

- **quick-start:** Add package manager tabs
- Refresh hero splash and homepage stats
- **roblox:** Fix title casing for prefer-idiv rule
- **docs:** Update site colors and hide table of contents
- Update documentation for v3.0 release
- **styles:** Fix css
- Improve rule documentation and schema descriptions
- Style rule options table with BEM classes and column widths
- **agents:** Update plugin description and require TDD
- **agents:** Update command list in AGENTS.md

### Style

- **package:** Reorder exports fields in package.json

### Maintenance

- Update the local plugin and configuration
- **config:** Update configuration
- **biome:** Exclude all package.json files
- **scripts:** Use concise reporter for lint:agent biome check
- Update dependencies and ignore aube-lock.yaml
- **oxfmt:** Collapse multiline JSON options to single line
- Update agent command docs and scripts
- Ignore do-not-sync-ever directories
- **package:** Add lint:json script
- **knip:** Add lint-json script to entry list
- **deps:** Bump dependencies
- **deps:** @oxlint/plugins, bump native-preview
- **deps:** Remove unused oxlint plugin

## [v2.0.0] - 2026-06-16

### Changed

- **rules:** **Breaking:** Consolidate expect assertions rules

### Documentation

- **skills:** Add fix-oxlint-rules skill

### Maintenance

- **deps:** Bump TypeScript peer dependency range
- Dumb shit models never listen

## [v1.1.0] - 2026-06-15

### Added

- Initial commit
- **require-throw-error-capture:** Add allow option
- **scripts:** Start script to generate json for useless-default
- **rules:** Support oxlint line comment directives
- **ci:** Add pull request CI pipeline with test sharding
- **ci:** Add release workflow for NPM publishing
- Add aube support and mise tasks
- **hooks:** Integrate pullhook and add new linters/formatters
- **opencode:** Add configuration file

### Fixed

- **utilities:** Reject circular static expressions
- **rules:** Honor stable hook object results
- **rules:** Score root structural types
- **scripts:** Correct typo in variable name
- **ci:** Stabilize aube install
- **ci:** Setup tools for parallel jobs
- **ci:** Preserve workspace artifact metadata
- **ci:** Install dependencies per check job
- **ci:** Disable setup-node package manager cache
- **ci:** Publish before creating release

### Other

- Upgrade mise-action to v4 and add node install
- **release:** Streamline CI and integrate bumpp

### Changed

- **lint:** Reduce rule complexity
- **utilities:** Remove dead annotation guards
- **rules:** Remove unreachable ban-types guard
- **rules:** Remove unreachable closer fallback
- **core:** Add Bun types and refactor utilities
- **rules:** Inline type complexity calculators

### Documentation

- Add README and AGENTS guide

### Tests

- **utilities:** Cover expression and casing helpers
- **utilities:** Cover expression safety branches
- **utilities:** Cover component utility branches
- **utilities:** Cover type and import helpers
- **rules:** Cover memo and react fc guards
- **rules:** Cover ban-instances property guards
- **rules:** Cover array constructor default annotations
- **rules:** Cover abbreviation checks in jsx
- **rules:** Cover binary conditional complements
- **rules:** Cover constant relocation helpers
- **rules:** Cover loop exit expression guards
- **rules:** Cover use effect callback shapes
- **rules:** Cover ianitor validator score buckets
- **rules:** Cover useless default edge cases
- **rules:** Cover constant loop exit branches
- **rules:** Cover effect event logic branches
- **rules:** Cover dependency expression resolution
- **rules:** Cover default comparison escapes
- **rules:** Cover constant condition edge cases
- **rules:** Cover useless effect edge cases
- **rules:** Cover exhaustive dependency edges
- **rules:** Cover memoized dependency edges
- **rules:** Cover ianitor type scoring edges
- **rules:** Cover array constructor edges
- **rules:** Cover useless default edge cases
- **rules:** Cover paired call edges
- **rules:** Cover component key edges
- **rules:** Fix component key fragment fixture
- **rules:** Cover directive and effect edges
- **rules:** Cover remaining rule edge cases
- **rules:** Cover hook and dispatch edges
- **rules:** Cover paired call and render edges
- **vitest:** Relax coverage thresholds

### Continuous Integration

- **workflows:** Condense CI workflow and expand trigger paths
- Add bun to mise install args
- **workflows:** Split CI into parallel job matrix

### Maintenance

- **deps:** Upgrade biome to v2.5.0 and sync configs
- **mise:** Add jscpd to tool configuration
- Add jscpd setup and refactor ColumnLine type
- Update default properties json
- **ci:** Expand path triggers to include entire dirs and patches
- **workspace:** Add documentation package and rename scope
- **ci:** Switch to frozen lockfile and update deps
- **deps:** Pin dependency versions to exact and add jscpd
- **dev-deps:** Add aube, remove deno and jscpd, drop baseline variants
- **ci:** Migrate jsr packages to npm specifiers
- **config:** Add MCP server configuration
- **ci:** Pin actions to shas and restrict perms
- **deps:** Update tool versions and lockfiles
- **deps:** Update oxfmt to 0.55.0

[v2.12.1]: https://github.com/howmanysmall/small-rules/compare/v2.12.0...v2.12.1
[v2.12.0]: https://github.com/howmanysmall/small-rules/compare/v2.11.0...v2.12.0
[v2.11.0]: https://github.com/howmanysmall/small-rules/compare/v2.10.0...v2.11.0
[v2.10.0]: https://github.com/howmanysmall/small-rules/compare/v2.9.0...v2.10.0
[v2.9.0]: https://github.com/howmanysmall/small-rules/compare/v2.8.0...v2.9.0
[v2.8.0]: https://github.com/howmanysmall/small-rules/compare/v2.7.0...v2.8.0
[v2.7.0]: https://github.com/howmanysmall/small-rules/compare/v2.6.0...v2.7.0
[v2.6.0]: https://github.com/howmanysmall/small-rules/compare/v2.5.2...v2.6.0
[v2.5.2]: https://github.com/howmanysmall/small-rules/compare/v2.5.1...v2.5.2
[v2.5.1]: https://github.com/howmanysmall/small-rules/compare/v2.5.0...v2.5.1
[v2.5.0]: https://github.com/howmanysmall/small-rules/compare/v2.4.1...v2.5.0
[v2.4.1]: https://github.com/howmanysmall/small-rules/compare/v2.4.0...v2.4.1
[v2.4.0]: https://github.com/howmanysmall/small-rules/compare/v2.3.0...v2.4.0
[v2.3.0]: https://github.com/howmanysmall/small-rules/compare/v2.2.1...v2.3.0
[v2.2.1]: https://github.com/howmanysmall/small-rules/compare/v2.2.0...v2.2.1
[v2.2.0]: https://github.com/howmanysmall/small-rules/compare/v2.1.0...v2.2.0
[v2.1.0]: https://github.com/howmanysmall/small-rules/compare/v2.0.0...v2.1.0
[v2.0.0]: https://github.com/howmanysmall/small-rules/compare/v1.1.0...v2.0.0
[v1.1.0]: https://github.com/howmanysmall/small-rules/commits/v1.1.0
\
