'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateMultiPairInputPaths,
} = require('../../src/shared/media-domain');
const {
  buildMultiPairFfmpegArgs,
  inspectMultiPairInputs,
} = require('../../src/main/media-service');

test('validateMultiPairInputPaths validates array of image & audio pairs', () => {
  const pairs = [
    { audioPath: '/media/track1.mp3', visualPath: '/media/img1.png' },
    { audioPath: '/media/track2.mp3', visualPath: '/media/img2.jpg' },
  ];

  const validated = validateMultiPairInputPaths(pairs);
  assert.equal(validated.length, 2);
  assert.equal(validated[0].visualType, 'image');
  assert.equal(validated[1].visualType, 'image');

  assert.throws(
    () => validateMultiPairInputPaths([]),
    /At least one image and audio pair is required/,
  );

  assert.throws(
    () => validateMultiPairInputPaths([{ audioPath: '/media/track1.wav', visualPath: '/media/img1.png' }]),
    /Only MP3 audio is supported/,
  );
});

test('buildMultiPairFfmpegArgs generates correct FFmpeg filter graph and duration', () => {
  const pairs = [
    { audioPath: '/media/track1.mp3', visualPath: '/media/img1.png', visualType: 'image', duration: 10 },
    { audioPath: '/media/track2.mp3', visualPath: '/media/img2.jpg', visualType: 'image', duration: 15 },
  ];

  const args = buildMultiPairFfmpegArgs({
    pairs,
    outputPath: '/media/output.mp4',
  });

  assert.ok(args.includes('-filter_complex'));
  const filterIndex = args.indexOf('-filter_complex');
  const filterString = args[filterIndex + 1];

  assert.ok(filterString.includes('concat=n=2:v=1:a=1[v][a]'));
  assert.ok(args.includes('-t'));
  const tIndex = args.indexOf('-t');
  assert.equal(args[tIndex + 1], '25');
  assert.equal(args[args.length - 1], '/media/output.mp4');
});

test('inspectMultiPairInputs classifies each visual before validating its probe', async () => {
  const audioProbe = {
    streams: [{ codec_type: 'audio', codec_name: 'mp3', duration: '12' }],
    format: { format_name: 'mp3', duration: '12' },
  };
  const imageProbe = {
    streams: [{ codec_type: 'video', codec_name: 'png', width: 100, height: 100 }],
    format: { format_name: 'png_pipe' },
  };

  const inspected = await inspectMultiPairInputs(
    [{ audioPath: '/media/track.mp3', visualPath: '/media/cover.png' }],
    {
      ffprobePath: '/bin/ffprobe',
      probeImpl: async (filePath) => filePath.endsWith('.mp3') ? audioProbe : imageProbe,
    },
  );

  assert.equal(inspected.pairs[0].visualType, 'image');
  assert.equal(inspected.totalDuration, 12);
});

test('buildMultiPairFfmpegArgs includes badgePath overlay filter when provided', () => {
  const pairs = [
    { audioPath: '/media/track1.mp3', visualPath: '/media/img1.png', visualType: 'image', duration: 10, badgePath: '/media/badge1.png' },
    { audioPath: '/media/track2.mp3', visualPath: '/media/img2.jpg', visualType: 'image', duration: 15 },
  ];

  const args = buildMultiPairFfmpegArgs({
    pairs,
    outputPath: '/media/output.mp4',
  });

  const filterString = args[args.indexOf('-filter_complex') + 1];
  assert.ok(args.includes('/media/badge1.png'));
  assert.ok(filterString.includes('[base_v_0][2:v:0]overlay=W-w-40:40:shortest=0,format=nv12[v_0]'));
});
