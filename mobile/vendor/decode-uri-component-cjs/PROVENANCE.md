# Decoder compatibility patch

This is a maintained HALA adaptation, **not** the unmodified upstream npm package.

- Upstream: https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.1
- Source: npm `decode-uri-component@0.5.1`, official tarball SHA-1 `7f66b25bf435df723f9af55713dcf860a1c297d2`.
- Upstream `index.js` SHA-256: `6a86ac891edf15c5efa0841ebb31935e3669d58b98318b57d7b08a4530317cb0`.
- Advisory fixed upstream: https://github.com/advisories/GHSA-qr28-fpjm-wq7f
- License: MIT; the original license is included unchanged.

The decoding algorithm is copied unchanged from upstream0.5.1. The adaptations are limited to strict-mode/CommonJS export and a wrapper preserving the older decoder's plus-as-space behavior. `query-string@7.1.3` requires a callable CommonJS module; blindly installing upstream's ESM export would break it.

The mobile root declares this local package as `decode-uri-component` and uses npm's documented direct-dependency override reference so all consumers resolve to the same reviewed implementation. Its package name/version explicitly identify the adaptation. See `mobile/tests/dependencies.mjs` for normal, Arabic, malformed and large-input routing regressions.

Remove this adapter when Expo's supported router dependency consumes a patched upstream decoder without a format mismatch. A lower audit count after replacement does not establish that the remaining SDK/build-tool dependency graph is vulnerability-free. No major Expo or Zod upgrade is hidden in this repair.
