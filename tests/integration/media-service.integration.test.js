'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const {
  createMediaFile,
  inspectInputs,
  probeMedia,
} = require('../../src/main/media-service');

const ffmpegPath = process.env.SOUND_FORGE_FFMPEG_PATH;
const ffprobePath = process.env.SOUND_FORGE_FFPROBE_PATH;
const audioPath = process.env.SOUND_FORGE_TEST_MP3;
const imagePath = process.env.SOUND_FORGE_TEST_IMAGE;
const videoPath = process.env.SOUND_FORGE_TEST_VIDEO;
const testWorkDir =
  process.env.SOUND_FORGE_TEST_OUTPUT_DIR || process.env.TEST_WORK_DIR;
const resolvedTestWorkDir = testWorkDir && path.resolve(testWorkDir);
const outputIsInsideProject =
  resolvedTestWorkDir &&
  (resolvedTestWorkDir === process.cwd() ||
    resolvedTestWorkDir.startsWith(`${process.cwd()}${path.sep}`));

async function verifyOutput(outputPath, expectedDuration) {
  const result = await probeMedia(outputPath, { ffprobePath });
  const videoStreams = result.streams.filter(
    (stream) => stream.codec_type === 'video',
  );
  const audioStreams = result.streams.filter(
    (stream) => stream.codec_type === 'audio',
  );

  assert.equal(videoStreams.length, 1);
  assert.equal(audioStreams.length, 1);
  assert.equal(videoStreams[0].codec_name, 'h264');
  assert.equal(videoStreams[0].width, 1920);
  assert.equal(videoStreams[0].height, 1080);
  assert.equal(videoStreams[0].pix_fmt, 'yuv420p');
  assert.equal(audioStreams[0].codec_name, 'aac');
  assert.equal(audioStreams[0].sample_rate, '48000');
  assert.equal(audioStreams[0].channels, 2);
  assert.ok(
    Math.abs(Number(result.format.duration) - expectedDuration) <= 0.05,
    `expected duration within 0.05s of ${expectedDuration}, got ${result.format.duration}`,
  );
}

async function renderFixture(visualPath) {
  const inspection = await inspectInputs(
    { audioPath, visualPath },
    { ffprobePath },
  );
  const outputPath = path.join(
    testWorkDir,
    `sound-forge-integration-${randomUUID()}.mp4`,
  );

  await fs.mkdir(testWorkDir, { recursive: true });
  try {
    await createMediaFile({
      ffmpegPath,
      audioPath,
      visualPath,
      visualType: inspection.visualType,
      duration: inspection.audioDuration,
      outputPath,
    });
    await verifyOutput(outputPath, inspection.audioDuration);
  } finally {
    await fs.rm(outputPath, { force: true });
  }
}

const commonMissing =
  !ffmpegPath ||
  !ffprobePath ||
  !audioPath ||
  !testWorkDir ||
  outputIsInsideProject;

test(
  'renders an environment-provided image fixture',
  {
    skip:
      (commonMissing || !imagePath) &&
      'Set FFmpeg/ffprobe, MP3, image, and external test-work paths via SOUND_FORGE_* environment variables',
    timeout: 30 * 60 * 1000,
  },
  async () => {
    await renderFixture(imagePath);
  },
);

test(
  'renders an environment-provided H.264 MP4 fixture and discards its audio',
  {
    skip:
      (commonMissing || !videoPath) &&
      'Set FFmpeg/ffprobe, MP3, video, and external test-work paths via SOUND_FORGE_* environment variables',
    timeout: 30 * 60 * 1000,
  },
  async () => {
    await renderFixture(videoPath);
  },
);
