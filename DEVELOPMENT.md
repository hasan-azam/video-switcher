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

## Shareable Windows Build

The share build is a zip anyone can unzip on a fresh Windows PC and run by double-clicking `Start Video Switcher.bat`, with nothing to install. It is what gets attached to each GitHub release.

Build it locally (needs Python installed on your machine; it gets bundled):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\make-share-zip.ps1
```

This writes `dist\Video Switcher.zip` (`dist/` is gitignored). Pass `-Python C:\path\to\python.exe` to choose which Python to bundle; otherwise the script uses `py -3`, then the first real `python` on PATH.

Then smoke-test it the way a fresh PC would run it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\smoke-test-share-zip.ps1
```

The smoke test extracts the zip to a temp folder, starts the launcher with no Python on PATH, and checks that it runs on the bundled Python and serves the pages, loadouts, and every video a loadout references. It exits non-zero on any failure and cleans up after itself. Use `-Zip <path>` to test a different zip.

What goes into the zip:

- the runtime app files: `index.html`, `setup.html`, `server.py`, `css/`, `js/`, `loadouts/`, `setup-dist/`, `videos/`, and the launcher
- `readme.txt`, renamed to `READ ME FIRST.txt`
- `runtime/python/`: a trimmed copy of the bundled Python (no tests, IDLE, tkinter, or site-packages). A `._pth` file isolates it from any other Python or `PYTHON*` environment variables on the destination PC.

What stays out: `.git`, `node_modules`, `setup/` sources, and CI/dev config.

`setup-dist/` is committed, so the zip uses the setup app as last built. Run `npm.cmd run build` and commit `setup-dist/` before releasing setup UI changes.

### Videos and loadouts

`videos/` is tracked in git so a release is a one-stop download with the show ready to go. GitHub rejects files over 100 MB and warns above 50 MB, so keep individual videos under that. Unused local files can be listed in `.gitignore` (as `videos/render.mp4` is).

Every video a loadout references must exist in `videos/`, or the smoke test fails. On first launch in a browser with no saved choice, the app opens the first loadout other than `Default`.

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
5. In a separate `windows-latest` job, builds the share zip with Python 3.13, runs the smoke test, and uploads the zip as a `video-switcher-windows` artifact kept for 3 days. Download it from the workflow run to try a PR's build by hand.

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
- a GitHub release with `Video-Switcher-for-Windows.zip` attached

The release workflow first builds and smoke-tests the share zip in a `windows-latest` job. The `release` job waits for it (`needs: share-zip`), downloads the zip, and semantic-release uploads it through the `assets` option in `.releaserc.json`. A failed build or smoke test blocks the release. The zip is built on every push to `main`, even ones that turn out not to need a release.

The download name never changes, so this link always serves the newest release:

```text
https://github.com/hasan-azam/video-switcher/releases/latest/download/Video-Switcher-for-Windows.zip
```

Send that link to anyone who just wants to run the app. The release page's "Source code (zip)" downloads don't include the bundled Python or work out of the box.

## Initial Version

To mark the current application state as `v1.0.0`, create an annotated tag from an up-to-date `main` branch:

```powershell
git switch main
git pull
git tag -a v1.0.0 -m "chore(release): 1.0.0"
git push origin v1.0.0
```

After that, semantic-release will calculate future versions from commits after `v1.0.0`.
