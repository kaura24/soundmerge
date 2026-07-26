'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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

contextBridge.exposeInMainWorld('soundForge', Object.freeze({
  getAppInfo: () => ipcRenderer.invoke(CHANNELS.getAppInfo),
  open: (filePath) => ipcRenderer.invoke(CHANNELS.open, filePath),
  render: (request) => ipcRenderer.invoke(CHANNELS.render, request),
  renderMulti: (request) => ipcRenderer.invoke(CHANNELS.renderMulti, request),
  onRenderProgress: (callback) => {
    if (typeof callback !== 'function') {
      throw new TypeError('Progress callback must be a function.');
    }
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on(CHANNELS.renderProgress, listener);
    return () => ipcRenderer.removeListener(CHANNELS.renderProgress, listener);
  },
  reveal: (filePath) => ipcRenderer.invoke(CHANNELS.reveal, filePath),
  selectAudio: () => ipcRenderer.invoke(CHANNELS.selectAudio),
  selectAutoFolder: () => ipcRenderer.invoke(CHANNELS.selectAutoFolder),
  extractArtwork: (audioPath) =>
    ipcRenderer.invoke(CHANNELS.extractArtwork, audioPath),
  selectOutput: (suggestedName) =>
    ipcRenderer.invoke(CHANNELS.selectOutput, suggestedName),
  selectVisual: () => ipcRenderer.invoke(CHANNELS.selectVisual),
}));
