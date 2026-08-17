'use strict';

(function initializePlaylistDomain(root) {
  function safeBasename(value) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const separatorIndex = normalized.lastIndexOf('/');
    return normalized.slice(separatorIndex + 1) || '';
  }

  function parentBasename(value) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const separatorIndex = normalized.lastIndexOf('/');
    return separatorIndex > 0
      ? safeBasename(normalized.slice(0, separatorIndex))
      : '';
  }

  function playlistTitleForState({ mode, autoFolderPath = '', pairs = [] } = {}) {
    if (mode === 'auto') {
      return safeBasename(autoFolderPath) || 'Untitled Playlist';
    }

    if (mode === 'multi') {
      return parentBasename(pairs[0]?.audio?.path) || 'Untitled Playlist';
    }

    return 'Untitled Playlist';
  }

  function outputNameForPlaylist(title) {
    const safe = String(title || 'Untitled Playlist')
      .replace(/[^\p{L}\p{N}._ -]/gu, '-')
      .trim() || 'Untitled Playlist';
    return `${safe}.mp4`;
  }

  const api = {
    playlistTitleForState,
    outputNameForPlaylist,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SoundForgePlaylistDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
