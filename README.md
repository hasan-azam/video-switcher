# Video Switcher

A keyboard-driven video switcher for live performances. Each key on the keyboard is bound to a video clip (or a live webcam feed), so an operator can cut between visuals in time with the music during a show. Built for and used at 10 live shows.

<!-- TODO: add a screenshot or short GIF of the performance screen and the setup page -->
<!-- ![Performance screen](docs/performance.gif) -->
<!-- ![Setup page](docs/setup.png) -->

## Features

- **One-key switching**: press a bound key to cut instantly to its clip; clips loop until the next cue.
- **Webcam input**: bind a key to a live camera feed alongside pre-rendered clips.
- **Per-show loadouts**: save a separate set of key bindings for each show and switch between them from the setup page.
- **Setup page**: a React/TypeScript app for assigning keys, picking videos, and labeling cues, with no JSON editing required.
- **Stage-ready display**: runs fullscreen in Chrome, with an on-screen HUD that hides during the performance.
- **One-click launch**: ships as a Windows executable, so there is nothing to install at the venue.

## Quick start (performers)

1. Put your video files (`.mp4`, `.webm`, `.mov`, `.m4v`) in the `videos` folder.
2. Double-click **Video Switcher.exe**. Chrome opens to the performance screen.
3. Press **F11** for fullscreen.
4. Press **H** to open the HUD and get to the setup page, where you can build or pick a loadout.
5. Press a bound key to switch visuals. **Esc** hides the HUD.

To stop the app, close the black server window.

## Controls

| Key | Action |
| --- | --- |
| Bound keys | Switch to that key's clip or webcam feed |
| `H` | Toggle the HUD |
| `Esc` | Hide the HUD |
| `F11` | Toggle fullscreen (browser) |

> Browsers block autoplay with sound until the page gets a key press, so the first clip may start muted. Pressing any bound key turns audio on.

## How it works

```
videos/            source clips (not committed)
loadouts/*.json    one file per show: key -> clip/webcam bindings
server.py          Python HTTP server: serves the player, videos, and a small loadouts REST API
index.html, js/    performance screen (vanilla JS player and keyboard runtime)
setup/             setup page source (React + TypeScript + Vite), built into setup-dist/
```

The server uses only the Python standard library and runs on `http://localhost:8000`.

| Endpoint | Description |
| --- | --- |
| `GET /api/videos` | List available video files |
| `GET /api/loadouts` | List saved loadouts |
| `GET /api/loadouts/{name}` | Get one loadout |
| `PUT /api/loadouts/{name}` | Create or update a loadout |
| `DELETE /api/loadouts/{name}` | Delete a loadout |

A loadout looks like this:

```json
{
  "name": "Default",
  "version": 1,
  "initial": { "type": "video", "src": "videos/static.mp4" },
  "bindings": {
    "1": { "type": "video", "src": "videos/1-intro-video.mp4", "label": "Intro Video" },
    "c": { "type": "webcam", "label": "Webcam" }
  }
}
```

## Development

Requires Python 3 and Node.js 20+.

```powershell
npm ci             # install repo tooling (commitlint, Husky, semantic-release)
npm run build      # install and build the setup app into setup-dist/
python server.py   # start the server at http://localhost:8000
```

The Windows executable is packaged with PyInstaller.
<!-- TODO: add the exact PyInstaller build command -->

### Commits and releases

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint and a Husky hook. Run `npm run commit` for a guided prompt (Commitizen).
- GitHub Actions validates commit messages on pull requests and builds every push.
- Merges to `main` run [semantic-release](https://github.com/semantic-release/semantic-release), which picks the version, updates [CHANGELOG.md](CHANGELOG.md), tags the release, and publishes a GitHub Release.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the full workflow.
