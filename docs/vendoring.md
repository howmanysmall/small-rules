# Vendoring Third-Party Code

How to bring outside code into this repository.

`THIRD-PARTY-NOTICES.md` and the `dist/index.js` legal banner are both generated from
[`scripts/utilities/vendored-notices.ts`](../scripts/utilities/vendored-notices.ts).
That module is the only place a component is described. Do not hand-edit either output.

## Adding a Component

1. **Add the provenance header** to each vendored file:

   ```ts
   // oxlint-disable comment-length/limit-single-line-comments -- vendored header
   // Vendored from <upstream-path>@<upstream-sha> by <upstream-author>.
   // Source: <upstream-url>
   // SPDX-License-Identifier: MIT
   ```

   For vendored `*.md` files, use `<!--` / `-->` instead of `//`.

   This header is for people reading the source tree. It is not what satisfies the
   upstream license — minification strips it — so it is a courtesy, not the obligation.

2. **Add one entry** to `VENDORED_COMPONENTS`:

   ```ts
   {
       commit: "446268e5d15baa968eaec669ff65358d36ae6259",
       copyright: "Copyright (c) 2026 Dillon Mulroy",
       directory: "src/rules/anti-slop/",
       files: [{ local: "no-chained-type-assertions.ts", upstream: "src/rules/no-chained-type-assertions.ts" }],
       license: "MIT",
       name: "anti-slop",
       source: "https://github.com/dmmulroy/anti-slop",
       verbatim: false,
   }
   ```

3. **Regenerate:**

   ```bash
   node --run generate:third-party-notices
   ```

That is the whole procedure. The notices file, the bundle banner, and the npm tarball all
follow from the entry.

## What Enforces This

`tests/third-party-notices.test.ts` fails if `THIRD-PARTY-NOTICES.md` does not match what
the catalog renders, if a listed file does not exist on disk, or if the banner loses a
copyright line or permission grant. `node --run generate:third-party-notices -- --check`
does the staleness half of that without writing, for hooks and CI.

## Licenses

`license` accepts any SPDX identifier in `LICENSE_TEMPLATES`: `MIT`, `ISC`,
`BSD-2-Clause`, `BSD-3-Clause`. Anything else is a compile error, deliberately. Those four
are permissive licenses whose full text is a copyright substitution away, so rendering
them is mechanical.

Apache-2.0 and the copyleft family are absent on purpose. Apache-2.0 additionally requires
propagating a `NOTICE` file and stating significant changes; the copyleft licenses require
a source offer. Adding them to the template map would produce a notice that looks complete
while omitting the actual obligation, so vendoring such a component should force a
deliberate decision rather than a one-line data edit.

## What Not to Record

Do not keep per-change modification logs. MIT, ISC, and BSD require only that the
copyright notice and permission notice survive; a prose changelog of local edits is an
Apache-2.0 §4(b) habit that goes stale and obligates nothing here. The `verbatim` flag
states once whether the files were adapted, which is all the notice needs.
