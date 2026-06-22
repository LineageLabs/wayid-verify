# Publishing

Both packages are **publish-ready but not yet published**. Releases are driven by
git tags via GitHub Actions. Pick the prefix for the package you're releasing.

| Package                     | Registry | Tag prefix | Workflow             |
| --------------------------- | -------- | ---------- | -------------------- |
| `@lineagelabs/wayid-verify` | npm      | `js-v*`    | `publish-js.yml`     |
| `wayid-verify`              | PyPI     | `py-v*`    | `publish-python.yml` |

## One-time setup

### npm (`@lineagelabs/wayid-verify`)

1. Ensure the **`lineagelabs`** npm organization exists and you can publish scoped
   public packages under it.
2. Create an **automation token** with publish rights and add it as the repo secret
   **`NPM_TOKEN`** (Settings → Secrets and variables → Actions).

The package sets `publishConfig.access = "public"`, so the scoped package publishes
publicly. Build is automatic via `prepublishOnly` (`tsc`).

### PyPI (`wayid-verify`)

Uses **Trusted Publishing (OIDC)** — no long-lived token. On <https://pypi.org>:

1. Reserve/create the project `wayid-verify` (or configure a _pending_ publisher).
2. Add a **GitHub Actions** trusted publisher:
   - Owner: `LineageLabs`, Repository: `wayid-verify`
   - Workflow: `publish-python.yml`
   - Environment: `pypi`
3. In this repo, create an Actions **environment** named `pypi` (Settings →
   Environments) — optionally with required reviewers for a manual approval gate.

(Token alternative: drop the `id-token` permission and pass
`password: ${{ secrets.PYPI_API_TOKEN }}` to the publish action instead.)

## Cutting a release

1. Bump the version in `js/package.json` / `python/pyproject.toml` and add a
   matching `## <version>` section to the package's `CHANGELOG.md`.
2. Commit, then tag and push:

   ```bash
   # npm
   git tag js-v0.1.0 && git push origin js-v0.1.0
   # PyPI
   git tag py-v0.1.0 && git push origin py-v0.1.0
   ```

The matching workflow builds and publishes. The `test.yml` workflow runs on every
push/PR and gates correctness independently.

### npm tarball (registry-free install)

`publish-js.yml` also runs `npm pack` and attaches the resulting
`lineagelabs-wayid-verify-<version>.tgz` to the GitHub release for the `js-v*` tag —
**before** the npm publish step, so the tarball is available even if npm publishing is
skipped or not yet configured. Consumers can then install with no registry:

```bash
npm install https://github.com/LineageLabs/wayid-verify/releases/download/js-v0.1.0/lineagelabs-wayid-verify-0.1.0.tgz
```

(The Python package needs no equivalent — `pip install "git+…#subdirectory=python"`
installs it straight from the repo.)
