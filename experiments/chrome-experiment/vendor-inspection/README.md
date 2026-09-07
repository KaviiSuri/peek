# Dependency script inspection

Prepared versions were resolved before install:

- `effect@3.22.1`: official npm `latest` registry response; no package install script reported.
- `typescript@7.0.2`: npm `latest`; no package install script reported.
- `@types/chrome@0.2.9`: npm `latest`; empty scripts object.
- `@types/node@26.4.1`: npm `latest`; empty scripts object.
- `esbuild@0.28.2`: npm `latest`; one `postinstall` script, `node install.js`.

Before running `npm install`, `npm pack esbuild@0.28.2 --ignore-scripts` was used and `package/install.js` was inspected (script SHA-256 `612294e278914443bdcf81cb17f54afec34dbdd2ebd999a6ee187912320cc315`; tarball SHA-256 `e045f94c235c7adc50e77ba2a579c7bec41b496b6b47c3a7845f7c1e19959a88`). It selects and validates esbuild's platform-specific optional binary; if missing, it can fetch the matching binary package from `registry.npmjs.org`. It also probes the local executable/version. No project-specific or unrelated script was present. The local npm policy left this postinstall pending rather than running it. The platform-specific optional package already supplied a working binary, so no script approval or fallback download was needed. Dependencies were installed only inside this throwaway experiment directory.

The packed tarball is gitignored and not included in the user ZIP.
