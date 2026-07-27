# Contributing to Mistral Chat

Thanks for your interest. A reminder before you dive in: **this is an
unofficial, community-maintained project, not a Mistral AI product.**
Contributions should keep that framing intact — e.g. don't add copy, icons,
or marketing language that implies Mistral AI involvement or endorsement.

## Getting set up

```bash
git clone git@github.com:mbfassnacht/mistral-desktop.git
cd mistral-desktop
pnpm install
pnpm run dev
```

You'll need a Mistral API key (from [console.mistral.ai](https://console.mistral.ai/))
to exercise chat functionality; enter it in the app's Settings once it's running.

## Before opening a PR

Run these from the repo root — they're the same checks CI runs:

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

If you're touching the app's UI text, add translations for all six locales
in `src/renderer/src/i18n/locales/` (`en`, `fr`, `es`, `de`, `it`, `pt`)
rather than only `en.json` — partial translations are worse than none,
since they leave a UI that mixes languages.

## Project structure

`src/main` is the privileged process (Mistral API calls, API key storage,
conversation persistence all happen here); `src/preload` is the only bridge
into `src/renderer`, which is a sandboxed React UI with no direct
Node/Electron access. `src/shared` holds types used across all three.

## CI and releases

- `.github/workflows/ci.yml` runs lint/typecheck/build on every PR and push
  to `main`.
- `.github/workflows/release.yml` runs on push to `main`, but only actually
  builds and publishes a release if `package.json`'s `version` doesn't
  already have a matching `vX.Y.Z` tag. **To cut a release, bump that
  version as part of your PR** — merging it to `main` is what triggers the
  macOS/Windows/Linux build matrix and publishes the results as GitHub
  Release assets. A merge that doesn't touch the version just runs CI, no
  release.
- Builds are unsigned (no Apple notarization or Windows Authenticode
  certificate), so end users see a one-time OS warning on first launch. Code
  signing costs money and requires a maintained certificate/account; if
  you'd like to help set that up, open an issue to discuss first.

## Reporting bugs / requesting features

Open a GitHub issue. Since Mistral's API itself is out of this project's
control, please distinguish between "the app is broken" (this repo's
problem) and "the model gave a bad answer" (not something this project can
fix).

## License

MIT — see [LICENSE](LICENSE). By contributing, you agree your changes are
licensed under the same terms.
