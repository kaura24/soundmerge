'use strict';

const path = require('node:path');

function safeBasename(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
  return path.posix.basename(normalized) || '';
}

function playlistTitleForState({ mode, autoFolderPath = '', pairs = [] } = {}) {
  if (mode === 'auto') {
    return safeBasename(autoFolderPath) || 'Untitled Playlist';
  }

  if (mode === 'multi') {
    const firstAudioPath = String(pairs[0]?.audio?.path || '').replace(/\\/g, '/');
    return safeBasename(path.posix.dirname(firstAudioPath)) || 'Untitled Playlist';
  }

  return 'Untitled Playlist';
}

function outputNameForPlaylist(title) {
  const safe = String(title || 'Untitled Playlist')
    .replace(/[^\p{L}\p{N}._ -]/gu, '-')
    .trim() || 'Untitled Playlist';
  return `${safe}.mp4`;
}

const playlistDomain = {
  playlistTitleForState,
  outputNameForPlaylist,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = playlistDomain;
}

if (typeof globalThis !== 'undefined') {
  globalThis.SoundForgePlaylistDomain = playlistDomain;
}
