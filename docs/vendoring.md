# Vendoring third-party code

How to bring outside code into this repository. The legal artifact this produces is
[`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md); this document is the procedure,
not the notice.

## File header

Every vendored file begins with this header before any other content:

```ts
// oxlint-disable comment-length/limit-single-line-comments -- vendored header
// Vendored from <upstream-path>@<upstream-sha> by <upstream-author>.
// Source: <upstream-url>
// SPDX-License-Identifier: MIT
```

For vendored `*.md` files, use `<!--` / `-->` instead of `//`.

The header is provenance for people reading the source tree. It is not what satisfies
the upstream license — the build minifies these comments away, so the notice that
actually ships comes from `THIRD-PARTY-NOTICES.md` and the bundle banner.

## Checklist

1. Add the header above to each vendored file.
2. Add or update the component's entry in `THIRD-PARTY-NOTICES.md`: source URL, vendored
   commit SHA, copyright line, license name, the file mapping table, and the verbatim
   license text.
3. If the component is new, add its copyright and license to `VENDORED_NOTICE` in
   `tsdown.config.ts` so the notice is embedded in `dist/index.js`.
4. Confirm `THIRD-PARTY-NOTICES.md` is listed in `files` in `package.json`.

Do not record per-change modification notes. MIT requires only that the copyright notice
and permission notice survive; a prose changelog of local edits goes stale and is not a
license obligation. State once in the notices entry whether the vendored files are
verbatim or adapted, and leave it there.
