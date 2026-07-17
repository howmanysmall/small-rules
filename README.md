# `@pobammer-ts/small-rules`

A collection of [Oxlint](https://oxc.rs)-native rules for linting [roblox-ts](https://roblox-ts.com/) projects.

## Installation

```bash
ni -D @pobammer-ts/small-rules
```

This package is an [Oxlint plugin](https://oxc.rs/docs/guide/usage/plugins) and must be used with [Oxlint](https://oxc.rs) v1.69.0 or later. It supports TypeScript versions from 5 up to, but not including, 8 and requires Node.js `^20.19.0` or `>=22.12.0`.

## Configuration

Register the plugin in your `.oxlintrc.json` and enable the rules you want:

```json
{
  "plugins": ["@pobammer-ts/small-rules"],
  "rules": {
    "small-rules/no-print": "error",
    "small-rules/no-warn": "error"
  }
}
```

All rules are namespaced under the `small-rules/` prefix. Pick the subset that fits your project — there is no bulk opt-in.

## Rules

Browse the [complete rule catalog](https://howmanysmall.github.io/small-rules/rules/) for source-backed descriptions, configuration, diagnostics, and examples.

## License

MIT © HowManySmall
