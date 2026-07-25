'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = Object.freeze({
  getAppInfo: 'sound-forge:get-app-info',
  open: 'sound-forge:open',
  render: 'sound-forge:render',
  renderMulti: 'sound-forge:render-multi',
  reveal: 'sound-forge:reveal',
  selectAudio: 'sound-forge:select-audio',
  extractArtwork: 'sound-forge:extract-artwork',
  selectOutput: 'sound-forge:select-output',
  selectVisual: 'sound-forge:select-visual',
});

contextBridge.exposeInMainWorld('soundForge', Object.freeze({
  getAppInfo: () => ipcRenderer.invoke(CHANNELS.getAppInfo),
  open: (filePath) => ipcRenderer.invoke(CHANNELS.open, filePath),
  render: (request) => ipcRenderer.invoke(CHANNELS.render, request),
  renderMulti: (request) => ipcRenderer.invoke(CHANNELS.renderMulti, request),
  reveal: (filePath) => ipcRenderer.invoke(CHANNELS.reveal, filePath),
  selectAudio: () => ipcRenderer.invoke(CHANNELS.selectAudio),
  extractArtwork: (audioPath) =>
    ipcRenderer.invoke(CHANNELS.extractArtwork, audioPath),
  selectOutput: (suggestedName) =>
    ipcRenderer.invoke(CHANNELS.selectOutput, suggestedName),
  selectVisual: () => ipcRenderer.invoke(CHANNELS.selectVisual),
}));
