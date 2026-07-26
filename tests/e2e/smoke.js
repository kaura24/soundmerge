'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const mainWindowCreated = new Promise((resolve) => {
  app.once('browser-window-created', (_event, window) => resolve(window));
});

require('../../src/main/index');

function withTimeout(promise, message, timeoutMs = 5000) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function waitForRenderer(window) {
  const expectedSuffix = '/src/renderer/index.html';
  if (
    !window.webContents.isLoadingMainFrame() &&
    window.webContents.getURL().endsWith(expectedSuffix)
  ) {
    return;
  }

  await withTimeout(
    new Promise((resolve, reject) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.once(
        'did-fail-load',
        (_event, errorCode, errorDescription) => {
          reject(
            new Error(
              `Production renderer failed to load (${errorCode}): ${errorDescription}`,
            ),
          );
        },
      );
    }),
    'Production renderer did not finish loading within 5 seconds.',
  );
}

async function run() {
  const window = await withTimeout(
    mainWindowCreated,
    'Production startup did not create a BrowserWindow within 5 seconds.',
  );
  await waitForRenderer(window);

  const windows = BrowserWindow.getAllWindows();
  if (windows.length !== 1 || windows[0] !== window) {
    throw new Error(
      `Production startup created ${windows.length} windows instead of one.`,
    );
  }

  const badgeOutputDir = process.env.SOUND_FORGE_BADGE_OUTPUT_DIR;
  const badgeTitlesJson = process.env.SOUND_FORGE_BADGE_TITLES;
  if (badgeOutputDir && badgeTitlesJson) {
    const badgeTitles = JSON.parse(badgeTitlesJson);
    await fs.mkdir(badgeOutputDir, { recursive: true });
    for (let index = 0; index < badgeTitles.length; index += 1) {
      const dataUrl = await window.webContents.executeJavaScript(
        `getTitleBadgeDataUrl(${JSON.stringify(String(badgeTitles[index]))})`,
      );
      const outputPath = path.join(
        badgeOutputDir,
        `badge-${String(index + 1).padStart(4, '0')}.png`,
      );
      await fs.writeFile(
        outputPath,
        Buffer.from(dataUrl.split(',')[1], 'base64'),
      );
      process.stdout.write(`Badge fixture retained: ${outputPath}\n`);
    }
  }

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
    pageUrl: window.location.href,
    bodyTextLength: document.body.innerText.trim().length,
    visibleElementCount: Array.from(document.querySelectorAll("body *")).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }).length,
    hasCanvas: Boolean(document.querySelector('#previewCanvas')),
    hasTimeline: Boolean(document.querySelector('#timeline')),
    hasArtworkOption: Boolean(document.querySelector('#useArtworkCheckbox')),
    hasBridge: typeof window.soundForge?.render === 'function',
    hasAutoBridge: typeof window.soundForge?.selectAutoFolder === 'function',
    hasAutoFolderPicker: Boolean(document.querySelector('#selectAutoFolderBtn')),
    hasRenderProgress: Boolean(document.querySelector('#renderProgress')),
    autoModeVisible: (() => {
      switchMode("auto");
      const visible = !document.querySelector('#autoModeSection').hidden;
      switchMode("single");
      return visible;
    })(),
    autoBadgeOptional: (() => {
      switchMode("auto");
      const checkbox = document.querySelector('#showTitleBadgeCheckbox');
      const selectable = checkbox?.disabled === false;
      checkbox?.click();
      const enabled = checkbox?.checked === true && state.showTitleBadge === true;
      checkbox?.click();
      switchMode("single");
      return selectable && enabled;
    })(),
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
    !result.pageUrl.endsWith('/src/renderer/index.html') ||
    result.bodyTextLength < 100 ||
    result.visibleElementCount < 20 ||
    !result.hasCanvas ||
    !result.hasTimeline ||
    !result.hasArtworkOption ||
    !result.hasBridge ||
    !result.hasAutoBridge ||
    !result.hasAutoFolderPicker ||
    !result.hasRenderProgress ||
    !result.autoModeVisible ||
    !result.autoBadgeOptional ||
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
