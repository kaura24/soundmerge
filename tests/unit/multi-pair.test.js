'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateMultiPairInputPaths,
} = require('../../src/shared/media-domain');
const {
  buildBadgedStillFfmpegArgs,
  buildMultiPairFfmpegArgs,
  createMultiPairMediaFile,
  inspectMultiPairInputs,
  prepareAutoPairInputs,
} = require('../../src/main/media-service');

test('buildBadgedStillFfmpegArgs composites artwork and badge into one frame', () => {
  const args = buildBadgedStillFfmpegArgs({
    visualPath: '/media/artwork.jpg',
    badgePath: '/media/title-badge.png',
    outputPath: '/external/staged-artwork.png',
  });

  assert.ok(args.includes('/media/artwork.jpg'));
  assert.ok(args.includes('/media/title-badge.png'));
  assert.ok(args.includes('-filter_complex'));
  assert.ok(args[args.indexOf('-filter_complex') + 1].includes('overlay=W-w-40:40'));
  assert.ok(args.includes('-frames:v'));
  assert.equal(args[args.indexOf('-frames:v') + 1], '1');
  assert.equal(args.at(-1), '/external/staged-artwork.png');
});

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

test('buildMultiPairFfmpegArgs prepends a title card and persistent playlist overlay', () => {
  const args = buildMultiPairFfmpegArgs({
    pairs: [
      { audioPath: '/media/track1.mp3', visualPath: '/media/img1.png', visualType: 'image', duration: 10 },
      { audioPath: '/media/track2.mp3', visualPath: '/media/img2.png', visualType: 'image', duration: 15 },
      { audioPath: '/media/track3.mp3', visualPath: '/media/img3.png', visualType: 'image', duration: 12 },
    ],
    outputPath: '/media/output.mp4',
    playlistBadgePath: '/media/playlist-badge.png',
    titleCardPath: '/media/title-card.png',
    titleCardDuration: 5,
  });

  assert.ok(args.includes('/media/playlist-badge.png'));
  assert.ok(args.includes('/media/title-card.png'));
  const filter = args[args.indexOf('-filter_complex') + 1];
  assert.match(filter, /overlay=0:0:format=auto:shortest=0:enable='between\(t,0,5\)'/);
  assert.match(filter, /overlay=40:40:format=auto:shortest=0:enable='gte\(t,5\)'/);
  assert.match(filter, /concat=n=3:v=1:a=1\[v\]\[a\]/);
  assert.equal(args[args.indexOf('-t') + 1], '37');
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
  assert.ok(filterString.includes('[base_v_0][2:v:0]overlay=W-w-40:40:format=auto:shortest=0,format=nv12[v_0]'));
});

test('createMultiPairMediaFile renders one pair at a time before concatenating', async () => {
  const pairs = [
    { audioPath: '/media/track1.mp3', visualPath: '/media/img1.png', visualType: 'image', duration: 10 },
    { audioPath: '/media/track2.mp3', visualPath: '/media/img2.jpg', visualType: 'image', duration: 15 },
    { audioPath: '/media/track3.mp3', visualPath: '/media/img3.png', visualType: 'image', duration: 20 },
  ];
  const files = new Set();
  const segmentCalls = [];
  const processCalls = [];
  const progressEvents = [];
  const fsPromises = {
    access: async () => {},
    lstat: async (filePath) => {
      if (files.has(filePath)) return {};
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    mkdtemp: async (prefix) => `${prefix}stage`,
    writeFile: async (filePath) => {
      files.add(filePath);
    },
    rename: async (_source, destination) => {
      files.add(destination);
    },
    rm: async (filePath) => {
      files.delete(filePath);
    },
  };

  const outputPath = await createMultiPairMediaFile(
    {
      ffmpegPath: '/bin/ffmpeg',
      pairs,
      outputPath: '/output/final.mp4',
      workRoot: '/external/test-work',
      onProgress: (progress) => progressEvents.push(progress),
    },
    {
      fsPromises,
      idFactory: () => 'render-id',
      createMediaFileImpl: async (request) => {
        segmentCalls.push(request);
        files.add(request.outputPath);
        return request.outputPath;
      },
      runProcessImpl: async (binaryPath, args) => {
        processCalls.push({ binaryPath, args });
        files.add(args.at(-1));
      },
    },
  );

  assert.equal(outputPath, '/output/final.mp4');
  assert.equal(segmentCalls.length, 3);
  assert.deepEqual(
    segmentCalls.map((call) => call.audioPath),
    pairs.map((pair) => pair.audioPath),
  );
  assert.equal(processCalls.length, 1);
  assert.ok(processCalls[0].args.includes('-f'));
  assert.ok(processCalls[0].args.includes('concat'));
  assert.ok(processCalls[0].args.includes('-c'));
  assert.ok(processCalls[0].args.includes('copy'));
  assert.ok(progressEvents.some((event) => event.phase === 'concatenating'));
  assert.equal(progressEvents.at(-1).phase, 'complete');
  assert.equal(progressEvents.at(-1).percent, 100);
});

test('prepareAutoPairInputs discovers sorted MP3 files and extracts each artwork', async () => {
  const extracted = [];
  const fsPromises = {
    access: async () => {},
    readdir: async () => [
      { name: '10 Finale.mp3', isFile: () => true },
      { name: 'notes.txt', isFile: () => true },
      { name: 'Track 2.MP3', isFile: () => true },
      { name: '2 Second.mp3', isFile: () => true },
      { name: '001 Intro.mp3', isFile: () => true },
      { name: 'nested', isFile: () => false },
    ],
    rm: async () => {},
  };
  const probeImpl = async (audioPath) => ({
    streams: [
      { codec_type: 'audio', codec_name: 'mp3', duration: '12' },
      {
        index: 1,
        codec_type: 'video',
        codec_name: 'mjpeg',
        width: 360,
        height: 360,
        disposition: { attached_pic: 1 },
      },
    ],
    format: { format_name: 'mp3', duration: '12', filename: audioPath },
  });

  let nextId = 0;
  const pairs = await prepareAutoPairInputs(
    {
      folderPath: '/music',
      workRoot: '/external/artwork',
      ffmpegPath: '/bin/ffmpeg',
      ffprobePath: '/bin/ffprobe',
    },
    {
      fsPromises,
      idFactory: () => `id-${++nextId}`,
      probeImpl,
      extractArtworkImpl: async (request) => extracted.push(request),
    },
  );

  assert.deepEqual(
    pairs.map((pair) => pair.audioPath),
    [
      '/music/001 Intro.mp3',
      '/music/2 Second.mp3',
      '/music/10 Finale.mp3',
      '/music/Track 2.MP3',
    ],
  );
  assert.deepEqual(
    pairs.map((pair) => pair.trackNumber),
    ['001', '2', '10', null],
  );
  assert.equal(extracted.length, 4);
  assert.deepEqual(extracted.map((request) => request.streamIndex), [1, 1, 1, 1]);
  assert.ok(pairs.every((pair) => pair.visualType === 'image'));
});
