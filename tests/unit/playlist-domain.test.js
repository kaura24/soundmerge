'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  playlistTitleForState,
  outputNameForPlaylist,
} = require('../../src/shared/playlist-domain');

test('playlist title uses the selected Auto Pair folder basename', () => {
  assert.equal(
    playlistTitleForState({
      mode: 'auto',
      autoFolderPath: '/music/앨범A',
      pairs: [],
    }),
    '앨범A',
  );
});

test('Multi-Pair keeps the first pair parent folder as its playlist title', () => {
  assert.equal(
    playlistTitleForState({
      mode: 'multi',
      pairs: [
        { audio: { path: '/music/앨범A/01.mp3' } },
        { audio: { path: '/music/앨범B/02.mp3' } },
      ],
    }),
    '앨범A',
  );
});

test('playlist title falls back safely before a folder or pair exists', () => {
  assert.equal(
    playlistTitleForState({ mode: 'auto', autoFolderPath: '', pairs: [] }),
    'Untitled Playlist',
  );
  assert.equal(outputNameForPlaylist('앨범A'), '앨범A.mp4');
});
