# ci-cd pipeline notes

## root package.json

first i want to make a root package.json

this is where the automation layer config will live

```json
{
  "name": "video-switcher",
  "private": true,
  "scripts": {
    "build": "npm --prefix setup ci && npm --prefix setup run build",
    "test": "echo \"No tests configured yet\""
  }
}
```

## commitlint

next i'm installing commitlint

in the repo root, i create a commitlint.config.cjs

this is the commit lint config file

in there, i put

```js
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
```

which lets it know to use conventional commits rules

in my root package.json, i'll update the scripts section to include

```json
"lint:commits": "commitlint --from=HEAD~1 --to=HEAD"
```

## husky commit message hook

the next commit is

```text
ci: add husky commit message hook
```

i install husky and add it to package.json and package-lock.json

i add a prepare script to my package.json:

```json
"prepare": "husky"
```

what this does is make it so when someone runs npm install, husky will get initialized for that local clone

i run the prepare script to initialize husky, which creates a .husky folder

in there, i make a commit-msg file and put in it:

```sh
npx --no -- commitlint --edit "$1"
```

this tells us that, whenever we add a commit message, they'll run commit lint on the file passed into it by git.

## commitizen commit helper

this brings us to our next commit, where we're adding the commitizen commit helper. this adds an interactive command that helps you write valid conventional commit messages

first i install commitizen adapter:

```powershell
npm.cmd install --save-dev commitizen cz-conventional-changelog
```

then i run

```powershell
npm.cmd pkg set scripts.commit="cz"
```

to add that to my package.json

now i can run npm run commit instead of git commit.

i'm assuming i can do this with yarn as well

now at the project root i create a .czrc file

inside i put

```json
{
  "path": "cz-conventional-changelog"
}
```

this tells commitizen to use the conventional commits prompt

looks like it's working now.

honestly not sure if i like having commitizen but i'm sure it'll become natural

## GitHub actions build workflow

the next commit is to add the GitHub actions build workflow

first i create a .github/workflows folder

i make a ci.yml file and put in it

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  build:
    name: Build and test
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install repo dependencies
        run: npm ci

      - name: Build setup app
        run: npm run build

      - name: Run tests
        run: npm test
```

This sets up my GitHub actions

this sets up our basic ci pipeline

## conventional commits in CI

now, the next thing we want to do is make it so that our ci pipeline enforces conventional commits too, not just our local Husky hook.

theoretically, someone could bypass with

```powershell
git commit --no-verify
```

first, we make an update to our ci.yml.

we add a separate job commitlint: which only runs on pull requests. it checks every commit between the PR base and PR head and enforces commit linting

## semantic-release configuration

the next commit we're going to do is to setup semantic-release

the following commit will answer: when should GitHub actions run semantic-release?

first, i install the semantic release packages:

```powershell
npm.cmd install --save-dev semantic-release @semantic-release/commit-analyzer @semantic-release/release-notes-generator @semantic-release/changelog @semantic-release/github @semantic-release/git
```

semantic-release is the main release engine

@semantic-release/commit-analyzer reads conventional commits and decides the next version

@semantic-release/release-notes-generator turns commits into release notes

@semantic-release/changelog writes release notes into CHANGELOG.md

@semantic-release/github creates GitHub releases

@semantic-release/git commits generated files like CHANGELOG.md back to the repo

now i want to add a release script

```powershell
npm.cmd pkg set scripts.release="semantic-release"
```

this adds:

```json
"release": "semantic-release"
```

to our package.json

this gives us npm run release

next, in the project root, i'll create a .releaserc.json that i'll populate with:

```json
{
  "branches": ["main"],
  "tagFormat": "v${version}",
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json", "package-lock.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

a breakdown of what this file configures:

"branches": ["main"] means that only releases from main

tagFormat tells us our tags will be v1.0.0 etc.

will use commit-analyzer to decide the next version and semantic-release/changelog to update CHANGELOG.md

"@semantic-release/git" commits the generated changelog back to the repo

and [skip ci] prevents that changelog commit from triggering another CI loop

this finishes our commit:

```text
ci: add semantic release configuration
```

the next commit will add .github/workflows/release.yml so GitHub can actually run semantic-release when changes are pushed on main

## semantic-release workflow

the last commit configured how releases work. this one configures when releases run

first, i create a file .github/workflows/release.yml

inside, i put

```yaml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.14.0
          cache: npm

      - name: Install repo dependencies
        run: npm ci

      - name: Build setup app
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Release
        run: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

what this does: when code is pushed to main, GitHub actions will do a couple of things

it will check out the full git history

it will install node 22.14.0, install dependencies, build the app, run tests, and run semantic-release

semantic-release will then read commit history, decide whether a release is needed, calculate the next version, create a git tag, update CHANGELOG.md when a release is published, and create a GitHub release

the permissions block is important. it allows GITHUB_TOKEN to create releases, push tags, and comment on issues/PRs if needed

now it's pretty much all set up

## version 1.0.0

i need to figure out what i'm establishing as 1.0.0

for now, i'll go with everything up until this point.

after main is up to date, i can create and push an annotated v1.0.0 tag

```powershell
git tag -a v1.0.0 -m "chore(release): 1.0.0"
git push origin v1.0.0
```

## CI/CD pipeline diagram

```mermaid
flowchart TD
  dev[Developer] --> localCommit[npm run commit]
  localCommit --> cz[.czrc + commitizen]
  cz --> message[Conventional Commit message]
  message --> husky[.husky/commit-msg]
  husky --> commitlintConfig[commitlint.config.cjs]
  commitlintConfig --> commitlint[commitlint]
  commitlint --> gitCommit[Git commit]

  gitCommit --> pr[Pull request]
  pr --> ciWorkflow[.github/workflows/ci.yml]
  ciWorkflow --> ciInstall[npm ci]
  ciWorkflow --> prCommitlint[Validate PR commits]
  prCommitlint --> commitlintConfig
  ciWorkflow --> ciBuild[npm run build]
  ciBuild --> setupInstall[npm --prefix setup ci]
  ciBuild --> setupBuild[npm --prefix setup run build]
  ciWorkflow --> ciTest[npm test]

  pr --> merge[Merge to main]
  merge --> releaseWorkflow[.github/workflows/release.yml]
  releaseWorkflow --> releaseInstall[npm ci]
  releaseWorkflow --> releaseBuild[npm run build]
  releaseWorkflow --> releaseTest[npm test]
  releaseWorkflow --> semanticRelease[npm run release]

  semanticRelease --> releaseConfig[.releaserc.json]
  releaseConfig --> analyzer[@semantic-release/commit-analyzer]
  releaseConfig --> notes[@semantic-release/release-notes-generator]
  releaseConfig --> changelog[@semantic-release/changelog]
  releaseConfig --> gitPlugin[@semantic-release/git]
  releaseConfig --> githubPlugin[@semantic-release/github]

  analyzer --> version[Next semantic version]
  notes --> releaseNotes[Release notes]
  changelog --> changelogFile[CHANGELOG.md]
  gitPlugin --> changelogCommit[chore release commit]
  githubPlugin --> githubRelease[GitHub release]
  version --> tag[Git tag vX.Y.Z]
```
