'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  resolveBinaryPath,
  resolveBinaryPaths,
} = require('../../src/main/binary-paths');

test('resolveBinaryPath honors an explicit environment override', () => {
  const resolved = resolveBinaryPath('ffmpeg', {
    env: { SOUND_FORGE_FFMPEG_PATH: '/opt/media/ffmpeg' },
    existsSync: (candidate) => candidate === '/opt/media/ffmpeg',
  });

  assert.equal(resolved, '/opt/media/ffmpeg');
});

test('resolveBinaryPaths selects packaged extraResources media tools', () => {
  const resourcesPath = '/Applications/Sound Forge.app/Contents/Resources';
  const expectedFfmpeg = path.join(resourcesPath, 'media-tools', 'ffmpeg');
  const expectedFfprobe = path.join(resourcesPath, 'media-tools', 'ffprobe');

  const resolved = resolveBinaryPaths({
    isPackaged: true,
    resourcesPath,
    platform: 'darwin',
    arch: 'arm64',
    env: {},
    existsSync: (candidate) =>
      candidate === expectedFfmpeg || candidate === expectedFfprobe,
  });

  assert.deepEqual(resolved, {
    ffmpegPath: expectedFfmpeg,
    ffprobePath: expectedFfprobe,
  });
});

test('resolveBinaryPaths selects development media tools from the app path', () => {
  const appPath = '/work/sound-forge';
  const expectedFfmpeg = path.join(
    appPath,
    'vendor',
    'media-tools',
    'ffmpeg',
  );
  const expectedFfprobe = path.join(
    appPath,
    'vendor',
    'media-tools',
    'ffprobe',
  );

  const resolved = resolveBinaryPaths({
    isPackaged: false,
    appPath,
    platform: 'darwin',
    arch: 'x64',
    env: {},
    existsSync: (candidate) =>
      candidate === expectedFfmpeg || candidate === expectedFfprobe,
  });

  assert.deepEqual(resolved, {
    ffmpegPath: expectedFfmpeg,
    ffprobePath: expectedFfprobe,
  });
});

test('resolveBinaryPath reports every checked location when missing', () => {
  assert.throws(
    () =>
      resolveBinaryPath('ffprobe', {
        isPackaged: false,
        appPath: '/work/sound-forge',
        platform: 'darwin',
        arch: 'arm64',
        env: {},
        existsSync: () => false,
      }),
    /Unable to find the bundled ffprobe binary/,
  );
});
