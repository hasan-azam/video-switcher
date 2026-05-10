# Development Workflow

This project uses a small CI/CD toolchain to keep commit messages, builds, and releases consistent.

## Local Setup

Install root automation dependencies:

```powershell
npm.cmd ci
```

Install and build the setup app through the root script:

```powershell
npm.cmd run build
```

Run the current test command:

```powershell
npm.cmd test
```

The test script is currently a placeholder. Keep using `npm.cmd test` as the stable command so future unit and integration tests can be added behind the same interface.

## Commits

Use Commitizen for guided Conventional Commits:

```powershell
npm.cmd run commit
```

Common commit types:

- `feat`: user-facing feature
- `fix`: bug fix
- `docs`: documentation only
- `style`: formatting only
- `refactor`: code change without behavior change
- `test`: tests only
- `build`: build tooling or dependency changes
- `ci`: CI/CD workflow changes
- `chore`: maintenance

Commitlint validates commit messages. Husky runs Commitlint automatically through `.husky/commit-msg`.

Examples:

```text
feat: add playlist shuffle mode
fix: repair loadout parsing
ci: add release workflow
docs: document ci and release workflow
```

Breaking changes create major releases when written with `!` or a `BREAKING CHANGE:` footer:

```text
feat!: change loadout file format
```

## CI

GitHub Actions runs `.github/workflows/ci.yml` on pull requests and pushes to `main`.

The workflow:

1. Installs root dependencies with `npm ci`.
2. Validates pull request commit messages with Commitlint.
3. Builds the setup app with `npm run build`.
4. Runs tests with `npm test`.

## Releases

Semantic-release is configured in `.releaserc.json` and runs from `.github/workflows/release.yml` when changes land on `main`.

Semantic-release uses Conventional Commits to decide versions:

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- breaking changes create a major release.
- `ci:`, `docs:`, `chore:`, and `build:` do not normally create a release.

Release output includes:

- a Git tag like `v1.2.3`
- generated release notes
- an updated `CHANGELOG.md`
- a GitHub release

## Initial Version

To mark the current application state as `v1.0.0`, create an annotated tag from an up-to-date `main` branch:

```powershell
git switch main
git pull
git tag -a v1.0.0 -m "chore(release): 1.0.0"
git push origin v1.0.0
```

After that, semantic-release will calculate future versions from commits after `v1.0.0`.
