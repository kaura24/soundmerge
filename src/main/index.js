'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} = require('electron');

const { resolveBinaryPaths } = require('./binary-paths');
const {
  createMediaFile,
  createMultiPairMediaFile,
  artworkExtension,
  extractEmbeddedArtwork,
  findEmbeddedArtwork,
  inspectInputs,
  inspectMultiPairInputs,
  metadataDuration,
  prepareAutoPairInputs,
  probeMedia,
  validateProbeMetadata,
} = require('./media-service');
const { classifyVisualPath } = require('../shared/media-domain');

const CHANNELS = Object.freeze({
  getAppInfo: 'sound-forge:get-app-info',
  open: 'sound-forge:open',
  render: 'sound-forge:render',
  renderMulti: 'sound-forge:render-multi',
  renderProgress: 'sound-forge:render-progress',
  reveal: 'sound-forge:reveal',
  selectAudio: 'sound-forge:select-audio',
  selectAutoFolder: 'sound-forge:select-auto-folder',
  extractArtwork: 'sound-forge:extract-artwork',
  selectOutput: 'sound-forge:select-output',
  selectVisual: 'sound-forge:select-visual',
});

let mainWindow = null;
let renderActive = false;

function fileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

async function saveTempBadgeImage(badgeDataUrl, targetDir) {
  if (
    !badgeDataUrl ||
    typeof badgeDataUrl !== 'string' ||
    !badgeDataUrl.startsWith('data:image/png;base64,')
  ) {
    return null;
  }
  const base64Data = badgeDataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  const tempPath = path.join(targetDir, `.badge-${randomUUID()}.tmp.png`);
  await fs.promises.writeFile(tempPath, buffer);
  return tempPath;
}

function streamOfType(metadata, type) {
  return metadata.streams.find((stream) => stream.codec_type === type);
}

function selectedMedia(filePath, inspection, kind) {
  const metadata = kind === 'audio' ? inspection.audio : inspection.visual;
  const stream = streamOfType(
    metadata,
    kind === 'audio' ? 'audio' : 'video',
  );

  return {
    path: filePath,
    fileUrl: fileUrl(filePath),
    name: path.basename(filePath),
    kind: kind === 'audio' ? 'audio' : inspection.visualType,
    duration:
      kind === 'audio'
        ? inspection.audioDuration
        : Number(metadata.format.duration || stream.duration || 0),
    width: Number(stream.width || 0),
    height: Number(stream.height || 0),
    codec: stream.codec_name,
    title:
      kind === 'audio' && typeof metadata.format?.tags?.title === 'string'
        ? metadata.format.tags.title
        : '',
    hasEmbeddedArtwork:
      kind === 'audio' && Boolean(findEmbeddedArtwork(metadata)),
  };
}

function dialogOwner(event) {
  return BrowserWindow.fromWebContents(event.sender) || mainWindow || undefined;
}

function registerIpcHandlers() {
  for (const channel of Object.values(CHANNELS)) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(CHANNELS.getAppInfo, () => ({
    name: app.getName(),
    version: app.getVersion(),
  }));

  ipcMain.handle(CHANNELS.selectAudio, async (event) => {
    const selection = await dialog.showOpenDialog(dialogOwner(event), {
      title: 'Choose the master MP3',
      properties: ['openFile'],
      filters: [{ name: 'MP3 audio', extensions: ['mp3'] }],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const audioPath = selection.filePaths[0];
    const { ffprobePath } = resolveBinaryPaths({ app });
    const audioProbe = await probeMedia(audioPath, {
      ffprobePath,
    });
    validateProbeMetadata('audio', audioProbe, audioPath);

    const inspection = {
      audio: audioProbe,
      audioDuration: metadataDuration(audioProbe, 'audio'),
    };
    return selectedMedia(audioPath, inspection, 'audio');
  });

  ipcMain.handle(CHANNELS.selectAutoFolder, async (event) => {
    const selection = await dialog.showOpenDialog(dialogOwner(event), {
      title: 'Choose a folder of MP3 tracks',
      properties: ['openDirectory'],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const folderPath = selection.filePaths[0];
    const { ffmpegPath, ffprobePath } = resolveBinaryPaths({ app });
    const preparedPairs = await prepareAutoPairInputs({
      folderPath,
      workRoot: app.getPath('temp'),
      ffmpegPath,
      ffprobePath,
    });

    return {
      folderPath,
      pairs: preparedPairs.map((pair) => ({
        audio: selectedMedia(
          pair.audioPath,
          {
            audio: pair.audio,
            audioDuration: pair.duration,
          },
          'audio',
        ),
        visual: {
          path: pair.visualPath,
          fileUrl: fileUrl(pair.visualPath),
          name: `Embedded artwork · ${path.basename(pair.audioPath)}`,
          kind: 'image',
          duration: 0,
          width: Number(pair.artwork.width || 0),
          height: Number(pair.artwork.height || 0),
          codec: pair.artwork.codec_name,
          source: 'audio-artwork',
        },
      })),
    };
  });

  ipcMain.handle(CHANNELS.extractArtwork, async (_event, audioPath) => {
    const { ffmpegPath, ffprobePath } = resolveBinaryPaths({ app });
    const audioProbe = await probeMedia(audioPath, { ffprobePath });
    validateProbeMetadata('audio', audioProbe, audioPath);
    const artwork = findEmbeddedArtwork(audioProbe);
    if (!artwork) {
      throw new Error('The selected MP3 does not contain embedded artwork.');
    }

    const outputPath = path.join(
      app.getPath('temp'),
      `sound-forge-artwork-${randomUUID()}${artworkExtension(artwork)}`,
    );
    await extractEmbeddedArtwork({
      ffmpegPath,
      audioPath,
      streamIndex: artwork.index,
      outputPath,
    });

    return {
      path: outputPath,
      fileUrl: fileUrl(outputPath),
      name: `Embedded artwork · ${path.basename(audioPath)}`,
      kind: 'image',
      duration: 0,
      width: Number(artwork.width || 0),
      height: Number(artwork.height || 0),
      codec: artwork.codec_name,
      source: 'audio-artwork',
    };
  });

  ipcMain.handle(CHANNELS.selectVisual, async (event) => {
    const selection = await dialog.showOpenDialog(dialogOwner(event), {
      title: 'Choose an image or H.264 MP4',
      properties: ['openFile'],
      filters: [
        {
          name: 'Images and H.264 video',
          extensions: ['jpg', 'jpeg', 'png', 'mp4'],
        },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      return null;
    }

    const visualPath = selection.filePaths[0];
    const visualType = classifyVisualPath(visualPath);
    const { ffprobePath } = resolveBinaryPaths({ app });
    const visualProbe = await probeMedia(visualPath, {
      ffprobePath,
    });
    validateProbeMetadata(visualType, visualProbe, visualPath);

    return selectedMedia(
      visualPath,
      { visual: visualProbe, visualType },
      'visual',
    );
  });

  ipcMain.handle(CHANNELS.selectOutput, async (event, suggestedName) => {
    const safeName =
      path.basename(String(suggestedName || 'sound-forge-master.mp4'))
        .replace(/[^\p{L}\p{N}._ -]/gu, '-')
        .replace(/\.mp4$/i, '') || 'sound-forge-master';
    const selection = await dialog.showSaveDialog(dialogOwner(event), {
      title: 'Save the YouTube master',
      defaultPath: `${safeName}.mp4`,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (selection.canceled || !selection.filePath) {
      return null;
    }

    const outputPath = selection.filePath.toLowerCase().endsWith('.mp4')
      ? selection.filePath
      : `${selection.filePath}.mp4`;
    return { outputPath };
  });

  ipcMain.handle(CHANNELS.render, async (_event, request) => {
    if (renderActive) {
      throw new Error('A render is already running.');
    }
    renderActive = true;
    let badgePath = null;

    try {
      const { ffmpegPath, ffprobePath } = resolveBinaryPaths({ app });
      const targetDir = path.dirname(path.resolve(request.outputPath));
      badgePath = await saveTempBadgeImage(request.badgeDataUrl, targetDir);

      const inspection = await inspectInputs(
        {
          audioPath: request.audioPath,
          visualPath: request.visualPath,
          badgePath,
        },
        { ffprobePath },
      );
      if (
        request.visualKind &&
        request.visualKind !== inspection.visualType
      ) {
        throw new Error('The selected visual type changed before rendering.');
      }

      const outputPath = await createMediaFile({
        ffmpegPath,
        audioPath: inspection.audioPath,
        visualPath: inspection.visualPath,
        visualType: inspection.visualType,
        duration: inspection.audioDuration,
        outputPath: request.outputPath,
        badgePath: inspection.badgePath,
        overwrite: true,
      });
      return {
        success: true,
        outputPath,
        fileUrl: fileUrl(outputPath),
      };
    } finally {
      renderActive = false;
      if (badgePath) {
        await fs.promises.rm(badgePath, { force: true }).catch(() => {});
      }
    }
  });

  ipcMain.handle(CHANNELS.renderMulti, async (event, request) => {
    if (renderActive) {
      throw new Error('A render is already running.');
    }
    renderActive = true;
    const tempBadgePaths = [];

    try {
      const { ffmpegPath, ffprobePath } = resolveBinaryPaths({ app });
      const targetDir = path.dirname(path.resolve(request.outputPath));
      const pairsWithBadges = await Promise.all(
        request.pairs.map(async (pair) => {
          const badgePath = await saveTempBadgeImage(pair.badgeDataUrl, targetDir);
          if (badgePath) {
            tempBadgePaths.push(badgePath);
          }
          return { ...pair, badgePath };
        }),
      );

      const inspection = await inspectMultiPairInputs(pairsWithBadges, {
        ffprobePath,
      });

      const outputPath = await createMultiPairMediaFile({
        ffmpegPath,
        pairs: inspection.pairs,
        outputPath: request.outputPath,
        workRoot: app.getPath('temp'),
        overwrite: true,
        onProgress: (progress) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(CHANNELS.renderProgress, progress);
          }
        },
      });
      return {
        success: true,
        outputPath,
        fileUrl: fileUrl(outputPath),
      };
    } finally {
      renderActive = false;
      for (const p of tempBadgePaths) {
        await fs.promises.rm(p, { force: true }).catch(() => {});
      }
    }
  });

  ipcMain.handle(CHANNELS.open, async (_event, filePath) => {
    if (!filePath) {
      throw new Error('No rendered output is available.');
    }
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    return true;
  });

  ipcMain.handle(CHANNELS.reveal, (_event, filePath) => {
    if (!filePath) {
      throw new Error('No rendered output is available.');
    }
    shell.showItemInFolder(filePath);
    return true;
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    center: true,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#18181c',
    title: 'Sound Forge',
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  });

  window.loadFile(path.join(__dirname, '..', 'renderer', 'index.html')).catch((error) => {
    console.error('[Sound Forge] Failed to load renderer:', error);
  });

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(
      `[Sound Forge] Renderer failed to load (${errorCode}): ${errorDescription}`,
    );
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      `[Sound Forge] Renderer exited (${details.reason}, ${details.exitCode}).`,
    );
  });

  window.once('ready-to-show', () => {
    if (app.dock) {
      app.dock.show();
    }
    app.focus({ steal: true });
    window.show();
    window.focus();
    window.moveTop();
  });

  setTimeout(() => {
    if (!window.isDestroyed()) {
      window.setAlwaysOnTop(false);
    }
  }, 1500);

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
  mainWindow = window;
  return window;
}

async function startApplication() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}

startApplication().catch((error) => {
  console.error('[Sound Forge] Failed to start:', error);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  CHANNELS,
  createMainWindow,
  registerIpcHandlers,
  selectedMedia,
  startApplication,
};
