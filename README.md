<div align="center">

# `@pobammer-ts/small-rules`

**Oxlint-native lint rules for [roblox-ts](https://roblox-ts.com/) projects**

[![npm version](https://img.shields.io/npm/v/@pobammer-ts/small-rules?logo=npm&color=cb3837)](https://www.npmjs.com/package/@pobammer-ts/small-rules)
[![npm downloads](https://img.shields.io/npm/dm/@pobammer-ts/small-rules?logo=npm&color=cb3837)](https://www.npmjs.com/package/@pobammer-ts/small-rules)
[![Rules](https://img.shields.io/badge/rules-87-blueviolet)](https://docs.howmanysmall.com/small-rules/rules/)
[![CI](https://github.com/pobammer-ts/small-rules/actions/workflows/ci.yaml/badge.svg?branch=main)](https://github.com/pobammer-ts/small-rules/actions/workflows/ci.yaml)
[![License](https://img.shields.io/npm/l/@pobammer-ts/small-rules?color=blue)](https://github.com/pobammer-ts/small-rules/blob/main/LICENSE)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%E2%80%938.0-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%5E20.19%20%7C%20%E2%89%A522.12-339933?logo=node.js)](https://nodejs.org)
[![Oxlint](https://img.shields.io/badge/linter-Oxlint-f9801b?logo=oxlint)](https://oxc.rs)
[![Biome](https://img.shields.io/badge/code%20style-Biome-609d6c?logo=biome)](https://biomejs.dev)

</div>

---

## Installation

```bash
ni -D @pobammer-ts/small-rules
```

> Requires [Oxlint](https://oxc.rs) **v1.69.0+**, TypeScript **5 – <8**, and Node.js **≥20.19** or **≥22.12**.

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

All rules are namespaced under `small-rules/`. Pick the subset that fits your project — there is no bulk opt-in.

## Rules

Browse the [**full rule catalog →**](https://docs.howmanysmall.com/small-rules/rules/) for descriptions, options, diagnostics, and examples.

## License

MIT © HowManySmall
