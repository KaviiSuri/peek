# Effect version evidence

On 2026-09-06, the official npm registry endpoint [`https://registry.npmjs.org/effect/latest`](https://registry.npmjs.org/effect/latest) returned:

- package: `effect`
- version: `3.22.1`
- tarball: `https://registry.npmjs.org/effect/-/effect-3.22.1.tgz`
- integrity: `sha512-TNoXushmPOBAjJlthF5d2QwnX2xBPEtcNJr5XKNKbRLbDvBcOYkXlYDfvGfSA0zriwLFuCll5MDtNMAdZL17PQ==`
- package homepage: `https://effect.website/`
- package repository: `https://github.com/Effect-TS/effect`, `packages/effect`
- exported stable APIs used by the spike include `Effect`, `Context`, `Layer`, and `ManagedRuntime`.

The experiment pins that exact stable release. It does not copy Poof's `4.0.0-rc.110` release candidate. This is an experiment dependency choice, not a production-version commitment.
