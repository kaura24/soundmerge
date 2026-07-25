'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

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
const keepOutputs = process.env.SOUND_FORGE_KEEP_OUTPUTS === '1';
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
  assert.equal(videoStreams[0].profile, 'High');
  assert.equal(videoStreams[0].level, 40);
  assert.equal(videoStreams[0].r_frame_rate, '30/1');
  assert.equal(videoStreams[0].field_order, 'progressive');
  assert.equal(videoStreams[0].color_space, 'bt709');
  assert.equal(videoStreams[0].color_transfer, 'bt709');
  assert.equal(videoStreams[0].color_primaries, 'bt709');
  assert.equal(audioStreams[0].codec_name, 'aac');
  assert.equal(audioStreams[0].profile, 'LC');
  assert.equal(audioStreams[0].sample_rate, '48000');
  assert.equal(audioStreams[0].channels, 2);
  assert.ok(
    Number(audioStreams[0].bit_rate) >= 250000,
    `expected AAC bitrate of at least 250 kbps, got ${audioStreams[0].bit_rate}`,
  );
  assert.ok(
    Math.abs(Number(result.format.duration) - expectedDuration) <= 0.05,
    `expected duration within 0.05s of ${expectedDuration}, got ${result.format.duration}`,
  );
  assert.ok(
    Number(result.format.duration) >= 240,
    'acceptance output must be at least four minutes long',
  );

  const handle = await fs.open(outputPath, 'r');
  try {
    const header = Buffer.alloc(1024 * 1024);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const atomHeader = header.subarray(0, bytesRead).toString('latin1');
    const moovIndex = atomHeader.indexOf('moov');
    const mdatIndex = atomHeader.indexOf('mdat');
    assert.ok(moovIndex >= 0, 'MP4 header must contain the moov atom');
    assert.ok(mdatIndex >= 0, 'MP4 header must contain the mdat atom');
    assert.ok(moovIndex < mdatIndex, 'Fast Start requires moov before mdat');
  } finally {
    await handle.close();
  }

  const frame = await decodeFrame(outputPath);
  const pixelCount = frame.length / 3;
  let magentaPixels = 0;
  let electricGreenPixels = 0;
  let luminanceTotal = 0;
  let luminanceSquaredTotal = 0;
  for (let index = 0; index < frame.length; index += 3) {
    const red = frame[index];
    const green = frame[index + 1];
    const blue = frame[index + 2];
    if (red > 180 && blue > 180 && green < 150) {
      magentaPixels += 1;
    }
    if (green > 210 && red < 110 && blue < 150) {
      electricGreenPixels += 1;
    }
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceTotal += luminance;
    luminanceSquaredTotal += luminance * luminance;
  }
  const mean = luminanceTotal / pixelCount;
  const variance = luminanceSquaredTotal / pixelCount - mean * mean;
  assert.ok(variance > 25, 'decoded output frame must contain visible detail');
  assert.ok(
    magentaPixels / pixelCount < 0.1,
    'decoded output frame contains corruption-like magenta striping',
  );
  assert.ok(
    electricGreenPixels / pixelCount < 0.35,
    'decoded output frame contains corruption-like electric-green striping',
  );
}

function decodeFrame(outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        '1',
        '-i',
        outputPath,
        '-frames:v',
        '1',
        '-vf',
        'scale=320:180',
        '-pix_fmt',
        'rgb24',
        '-f',
        'rawvideo',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const chunks = [];
    const errors = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(errors).toString('utf8')));
        return;
      }
      const frame = Buffer.concat(chunks);
      assert.equal(frame.length, 320 * 180 * 3);
      resolve(frame);
    });
  });
}

async function renderFixture(visualPath) {
  const inspection = await inspectInputs(
    { audioPath, visualPath },
    { ffprobePath },
  );
  const outputPath = path.join(
    testWorkDir,
    `sound-forge-${path.basename(visualPath, path.extname(visualPath))}-${randomUUID()}.mp4`,
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
    if (keepOutputs) {
      process.stdout.write(`Acceptance output retained: ${outputPath}\n`);
    }
  } finally {
    if (!keepOutputs) {
      await fs.rm(outputPath, { force: true });
    }
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
