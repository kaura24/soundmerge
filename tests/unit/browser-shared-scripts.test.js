'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('shared playlist and title-card scripts load without require or global lexical collisions', () => {
  const context = vm.createContext({});
  context.globalThis = context;
  const sharedRoot = path.resolve(__dirname, '../../src/shared');

  vm.runInContext(
    fs.readFileSync(path.join(sharedRoot, 'playlist-domain.js'), 'utf8'),
    context,
  );
  vm.runInContext(
    fs.readFileSync(path.join(sharedRoot, 'title-card-domain.js'), 'utf8'),
    context,
  );
  vm.runInContext(
    'const playlistDomain = globalThis.SoundForgePlaylistDomain;' +
      'const titleCardDomain = globalThis.SoundForgeTitleCardDomain;',
    context,
  );

  assert.equal(
    context.SoundForgePlaylistDomain.playlistTitleForState({
      mode: 'auto',
      autoFolderPath: '/music/List1',
    }),
    'List1',
  );
  assert.equal(
    context.SoundForgeTitleCardDomain.normalizeTitleCardTemplate('warm'),
    'warm',
  );
});
