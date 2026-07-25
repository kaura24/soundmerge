'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const {
  buildFfmpegArgs,
  createMediaFile,
  inspectInputs,
  parseProbeJson,
  probeMedia,
  validateProbeMetadata,
} = require('../../src/main/media-service');

function createSpawnResult({ stdout = '', stderr = '', code = 0 } = {}) {
  return (_binaryPath, _args, options) => {
    assert.deepEqual(options, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();

    process.nextTick(() => {
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit('close', code, null);
    });

    return child;
  };
}

const audioProbe = {
  streams: [
    {
      index: 0,
      codec_type: 'audio',
      codec_name: 'mp3',
      duration: '245.125',
      sample_rate: '44100',
      channels: 2,
    },
  ],
  format: {
    format_name: 'mp3',
    duration: '245.125',
  },
};

const imageProbe = {
  streams: [
    {
      index: 0,
      codec_type: 'video',
      codec_name: 'png',
      width: 1200,
      height: 1200,
    },
  ],
  format: {
    format_name: 'png_pipe',
  },
};

const videoProbe = {
  streams: [
    {
      index: 0,
      codec_type: 'video',
      codec_name: 'h264',
      width: 1280,
      height: 720,
      avg_frame_rate: '30/1',
    },
    {
      index: 1,
      codec_type: 'audio',
      codec_name: 'aac',
    },
  ],
  format: {
    format_name: 'mov,mp4,m4a,3gp,3g2,mj2',
    duration: '8.2',
  },
};

test('parseProbeJson rejects malformed or incomplete ffprobe output', () => {
  assert.deepEqual(parseProbeJson(JSON.stringify(audioProbe)), audioProbe);
  assert.throws(() => parseProbeJson('{'), /invalid JSON/);
  assert.throws(
    () => parseProbeJson(JSON.stringify({ format: {} })),
    /does not contain a streams array/,
  );
});

test('probeMedia invokes ffprobe without a shell and parses stdout', async () => {
  let invocation;
  const spawnImpl = (binaryPath, args, options) => {
    invocation = { binaryPath, args };
    return createSpawnResult({ stdout: JSON.stringify(audioProbe) })(
      binaryPath,
      args,
      options,
    );
  };

  const result = await probeMedia('/media/song.mp3', {
    ffprobePath: '/bin/ffprobe',
    spawnImpl,
  });

  assert.deepEqual(result, audioProbe);
  assert.equal(invocation.binaryPath, '/bin/ffprobe');
  assert.deepEqual(invocation.args, [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    '/media/song.mp3',
  ]);
});

test('probeMedia includes bounded stderr when ffprobe fails', async () => {
  await assert.rejects(
    probeMedia('/media/broken.mp3', {
      ffprobePath: '/bin/ffprobe',
      spawnImpl: createSpawnResult({
        code: 1,
        stderr: 'decoder failed',
      }),
    }),
    /decoder failed/,
  );
});

test('validateProbeMetadata enforces MP3 and H.264 MP4 codecs', () => {
  assert.doesNotThrow(() =>
    validateProbeMetadata('audio', audioProbe, '/media/song.mp3'),
  );
  assert.doesNotThrow(() =>
    validateProbeMetadata('image', imageProbe, '/media/cover.png'),
  );
  assert.doesNotThrow(() =>
    validateProbeMetadata('video', videoProbe, '/media/clip.mp4'),
  );

  assert.throws(
    () =>
      validateProbeMetadata(
        'audio',
        {
          streams: [{ codec_type: 'audio', codec_name: 'aac' }],
          format: { duration: '10' },
        },
        '/media/song.mp3',
      ),
    /does not contain an MP3 audio stream/,
  );
  assert.throws(
    () =>
      validateProbeMetadata(
        'video',
        {
          streams: [{ codec_type: 'video', codec_name: 'hevc' }],
          format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
        },
        '/media/clip.mp4',
      ),
    /does not contain H\.264 video/,
  );
});

test('inspectInputs probes both files and returns normalized metadata', async () => {
  const responses = new Map([
    ['/media/song.mp3', audioProbe],
    ['/media/clip.mp4', videoProbe],
  ]);

  const result = await inspectInputs(
    {
      audioPath: '/media/song.mp3',
      visualPath: '/media/clip.mp4',
    },
    {
      probeImpl: async (filePath) => responses.get(filePath),
      ffprobePath: '/bin/ffprobe',
    },
  );

  assert.equal(result.visualType, 'video');
  assert.equal(result.audioDuration, 245.125);
  assert.equal(result.audio, audioProbe);
  assert.equal(result.visual, videoProbe);
});

test('buildFfmpegArgs loops an image and emits the fixed YouTube preset', () => {
  const args = buildFfmpegArgs({
    audioPath: '/media/song.mp3',
    visualPath: '/media/cover.png',
    visualType: 'image',
    duration: 245.125,
    outputPath: '/output/final.mp4',
  });

  assert.deepEqual(args.slice(0, 8), [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-loop',
    '1',
    '-framerate',
    '30',
  ]);
  assert.equal(args.includes('-stream_loop'), false);
  assert.match(args[args.indexOf('-filter_complex') + 1], /gblur=sigma=30/);
  assert.match(
    args[args.indexOf('-filter_complex') + 1],
    /atrim=duration=245\.125/,
  );
  assert.equal(args[args.indexOf('-profile:v') + 1], 'high');
  assert.equal(args[args.indexOf('-pix_fmt') + 1], 'yuv420p');
  assert.equal(args[args.indexOf('-field_order') + 1], 'progressive');
  assert.equal(args[args.indexOf('-b:v') + 1], '8M');
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac');
  assert.equal(args[args.indexOf('-profile:a') + 1], 'aac_low');
  assert.equal(args[args.indexOf('-ar') + 1], '48000');
  assert.equal(args[args.indexOf('-ac') + 1], '2');
  assert.equal(args[args.indexOf('-color_primaries') + 1], 'bt709');
  assert.equal(args[args.indexOf('-movflags') + 1], '+faststart');
  assert.equal(args.at(-1), '/output/final.mp4');
});

test('buildFfmpegArgs infinitely loops video and maps only the MP3 audio', () => {
  const args = buildFfmpegArgs({
    audioPath: '/media/song.mp3',
    visualPath: '/media/clip.mp4',
    visualType: 'video',
    duration: 245.125,
    outputPath: '/output/final.mp4',
  });

  assert.deepEqual(
    args.slice(args.indexOf('-stream_loop'), args.indexOf('-stream_loop') + 4),
    ['-stream_loop', '-1', '-i', '/media/clip.mp4'],
  );

  const mapped = args
    .map((value, index) => (value === '-map' ? args[index + 1] : null))
    .filter(Boolean);
  assert.deepEqual(mapped, ['[v]', '[a]']);
  assert.match(args[args.indexOf('-filter_complex') + 1], /\[1:a:0\]/);
});

test('createMediaFile encodes to a sibling temp file before rename', async () => {
  const calls = [];
  const fsPromises = {
    access: async (...args) => calls.push(['access', ...args]),
    lstat: async () => {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    },
    rename: async (...args) => calls.push(['rename', ...args]),
    rm: async (...args) => calls.push(['rm', ...args]),
  };
  let command;

  const result = await createMediaFile(
    {
      ffmpegPath: '/bin/ffmpeg',
      audioPath: '/media/song.mp3',
      visualPath: '/media/cover.png',
      visualType: 'image',
      duration: 10,
      outputPath: '/output/final.mp4',
    },
    {
      fsPromises,
      idFactory: () => 'test-id',
      runProcessImpl: async (binaryPath, args) => {
        command = { binaryPath, args };
      },
    },
  );

  assert.equal(result, '/output/final.mp4');
  assert.equal(command.binaryPath, '/bin/ffmpeg');
  assert.equal(command.args.at(-1), '/output/.final.test-id.tmp.mp4');
  assert.deepEqual(calls.at(-1), [
    'rename',
    '/output/.final.test-id.tmp.mp4',
    '/output/final.mp4',
  ]);
});

test('createMediaFile refuses existing output and cleans failed temp output', async () => {
  await assert.rejects(
    createMediaFile(
      {
        ffmpegPath: '/bin/ffmpeg',
        audioPath: '/media/song.mp3',
        visualPath: '/media/cover.png',
        visualType: 'image',
        duration: 10,
        outputPath: '/output/existing.mp4',
      },
      {
        fsPromises: {
          access: async () => {},
          lstat: async () => ({ isFile: () => true }),
          rename: async () => {},
          rm: async () => {},
        },
        runProcessImpl: async () => {
          assert.fail('FFmpeg must not run for an existing output');
        },
      },
    ),
    /already exists/,
  );

  const removed = [];
  await assert.rejects(
    createMediaFile(
      {
        ffmpegPath: '/bin/ffmpeg',
        audioPath: '/media/song.mp3',
        visualPath: '/media/cover.png',
        visualType: 'image',
        duration: 10,
        outputPath: '/output/final.mp4',
      },
      {
        fsPromises: {
          access: async () => {},
          lstat: async () => {
            const error = new Error('missing');
            error.code = 'ENOENT';
            throw error;
          },
          rename: async () => {},
          rm: async (...args) => removed.push(args),
        },
        idFactory: () => 'failed-id',
        runProcessImpl: async () => {
          throw new Error('encode failed');
        },
      },
    ),
    /encode failed/,
  );
  assert.deepEqual(removed, [
    ['/output/.final.failed-id.tmp.mp4', { force: true }],
  ]);
});
