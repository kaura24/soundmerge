'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyVisualPath,
  formatMediaTime,
  parseDurationSeconds,
  parseFrameRate,
  validateInputPaths,
} = require('../../src/shared/media-domain');

test('classifyVisualPath accepts only the MVP image and video extensions', () => {
  assert.equal(classifyVisualPath('/media/cover.JPG'), 'image');
  assert.equal(classifyVisualPath('/media/cover.jpeg'), 'image');
  assert.equal(classifyVisualPath('/media/cover.png'), 'image');
  assert.equal(classifyVisualPath('/media/clip.MP4'), 'video');
  assert.equal(classifyVisualPath('/media/clip.mov'), null);
  assert.equal(classifyVisualPath('/media/animation.gif'), null);
});

test('validateInputPaths rejects missing and unsupported selections', () => {
  assert.deepEqual(
    validateInputPaths('/media/song.MP3', '/media/cover.PNG'),
    {
      audioPath: '/media/song.MP3',
      visualPath: '/media/cover.PNG',
      visualType: 'image',
    },
  );

  assert.throws(
    () => validateInputPaths('', '/media/cover.png'),
    /MP3 file is required/,
  );
  assert.throws(
    () => validateInputPaths('/media/song.wav', '/media/cover.png'),
    /Only MP3 audio is supported/,
  );
  assert.throws(
    () => validateInputPaths('/media/song.mp3', '/media/cover.webp'),
    /Only JPG, JPEG, PNG, or H\.264 MP4 visual input is supported/,
  );
});

test('parseDurationSeconds accepts finite positive durations only', () => {
  assert.equal(parseDurationSeconds('245.125'), 245.125);
  assert.equal(parseDurationSeconds(0.001), 0.001);
  assert.throws(() => parseDurationSeconds('unknown'), /valid duration/);
  assert.throws(() => parseDurationSeconds('10 seconds'), /valid duration/);
  assert.throws(() => parseDurationSeconds(0), /valid duration/);
  assert.throws(() => parseDurationSeconds(-1), /valid duration/);
});

test('parseFrameRate handles ffprobe rational values', () => {
  assert.equal(parseFrameRate('30/1'), 30);
  assert.equal(parseFrameRate('30000/1001'), 30000 / 1001);
  assert.equal(parseFrameRate(24), 24);
  assert.equal(parseFrameRate('0/0'), null);
  assert.equal(parseFrameRate('not-a-rate'), null);
});

test('formatMediaTime produces stable timeline labels', () => {
  assert.equal(formatMediaTime(0), '00:00');
  assert.equal(formatMediaTime(65.9), '01:05');
  assert.equal(formatMediaTime(3661.9), '1:01:01');
  assert.equal(formatMediaTime(Number.NaN), '00:00');
});
