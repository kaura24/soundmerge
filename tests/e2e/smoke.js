'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');
const { registerIpcHandlers } = require('../../src/main/index');

async function run() {
  await app.whenReady();
  registerIpcHandlers();
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', '..', 'src', 'preload', 'index.js'),
    },
  });

  await window.loadFile(
    path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'),
  );

  const fixtureAudio = process.env.SOUND_FORGE_TEST_MP3;
  const fixtureImage = process.env.SOUND_FORGE_TEST_IMAGE;
  const fixtureVideo = process.env.SOUND_FORGE_TEST_VIDEO;
  const fixtureVisual = fixtureVideo || fixtureImage;
  const fixtureVisualKind = fixtureVideo ? 'video' : 'image';
  const fixturesLoaded = Boolean(fixtureAudio && fixtureVisual);
  if (fixturesLoaded) {
    const fixtureState = {
      audio: {
        path: fixtureAudio,
        fileUrl: pathToFileURL(fixtureAudio).href,
        name: path.basename(fixtureAudio),
        duration: 287.998685,
      },
      visual: {
        path: fixtureVisual,
        fileUrl: pathToFileURL(fixtureVisual).href,
        name: path.basename(fixtureVisual),
        kind: fixtureVisualKind,
        width: fixtureVideo ? 1280 : 3000,
        height: fixtureVideo ? 720 : 4000,
        duration: fixtureVideo ? 4.633333 : undefined,
      },
      outputPath: path.join(
        process.env.TEST_WORK_DIR || path.dirname(fixtureAudio),
        'sound-forge-smoke-output.mp4',
      ),
    };
    await window.webContents.executeJavaScript(`
      setAudio(${JSON.stringify(fixtureState.audio)});
      setVisual(${JSON.stringify(fixtureState.visual)});
      setOutput(${JSON.stringify(fixtureState.outputPath)});
      previewAudio.muted = true;
      Promise.all([
        new Promise((resolve, reject) => {
          if (previewAudio.readyState >= 1) {
            resolve();
          } else {
            previewAudio.addEventListener("loadedmetadata", resolve, { once: true });
            previewAudio.addEventListener("error", reject, { once: true });
          }
        }),
        new Promise((resolve, reject) => {
          const media = state.visual.kind === "video" ? previewVideo : previewImage;
          const isReady = state.visual.kind === "video"
            ? previewVideo.readyState >= 2
            : previewImage.complete && previewImage.naturalWidth > 0;
          if (isReady) {
            resolve();
          } else {
            media.addEventListener(
              state.visual.kind === "video" ? "loadeddata" : "load",
              resolve,
              { once: true }
            );
            media.addEventListener("error", reject, { once: true });
          }
        })
      ]).then(async () => {
        elements.timeline.value = "120.25";
        elements.timeline.dispatchEvent(new Event("input", { bubbles: true }));
        await playPreview();
        await new Promise((resolve) => setTimeout(resolve, 350));
        pausePreview();
        drawPreview();
        await new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
      });
    `);
  }

  const fixtureOutput = process.env.SOUND_FORGE_TEST_OUTPUT;
  if (fixtureOutput) {
    await window.webContents.executeJavaScript(`
      setOutput(${JSON.stringify(fixtureOutput)});
      elements.resultPlayer.muted = true;
      playOutputInApp().then(() => new Promise((resolve, reject) => {
        if (
          elements.resultPlayer.readyState >= 1 &&
          Number.isFinite(elements.resultPlayer.duration)
        ) {
          resolve();
          return;
        }
        elements.resultPlayer.addEventListener("loadedmetadata", resolve, {
          once: true
        });
        elements.resultPlayer.addEventListener("error", reject, { once: true });
      })).then(() => elements.resultPlayer.pause());
    `);
  }

  const result = await window.webContents.executeJavaScript(`({
    title: document.title,
    hasCanvas: Boolean(document.querySelector('#previewCanvas')),
    hasTimeline: Boolean(document.querySelector('#timeline')),
    hasArtworkOption: Boolean(document.querySelector('#useArtworkCheckbox')),
    hasBridge: typeof window.soundForge?.render === 'function',
    renderDisabled: document.querySelector('#renderButton')?.disabled,
    totalTime: document.querySelector('#totalTime')?.textContent,
    outputDuration: Number.isFinite(elements.resultPlayer.duration)
      ? elements.resultPlayer.duration
      : 0,
    previewTime: previewAudio.currentTime,
    previewVideoTime: previewVideo.currentTime,
    previewVideoDuration: Number.isFinite(previewVideo.duration)
      ? previewVideo.duration
      : 0,
    previewKind: state.visual?.kind || "",
    resultVisible: !elements.resultPlayer.hidden,
    canvasSample: Array.from(
      previewCanvas.getContext('2d').getImageData(
        Math.floor(previewCanvas.width / 2),
        Math.floor(previewCanvas.height / 2),
        1,
        1
      ).data
    )
  })`);

  if (
    result.title !== 'Sound Forge' ||
    !result.hasCanvas ||
    !result.hasTimeline ||
    !result.hasArtworkOption ||
    !result.hasBridge ||
    result.renderDisabled !== !fixturesLoaded ||
    (fixturesLoaded && result.totalTime !== '04:47') ||
    (fixturesLoaded && result.previewTime <= 120.25) ||
    (fixturesLoaded &&
      result.previewKind === 'video' &&
      (result.previewVideoDuration <= 0 ||
        Math.abs(
          result.previewVideoTime -
            (result.previewTime % result.previewVideoDuration),
        ) > 0.5)) ||
    (fixtureOutput &&
      (!result.resultVisible || result.outputDuration < 240)) ||
    (fixturesLoaded &&
      result.canvasSample.slice(0, 3).reduce((sum, value) => sum + value, 0) <=
        30)
  ) {
    throw new Error(`Renderer smoke check failed: ${JSON.stringify(result)}`);
  }

  if (process.env.SOUND_FORGE_SMOKE_SCREENSHOT) {
    const screenshot = await window.capturePage();
    await fs.writeFile(
      process.env.SOUND_FORGE_SMOKE_SCREENSHOT,
      screenshot.toPNG(),
    );
  }

  const resetResult = await window.webContents.executeJavaScript(`
    resetSession();
    ({
      renderDisabled: document.querySelector('#renderButton')?.disabled,
      playDisabled: document.querySelector('#playPauseButton')?.disabled,
      audioName: document.querySelector('#audioName')?.textContent,
      visualName: document.querySelector('#visualName')?.textContent,
      outputName: document.querySelector('#outputName')?.textContent,
      artworkDisabled: document.querySelector('#useArtworkCheckbox')?.disabled,
      resultHidden: elements.resultPlayer.hidden
    })
  `);

  process.stdout.write(`Renderer smoke check passed: ${JSON.stringify(result)}\n`);
  if (
    !resetResult.renderDisabled ||
    !resetResult.playDisabled ||
    resetResult.audioName !== 'Choose an audio file' ||
    resetResult.visualName !== 'Choose a visual file' ||
    resetResult.outputName !== 'Choose destination' ||
    !resetResult.artworkDisabled ||
    !resetResult.resultHidden
  ) {
    throw new Error(`Renderer reset check failed: ${JSON.stringify(resetResult)}`);
  }
  window.destroy();
  app.quit();
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  app.exit(1);
});
