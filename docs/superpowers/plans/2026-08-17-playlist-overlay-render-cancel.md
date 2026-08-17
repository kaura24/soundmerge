# Playlist Overlay and Render Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Auto/Multi playlist overlays, selectable A/B/E title-card templates at 3 or 5 seconds, safe render cancellation, then validate the macOS Universal app on Intel and Apple Silicon without publishing build binaries yet.

**Architecture:** Keep playlist-title and title-card selections in the renderer state model, pass validated values and generated transparent PNG overlays through the existing renderer→preload→main IPC path, and extend the existing FFmpeg process wrapper with a cancellation handle. The Electron main process owns process cancellation and window-close coordination; the renderer only requests cancellation and resets UI state.

**Tech Stack:** Electron, vanilla renderer JavaScript/HTML/CSS, Node `child_process.spawn`, FFmpeg/FFprobe, Node test runner, electron-builder Universal macOS target.

---

### Task 1: Add pure playlist-title and output-name helpers

**Files:**
- Modify: `src/renderer/renderer.js` near `basename()` and `outputSuggestion()`
- Test: `tests/unit/renderer-domain.test.js`

- [ ] **Step 1: Write failing helper tests**

Add tests for the pure rules:

```js
test('playlist title uses the selected Auto Pair folder basename', () => {
  assert.equal(playlistTitleForState({ mode: 'auto', autoFolderPath: '/music/앨범A', pairs: [] }), '앨범A');
});

test('Multi-Pair keeps the first pair parent folder as its playlist title', () => {
  assert.equal(
    playlistTitleForState({
      mode: 'multi',
      pairs: [{ audio: { path: '/music/앨범A/01.mp3' } }, { audio: { path: '/music/앨범B/02.mp3' } }],
    }),
    '앨범A',
  );
});

test('playlist title falls back safely before a folder or pair exists', () => {
  assert.equal(playlistTitleForState({ mode: 'auto', autoFolderPath: '', pairs: [] }), 'Untitled Playlist');
  assert.equal(outputNameForPlaylist('앨범A'), '앨범A.mp4');
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `node --test tests/unit/renderer-domain.test.js`. Expected: fail because the helpers do not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

Create the testable helper module `src/shared/playlist-domain.js`:

```js
const path = require('node:path');

function safeBasename(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
  return path.posix.basename(normalized) || '';
}

function playlistTitleForState({ mode, autoFolderPath = '', pairs = [] }) {
  if (mode === 'auto') return safeBasename(autoFolderPath) || 'Untitled Playlist';
  if (mode === 'multi') {
    return safeBasename(path.posix.dirname(String(pairs[0]?.audio?.path || '').replace(/\\/g, '/'))) || 'Untitled Playlist';
  }
  return 'Untitled Playlist';
}

function outputNameForPlaylist(title) {
  const safe = String(title || 'Untitled Playlist')
    .replace(/[^\p{L}\p{N}._ -]/gu, '-')
    .trim() || 'Untitled Playlist';
  return `${safe}.mp4`;
}

module.exports = { playlistTitleForState, outputNameForPlaylist };
```

Import these helpers from the renderer and use `outputNameForPlaylist(playlistTitleForState(state))` in `outputSuggestion()`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run `node --test tests/unit/renderer-domain.test.js`. Expected: all title and filename assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/playlist-domain.js src/renderer/renderer.js tests/unit/renderer-domain.test.js
git commit -m "feat: derive playlist titles from pair folders"
```

### Task 2: Render the A안 playlist overlay in preview and FFmpeg output

**Files:**
- Modify: `src/renderer/renderer.js` (`drawPreview`, title-badge canvas helpers, `renderMaster`)
- Modify: `src/main/index.js` (badge payload handling)
- Modify: `src/main/media-service.js` (`buildVisualFilter` and still-image badge composition)
- Modify: `src/preload/index.js` only if the request shape changes
- Test: `tests/unit/media-service.test.js`, `tests/e2e/smoke.js`

- [ ] **Step 1: Add failing filter assertions**

Extend media-service tests to assert that the generated filter contains a left-top playlist overlay input positioned with a 40px margin and the existing song-title badge remains at the right top. Assert that no playlist overlay is passed for Single Pair.

- [ ] **Step 2: Implement a separate playlist PNG generator**

Add a renderer helper that draws the A안 layout to a transparent canvas: 3–4px amber vertical rail, `PLAYLIST` mono label, and large folder title. Scale from a 1920×1080 design coordinate system, with a max width and ellipsis for long names. Keep `getTitleBadgeDataUrl()` for the existing right-top song badge.

- [ ] **Step 3: Pass playlist overlay data only for Auto/Multi**

In `renderMaster()`, compute `playlistTitleForState(state)`, create `playlistBadgeDataUrl` for pair modes, and include it in `renderMulti({ playlistBadgeDataUrl, ... })`. Leave the Single Pair request unchanged.

- [ ] **Step 4: Add the second overlay input to main-process rendering**

Decode and clean the playlist PNG beside existing temporary badge PNGs. Extend `buildVisualFilter({ badgePath, playlistBadgePath })` so the final video graph applies playlist at `x=40:y=40` and the song title at `x=W-w-40:y=40`. For still-image Multi-Pair segments, precompose both overlays once before encoding the segment.

- [ ] **Step 5: Verify preview and smoke contract**

Render a preview with a representative Auto Pair title and assert the canvas remains playable. Add smoke assertions for the playlist title element/state and the multi-render request shape without requiring external media.

- [ ] **Step 6: Run focused tests and commit**

Run `node --test tests/unit/media-service.test.js tests/unit/renderer-domain.test.js` and `npm run test:smoke`. Expected: all filter, title, and renderer bridge assertions pass.

```bash
git add src/renderer/renderer.js src/main/index.js src/main/media-service.js src/preload/index.js tests/unit/media-service.test.js tests/e2e/smoke.js
git commit -m "feat: add playlist overlay to pair renders"
```

### Task 2A: Add selectable A/B/E title-card openings

**Files:**
- Modify: `src/renderer/index.html` (Auto/Multi title-card template and 3/5-second controls)
- Modify: `src/renderer/renderer.js` (template state, preview scene, render request)
- Modify: `src/renderer/styles.css` (template selector and duration controls)
- Modify: `src/main/index.js` (validated title-card request and temporary overlay handling)
- Modify: `src/main/media-service.js` (silent visual opening and audio-from-zero composition)
- Test: `tests/unit/media-service.test.js`, `tests/e2e/smoke.js`

- [ ] **Step 1: Write failing title-card tests**

Assert that only `editorial`, `split`, and `warm` are accepted, durations are only `3` or `5`, the opening filter loops the generated title frame for the selected duration, and the original MP3 remains mapped from timestamp zero.

- [ ] **Step 2: Add the renderer controls and state**

Add a pair-mode-only template selector with A/B/E labels and a duration selector with 3s/5s. Default to A and 5 seconds. Store `titleCardTemplate` and `titleCardDuration` in state and reset them with the session.

- [ ] **Step 3: Generate the three title-card frames**

Create a transparent/opaque title-card canvas generator with these exact layouts: A amber rail and serif title, B split dark panel and image side, E warm poster diagonal. Use the same folder title and playlist label as the final overlay. Preview the frame before the first pair while retaining the existing pair timeline.

- [ ] **Step 4: Compose the opening in the main process**

Validate template/duration, save the generated title-card PNG in the temp directory, and prepend a looping still-image segment of the chosen duration before the existing pair segments. Keep the same MP3 audio input starting at `0`, so the title card is silent visually and the final duration remains the soundtrack duration. For Multi-Pair, title-card video uses the first pair’s playlist title and then concatenates pair segments without adding a second audio stream.

- [ ] **Step 5: Verify both output modes**

Add unit assertions for the filter/concat order and E2E assertions for the three template controls, default A/5s state, and render request payload. Run the focused tests and commit.

```bash
git add src/renderer/index.html src/renderer/renderer.js src/renderer/styles.css src/main/index.js src/main/media-service.js tests/unit/media-service.test.js tests/e2e/smoke.js
git commit -m "feat: add selectable title card openings"
```

### Task 3: Add cancellable FFmpeg processes and renderer cancel control

**Files:**
- Modify: `src/main/media-service.js` (`runProcess`, `createMediaFile`, `createMultiPairMediaFile`)
- Modify: `src/main/index.js` (cancel IPC, active render handle, cleanup)
- Modify: `src/preload/index.js` (cancel bridge)
- Modify: `src/renderer/index.html` (busy-panel cancel button)
- Modify: `src/renderer/renderer.js` (`setBusy`, `renderMaster`, cancel handler)
- Modify: `src/renderer/styles.css` (cancel button state)
- Test: `tests/unit/media-service.test.js`, `tests/e2e/smoke.js`

- [ ] **Step 1: Write failing cancellation tests**

Test `runProcess()` with a fake child exposing `kill()` and assert that a cancellation handle sends `SIGTERM`, rejects with `code: 'PROCESS_CANCELLED'`, and never resolves successfully. Test Multi-Pair cancellation between segments and during concat; assert temp/stage cleanup is attempted.

- [ ] **Step 2: Implement a process cancellation handle**

Have `runProcess()` return `{ promise, cancel }` when requested, retain the child reference, and make `cancel()` idempotent. On a cancelled close, reject a `MediaProcessError` with `PROCESS_CANCELLED` and the signal used.

- [ ] **Step 3: Thread cancellation through single and multi renders**

Pass a shared render context into `createMediaFile()` and `createMultiPairMediaFile()`. Check `context.cancelled` before each FFmpeg invocation and after each awaited process. Keep `finally` cleanup deterministic for stage directories, temporary output, and both overlay PNGs.

- [ ] **Step 4: Add cancel IPC and UI**

Add `sound-forge:cancel-render`, expose `cancelRender()` through preload, and add a visible `Cancel render` button inside `busyPanel`. Disable source pickers while busy, but keep the cancel button enabled. On cancellation, hide busy state, reset progress, preserve selected source paths, and show a non-error “Render cancelled” status.

- [ ] **Step 5: Test the cancel flow**

Run focused unit tests and smoke assertions for the button, bridge method, and cancelled-state reset. Expected: no completion card appears after cancel and no temporary output is treated as a successful result.

- [ ] **Step 6: Commit**

```bash
git add src/main/media-service.js src/main/index.js src/preload/index.js src/renderer/index.html src/renderer/renderer.js src/renderer/styles.css tests/unit/media-service.test.js tests/e2e/smoke.js
git commit -m "feat: support cancelling active renders"
```

### Task 4: Cancel on window close and preserve single-instance behavior

**Files:**
- Modify: `src/main/index.js` (`createMainWindow`, active render close coordination)
- Test: `tests/e2e/smoke.js`

- [ ] **Step 1: Add the close-state test**

Assert that a close event during an active render calls the active cancellation handle once, waits for cleanup, and then closes. Assert that a second application launch focuses the existing window and does not create a second BrowserWindow.

- [ ] **Step 2: Implement guarded close coordination**

Register `window.on('close', event => { ... })`. When a render is active and cleanup has not started, prevent the first close, request cancellation, await the render promise’s `finally`, then call `window.destroy()`. Guard against repeated close events and renderer destruction.

- [ ] **Step 3: Run E2E smoke and commit**

Run `npm run test:smoke`. Expected: close cancellation and single-instance assertions pass.

```bash
git add src/main/index.js tests/e2e/smoke.js
git commit -m "feat: cancel render when closing the app"
```

### Task 5: Full test, Universal build, and architecture verification

**Files/paths:**
- Modify only if test/build failures require a targeted fix.
- Use external paths from `local.paths.env`: `LOCAL_ROOT`, `MACOS_BUILD_DIR`, `TEST_WORK_DIR`, `RELEASE_DIR`.

- [ ] **Step 1: Run preflight and the complete test suite**

Run `./scripts/setup/preflight`, then `npm test`, `npm run test:integration` if the directory exists, and `npm run test:smoke`. Expected: preflight has zero failures and all available suites pass.

- [ ] **Step 2: Build the macOS Universal app outside the Drive project tree**

Source the non-secret path file and run the existing Universal target:

```bash
set -a
. ./local.paths.env
set +a
npm run package:mac
```

Expected: the configured `MACOS_BUILD_DIR` contains one Universal `.app` with bundled FFmpeg/FFprobe.

- [ ] **Step 3: Verify both Mach-O architectures and bundled tools**

Run `file <app>/Contents/MacOS/<executable>`, `lipo -info <app>/Contents/MacOS/<executable>`, and the equivalent checks for bundled `ffmpeg` and `ffprobe`. Expected: `x86_64` and `arm64` are both present.

- [ ] **Step 4: Run Intel and Apple Silicon three-track smoke/render checks**

Run the packaged app on each available architecture with three approved real MP3/artwork pairs, verify the app launches, numeric filename order is 1→2→3, the selected A/B/E title-card opening appears, the left-top playlist overlay and per-track right-top badge appear across all three tracks, a three-track render completes, a cancelled render leaves no partial final output, and the resulting MP4 has H.264 video plus AAC audio. Record only the final summary in `test-results/`.

- [ ] **Step 5: Commit only source/test/document changes**

Do not stage `.app`, `.dmg`, build caches, raw logs, or test artifacts. The final build remains in the external build workspace until the user separately approves a GitHub Release upload.
