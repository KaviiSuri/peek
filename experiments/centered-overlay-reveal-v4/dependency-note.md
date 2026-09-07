# Experiment dependency note

This separate experiment reuses the exact versions already inspected for the prior throwaway package:

- `effect@3.22.1` — official npm stable `latest` response; no install script.
- `typescript@7.0.2`, `@types/chrome@0.2.9`, `@types/node@26.4.1` — no install scripts reported.
- `esbuild@0.28.2` — `postinstall: node install.js` was previously unpacked and inspected (script SHA-256 `612294e278914443bdcf81cb17f54afec34dbdd2ebd999a6ee187912320cc315`). It selects/validates the platform optional binary and may fetch that exact binary from npm if absent. Local npm policy previously left it pending; the optional package supplied the binary.

All versions are exact-pinned and installed only under this experiment directory. No package choice is a production commitment.
