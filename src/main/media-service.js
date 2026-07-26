'use strict';

const fs = require('node:fs');
const fsPromisesDefault = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');

const {
  InputValidationError,
  classifyVisualPath,
  parseDurationSeconds,
  validateInputPaths,
} = require('../shared/media-domain');

const CAPTURE_LIMIT_BYTES = 1024 * 1024;
const ERROR_DETAIL_LIMIT = 16 * 1024;
const MP4_FORMAT_NAMES = new Set(['mp4', 'mov']);
const IMAGE_CODECS = new Set(['mjpeg', 'jpeg2000', 'png']);

class MediaProcessError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'MediaProcessError';
    this.code = options.code;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.stderr = options.stderr;
  }
}

function appendBounded(chunks, chunk, state, limit) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const remaining = limit - state.bytes;
  if (remaining <= 0) {
    state.truncated = true;
    return;
  }

  chunks.push(buffer.subarray(0, remaining));
  state.bytes += Math.min(buffer.length, remaining);
  if (buffer.length > remaining) {
    state.truncated = true;
  }
}

function runProcess(
  binaryPath,
  args,
  {
    spawnImpl = spawn,
    captureLimitBytes = CAPTURE_LIMIT_BYTES,
  } = {},
) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      reject(
        new MediaProcessError(`Unable to start ${path.basename(binaryPath)}.`, {
          cause: error,
          code: 'PROCESS_START_FAILED',
        }),
      );
      return;
    }

    const stdoutChunks = [];
    const stderrChunks = [];
    const stdoutState = { bytes: 0, truncated: false };
    const stderrState = { bytes: 0, truncated: false };
    let settled = false;

    child.stdout.on('data', (chunk) => {
      appendBounded(
        stdoutChunks,
        chunk,
        stdoutState,
        captureLimitBytes,
      );
    });
    child.stderr.on('data', (chunk) => {
      appendBounded(
        stderrChunks,
        chunk,
        stderrState,
        captureLimitBytes,
      );
    });

    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(
        new MediaProcessError(`Unable to run ${path.basename(binaryPath)}.`, {
          cause: error,
          code: 'PROCESS_START_FAILED',
        }),
      );
    });

    child.once('close', (exitCode, signal) => {
      if (settled) {
        return;
      }
      settled = true;

      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const completeStderr = Buffer.concat(stderrChunks).toString('utf8');
      const stderr =
        completeStderr.length > ERROR_DETAIL_LIMIT
          ? completeStderr.slice(-ERROR_DETAIL_LIMIT)
          : completeStderr;

      if (exitCode !== 0) {
        const detail = stderr.trim();
        reject(
          new MediaProcessError(
            `${path.basename(binaryPath)} failed${
              detail ? `: ${detail}` : '.'
            }`,
            {
              code: 'PROCESS_FAILED',
              exitCode,
              signal,
              stderr,
            },
          ),
        );
        return;
      }

      resolve({
        stdout,
        stderr,
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
      });
    });
  });
}

function parseProbeJson(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new MediaProcessError('ffprobe returned invalid JSON.', {
      cause: error,
      code: 'INVALID_PROBE_JSON',
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new MediaProcessError('ffprobe did not return a metadata object.', {
      code: 'INVALID_PROBE_DATA',
    });
  }

  if (!Array.isArray(parsed.streams)) {
    throw new MediaProcessError(
      'ffprobe metadata does not contain a streams array.',
      { code: 'INVALID_PROBE_DATA' },
    );
  }

  if (!parsed.format || typeof parsed.format !== 'object') {
    parsed.format = {};
  }

  return parsed;
}

async function probeMedia(
  filePath,
  {
    ffprobePath,
    spawnImpl = spawn,
    runProcessImpl = runProcess,
  } = {},
) {
  if (!ffprobePath) {
    throw new TypeError('ffprobePath is required.');
  }
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError('A media file path is required.');
  }

  const args = [
    '-v',
    'error',
    '-show_format',
    '-show_streams',
    '-of',
    'json',
    filePath,
  ];
  const result = await runProcessImpl(ffprobePath, args, { spawnImpl });
  return parseProbeJson(result.stdout);
}

function streamOfType(metadata, streamType) {
  return metadata.streams.find(
    (stream) => stream && stream.codec_type === streamType,
  );
}

function findEmbeddedArtwork(metadata) {
  return metadata?.streams?.find(
    (stream) =>
      stream &&
      stream.codec_type === 'video' &&
      (stream.disposition?.attached_pic === 1 ||
        stream.disposition?.still_image === 1),
  );
}

function artworkExtension(stream) {
  switch (String(stream?.codec_name || '').toLowerCase()) {
    case 'png':
      return '.png';
    case 'jpeg2000':
      return '.jp2';
    default:
      return '.jpg';
  }
}

function buildArtworkExtractArgs({ audioPath, streamIndex, outputPath }) {
  if (typeof audioPath !== 'string' || audioPath.trim() === '') {
    throw new TypeError('An MP3 file path is required.');
  }
  if (!Number.isInteger(streamIndex) || streamIndex < 0) {
    throw new TypeError('An embedded artwork stream index is required.');
  }
  if (typeof outputPath !== 'string' || outputPath.trim() === '') {
    throw new TypeError('An artwork output path is required.');
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    audioPath,
    '-map',
    `0:${streamIndex}`,
    '-frames:v',
    '1',
    '-c:v',
    'copy',
    '-an',
    outputPath,
  ];
}

async function extractEmbeddedArtwork(
  { ffmpegPath, audioPath, streamIndex, outputPath },
  { runProcessImpl = runProcess, spawnImpl = spawn } = {},
) {
  if (!ffmpegPath) {
    throw new TypeError('ffmpegPath is required.');
  }

  await runProcessImpl(
    ffmpegPath,
    buildArtworkExtractArgs({ audioPath, streamIndex, outputPath }),
    { spawnImpl },
  );
  return outputPath;
}

function formatNames(metadata) {
  return new Set(
    String(metadata.format && metadata.format.format_name)
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
}

function metadataDuration(metadata, preferredStreamType = null) {
  const formatDuration = Number.parseFloat(
    metadata.format && metadata.format.duration,
  );
  if (Number.isFinite(formatDuration) && formatDuration > 0) {
    return formatDuration;
  }

  const stream = preferredStreamType
    ? streamOfType(metadata, preferredStreamType)
    : metadata.streams.find(Boolean);
  return parseDurationSeconds(stream && stream.duration);
}

function validateProbeMetadata(kind, metadata, filePath = 'Selected file') {
  if (!metadata || !Array.isArray(metadata.streams)) {
    throw new InputValidationError(
      `${filePath} could not be decoded.`,
      'INVALID_MEDIA',
    );
  }

  if (kind === 'audio') {
    const audioStream = streamOfType(metadata, 'audio');
    if (!audioStream || audioStream.codec_name !== 'mp3') {
      throw new InputValidationError(
        `${filePath} does not contain an MP3 audio stream.`,
        'UNSUPPORTED_AUDIO_CODEC',
      );
    }
    metadataDuration(metadata, 'audio');
    return;
  }

  const videoStream = streamOfType(metadata, 'video');
  if (!videoStream) {
    throw new InputValidationError(
      `${filePath} does not contain a visual stream.`,
      'MISSING_VIDEO_STREAM',
    );
  }

  if (kind === 'image') {
    if (!IMAGE_CODECS.has(videoStream.codec_name)) {
      throw new InputValidationError(
        `${filePath} is not a supported JPG, JPEG, or PNG image.`,
        'UNSUPPORTED_IMAGE_CODEC',
      );
    }
    return;
  }

  if (kind === 'video') {
    const names = formatNames(metadata);
    const isMp4 = [...names].some((name) => MP4_FORMAT_NAMES.has(name));
    if (!isMp4) {
      throw new InputValidationError(
        `${filePath} is not an MP4 container.`,
        'UNSUPPORTED_VIDEO_CONTAINER',
      );
    }
    if (videoStream.codec_name !== 'h264') {
      throw new InputValidationError(
        `${filePath} does not contain H.264 video.`,
        'UNSUPPORTED_VIDEO_CODEC',
      );
    }
    return;
  }

  throw new TypeError(`Unknown media kind: ${kind}`);
}

async function inspectInputs(
  { audioPath, visualPath, badgePath },
  {
    ffprobePath,
    probeImpl = probeMedia,
    spawnImpl = spawn,
  } = {},
) {
  const validated = validateInputPaths(audioPath, visualPath);
  const probeOptions = { ffprobePath, spawnImpl };
  const [audio, visual] = await Promise.all([
    probeImpl(validated.audioPath, probeOptions),
    probeImpl(validated.visualPath, probeOptions),
  ]);

  validateProbeMetadata('audio', audio, validated.audioPath);
  validateProbeMetadata(validated.visualType, visual, validated.visualPath);

  return {
    ...validated,
    badgePath,
    audioDuration: metadataDuration(audio, 'audio'),
    audio,
    visual,
  };
}

function durationArgument(value) {
  const duration = parseDurationSeconds(value, 'Audio');
  return Number(duration.toFixed(6)).toString();
}

function buildVisualFilter(duration, hasBadge = false) {
  const filterParts = [
    '[0:v:0]format=nv12,split=2[background_source][foreground_source]',
    '[background_source]scale=480:270:force_original_aspect_ratio=increase,' +
      'crop=480:270,' +
      'scale=1920:1080:flags=bicubic:out_range=tv,' +
      'setsar=1,format=nv12[background]',
    '[foreground_source]scale=1920:1080:' +
      'force_original_aspect_ratio=decrease:out_range=tv,' +
      'setsar=1,format=nv12[foreground]',
    '[background][foreground]overlay=(W-w)/2:(H-h)/2:shortest=0,' +
      `fps=30,format=nv12,trim=duration=${duration},` +
      'setpts=PTS-STARTPTS,' +
      'setparams=range=limited:color_primaries=bt709:' +
      `color_trc=bt709:colorspace=bt709[${hasBadge ? 'base_v' : 'v'}]`,
  ];

  if (hasBadge) {
    filterParts.push(
      '[base_v][2:v:0]overlay=W-w-40:40:format=auto:shortest=0,format=nv12[v]',
    );
  }

  filterParts.push(
    `[1:a:0]apad,atrim=duration=${duration},asetpts=N/SR/TB[a]`,
  );

  return filterParts.join(';');
}

function buildFfmpegArgs({
  audioPath,
  visualPath,
  visualType,
  duration,
  outputPath,
  badgePath,
}) {
  const validated = validateInputPaths(audioPath, visualPath);
  const resolvedVisualType = visualType || validated.visualType;
  if (resolvedVisualType !== validated.visualType) {
    throw new InputValidationError(
      'The selected visual type does not match its file extension.',
      'VISUAL_TYPE_MISMATCH',
    );
  }
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.mp4'
  ) {
    throw new InputValidationError(
      'The output path must end in .mp4.',
      'INVALID_OUTPUT_EXTENSION',
    );
  }

  const exactDuration = durationArgument(duration);
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];

  if (resolvedVisualType === 'image') {
    args.push('-loop', '1', '-framerate', '1', '-i', visualPath);
  } else {
    args.push('-stream_loop', '-1', '-i', visualPath);
  }

  args.push('-i', audioPath);
  const hasBadge = Boolean(badgePath && typeof badgePath === 'string');
  if (hasBadge) {
    args.push('-loop', '1', '-framerate', '1', '-i', badgePath);
  }

  args.push(
    '-filter_complex',
    buildVisualFilter(exactDuration, hasBadge),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'h264_videotoolbox',
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-allow_sw',
    '1',
    '-realtime',
    '0',
    '-b:v',
    '8M',
    '-maxrate',
    '10M',
    '-bufsize',
    '16M',
    '-pix_fmt',
    'nv12',
    '-r',
    '30',
    '-fps_mode',
    'cfr',
    '-field_order',
    'progressive',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-c:a',
    'aac',
    '-profile:a',
    'aac_low',
    '-b:a',
    '384k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    exactDuration,
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-sn',
    '-dn',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    outputPath,
  );

  return args;
}

async function pathExists(filePath, fsPromises) {
  try {
    await fsPromises.lstat(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function temporaryOutputPath(outputPath, id) {
  const directory = path.dirname(outputPath);
  const basename = path.basename(outputPath, path.extname(outputPath));
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(directory, `.${basename}.${safeId}.tmp.mp4`);
}

async function createMediaFile(
  {
    ffmpegPath,
    audioPath,
    visualPath,
    visualType,
    duration,
    outputPath,
    badgePath,
    overwrite = false,
  },
  {
    fsPromises = fsPromisesDefault,
    idFactory = randomUUID,
    runProcessImpl = runProcess,
    spawnImpl = spawn,
  } = {},
) {
  if (!ffmpegPath) {
    throw new TypeError('ffmpegPath is required.');
  }
  const validated = validateInputPaths(audioPath, visualPath);
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.mp4'
  ) {
    throw new InputValidationError(
      'The output path must end in .mp4.',
      'INVALID_OUTPUT_EXTENSION',
    );
  }

  const absoluteOutputPath = path.resolve(outputPath);
  if (
    absoluteOutputPath === path.resolve(validated.audioPath) ||
    absoluteOutputPath === path.resolve(validated.visualPath)
  ) {
    throw new InputValidationError(
      'The output path must be different from both input files.',
      'OUTPUT_MATCHES_INPUT',
    );
  }

  await fsPromises.access(path.dirname(absoluteOutputPath), fs.constants.W_OK);
  const outputExisted = await pathExists(absoluteOutputPath, fsPromises);
  if (!overwrite && outputExisted) {
    throw new InputValidationError(
      `The output file already exists: ${absoluteOutputPath}`,
      'OUTPUT_EXISTS',
    );
  }

  const tempPath = temporaryOutputPath(absoluteOutputPath, idFactory());
  if (await pathExists(tempPath, fsPromises)) {
    throw new MediaProcessError(
      `A temporary output file already exists: ${tempPath}`,
      { code: 'TEMP_OUTPUT_EXISTS' },
    );
  }

  const args = buildFfmpegArgs({
    audioPath,
    visualPath,
    visualType,
    duration,
    outputPath: tempPath,
    badgePath,
  });

  try {
    await runProcessImpl(ffmpegPath, args, { spawnImpl });

    if (
      !outputExisted &&
      (await pathExists(absoluteOutputPath, fsPromises))
    ) {
      throw new InputValidationError(
        `The output file was created by another process: ${absoluteOutputPath}`,
        'OUTPUT_EXISTS',
      );
    }

    await fsPromises.rename(tempPath, absoluteOutputPath);
  } catch (error) {
    await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return absoluteOutputPath;
}

function buildMultiPairFfmpegArgs({ pairs, outputPath }) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new InputValidationError(
      'At least one image and audio pair is required.',
      'PAIRS_REQUIRED',
    );
  }
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.mp4'
  ) {
    throw new InputValidationError(
      'The output path must end in .mp4.',
      'INVALID_OUTPUT_EXTENSION',
    );
  }

  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const filterParts = [];
  const concatInputs = [];
  let totalDurationSeconds = 0;
  let inputIndex = 0;

  pairs.forEach((pair, i) => {
    const visualType = pair.visualType || 'image';
    if (visualType === 'image') {
      args.push('-loop', '1', '-framerate', '1', '-i', pair.visualPath);
    } else {
      args.push('-stream_loop', '-1', '-i', pair.visualPath);
    }
    const vIdx = inputIndex++;
    args.push('-i', pair.audioPath);
    const aIdx = inputIndex++;

    let badgeIdx = null;
    if (pair.badgePath && typeof pair.badgePath === 'string') {
      args.push('-loop', '1', '-framerate', '1', '-i', pair.badgePath);
      badgeIdx = inputIndex++;
    }

    const durArg = durationArgument(pair.duration);
    totalDurationSeconds += parseDurationSeconds(pair.duration, `Pair ${i + 1} audio`);

    const baseV = badgeIdx !== null ? `base_v_${i}` : `v_${i}`;
    filterParts.push(
      `[${vIdx}:v:0]format=nv12,split=2[bg_src_${i}][fg_src_${i}];` +
        `[bg_src_${i}]scale=480:270:force_original_aspect_ratio=increase,crop=480:270,scale=1920:1080:flags=bicubic:out_range=tv,setsar=1,format=nv12[bg_${i}];` +
        `[fg_src_${i}]scale=1920:1080:force_original_aspect_ratio=decrease:out_range=tv,setsar=1,format=nv12[fg_${i}];` +
        `[bg_${i}][fg_${i}]overlay=(W-w)/2:(H-h)/2:shortest=0,fps=30,format=nv12,trim=duration=${durArg},setpts=PTS-STARTPTS,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[${baseV}];` +
        (badgeIdx !== null
          ? `[${baseV}][${badgeIdx}:v:0]overlay=W-w-40:40:format=auto:shortest=0,format=nv12[v_${i}];`
          : '') +
        `[${aIdx}:a:0]apad,atrim=duration=${durArg},asetpts=N/SR/TB[a_${i}]`,
    );
    concatInputs.push(`[v_${i}][a_${i}]`);
  });

  filterParts.push(`${concatInputs.join('')}concat=n=${pairs.length}:v=1:a=1[v][a]`);

  const exactTotalDuration = durationArgument(totalDurationSeconds);

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'h264_videotoolbox',
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-allow_sw',
    '1',
    '-realtime',
    '0',
    '-b:v',
    '8M',
    '-maxrate',
    '10M',
    '-bufsize',
    '16M',
    '-pix_fmt',
    'nv12',
    '-r',
    '30',
    '-fps_mode',
    'cfr',
    '-field_order',
    'progressive',
    '-color_primaries',
    'bt709',
    '-color_trc',
    'bt709',
    '-colorspace',
    'bt709',
    '-c:a',
    'aac',
    '-profile:a',
    'aac_low',
    '-b:a',
    '384k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-t',
    exactTotalDuration,
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-sn',
    '-dn',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    outputPath,
  );

  return args;
}

function concatManifestLine(filePath) {
  const escapedPath = path.resolve(filePath).replace(/'/g, "'\\''");
  return `file '${escapedPath}'`;
}

function buildBadgedStillFfmpegArgs({
  visualPath,
  badgePath,
  outputPath,
}) {
  if (!visualPath || !badgePath) {
    throw new TypeError('visualPath and badgePath are required.');
  }
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.png'
  ) {
    throw new InputValidationError(
      'The staged artwork path must end in .png.',
      'INVALID_ARTWORK_OUTPUT_EXTENSION',
    );
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    visualPath,
    '-i',
    badgePath,
    '-filter_complex',
    '[0:v:0]format=rgba,split=2[bg_src][fg_src];' +
      '[bg_src]scale=480:270:force_original_aspect_ratio=increase,' +
      'crop=480:270,scale=1920:1080:flags=bicubic,setsar=1,format=rgba[bg];' +
      '[fg_src]scale=1920:1080:force_original_aspect_ratio=decrease,' +
      'setsar=1,format=rgba[fg];' +
      '[bg][fg]overlay=(W-w)/2:(H-h)/2:format=auto[base];' +
      '[base][1:v:0]overlay=W-w-40:40:format=auto,format=rgba[out]',
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-c:v',
    'png',
    '-pix_fmt',
    'rgba',
    '-f',
    'image2',
    outputPath,
  ];
}

function buildConcatFfmpegArgs({ manifestPath, outputPath }) {
  if (!manifestPath) {
    throw new TypeError('manifestPath is required.');
  }
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.mp4'
  ) {
    throw new InputValidationError(
      'The output path must end in .mp4.',
      'INVALID_OUTPUT_EXTENSION',
    );
  }

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    manifestPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0',
    '-c',
    'copy',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-sn',
    '-dn',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

async function inspectMultiPairInputs(
  pairs,
  {
    ffprobePath,
    probeImpl = probeMedia,
    spawnImpl = spawn,
  } = {},
) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new InputValidationError(
      'At least one image and audio pair is required.',
      'PAIRS_REQUIRED',
    );
  }

  const probeOptions = { ffprobePath, spawnImpl };
  const inspectedPairs = [];
  let totalDuration = 0;

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const { audioPath, visualPath } = validateInputPaths(
      pair.audioPath,
      pair.visualPath,
    );
    const [audio, visual] = await Promise.all([
      probeImpl(audioPath, probeOptions),
      probeImpl(visualPath, probeOptions),
    ]);

    const visualType = classifyVisualPath(visualPath);
    validateProbeMetadata('audio', audio, audioPath);
    validateProbeMetadata(visualType, visual, visualPath);

    const duration = metadataDuration(audio, 'audio');
    totalDuration += duration;

    inspectedPairs.push({
      audioPath,
      visualPath,
      badgePath: pair.badgePath,
      visualType,
      duration,
      audio,
      visual,
    });
  }

  return {
    pairs: inspectedPairs,
    totalDuration,
  };
}

async function prepareAutoPairInputs(
  {
    folderPath,
    workRoot,
    ffmpegPath,
    ffprobePath,
  },
  {
    fsPromises = fsPromisesDefault,
    idFactory = randomUUID,
    probeImpl = probeMedia,
    extractArtworkImpl = extractEmbeddedArtwork,
  } = {},
) {
  if (typeof folderPath !== 'string' || folderPath.trim().length === 0) {
    throw new TypeError('folderPath is required.');
  }
  if (typeof workRoot !== 'string' || workRoot.trim().length === 0) {
    throw new TypeError('workRoot is required.');
  }
  if (!ffmpegPath || !ffprobePath) {
    throw new TypeError('ffmpegPath and ffprobePath are required.');
  }

  const absoluteFolderPath = path.resolve(folderPath);
  const absoluteWorkRoot = path.resolve(workRoot);
  await fsPromises.access(absoluteFolderPath, fs.constants.R_OK);
  await fsPromises.access(absoluteWorkRoot, fs.constants.W_OK);

  const entries = await fsPromises.readdir(absoluteFolderPath, {
    withFileTypes: true,
  });
  const audioPaths = entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name).toLowerCase() === '.mp3',
    )
    .map((entry) => path.join(absoluteFolderPath, entry.name))
    .sort((left, right) =>
      path.basename(left).localeCompare(path.basename(right), 'en', {
        numeric: true,
        sensitivity: 'base',
      }),
    );

  if (audioPaths.length === 0) {
    throw new InputValidationError(
      'The selected folder does not contain any MP3 files.',
      'AUTO_PAIR_NO_MP3',
    );
  }

  const inspected = [];
  for (const audioPath of audioPaths) {
    const audio = await probeImpl(audioPath, { ffprobePath });
    validateProbeMetadata('audio', audio, audioPath);
    const artwork = findEmbeddedArtwork(audio);
    if (!artwork) {
      throw new InputValidationError(
        `Embedded artwork is required for Auto Pair: ${path.basename(audioPath)}`,
        'AUTO_PAIR_ARTWORK_REQUIRED',
      );
    }
    inspected.push({
      audioPath,
      audio,
      artwork,
      duration: metadataDuration(audio, 'audio'),
    });
  }

  const createdArtworkPaths = [];
  try {
    const pairs = [];
    for (const item of inspected) {
      const visualPath = path.join(
        absoluteWorkRoot,
        `sound-forge-auto-artwork-${idFactory()}${artworkExtension(item.artwork)}`,
      );
      await extractArtworkImpl({
        ffmpegPath,
        audioPath: item.audioPath,
        streamIndex: item.artwork.index,
        outputPath: visualPath,
      });
      createdArtworkPaths.push(visualPath);
      pairs.push({
        audioPath: item.audioPath,
        visualPath,
        visualType: 'image',
        duration: item.duration,
        audio: item.audio,
        artwork: item.artwork,
      });
    }
    return pairs;
  } catch (error) {
    await Promise.all(
      createdArtworkPaths.map((filePath) =>
        fsPromises.rm(filePath, { force: true }).catch(() => {}),
      ),
    );
    throw error;
  }
}

async function createMultiPairMediaFile(
  {
    ffmpegPath,
    pairs,
    outputPath,
    workRoot,
    overwrite = false,
    onProgress = () => {},
  },
  {
    fsPromises = fsPromisesDefault,
    idFactory = randomUUID,
    createMediaFileImpl = createMediaFile,
    runProcessImpl = runProcess,
    spawnImpl = spawn,
  } = {},
) {
  if (!ffmpegPath) {
    throw new TypeError('ffmpegPath is required.');
  }
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new InputValidationError(
      'At least one image and audio pair is required.',
      'PAIRS_REQUIRED',
    );
  }
  if (
    typeof outputPath !== 'string' ||
    path.extname(outputPath).toLowerCase() !== '.mp4'
  ) {
    throw new InputValidationError(
      'The output path must end in .mp4.',
      'INVALID_OUTPUT_EXTENSION',
    );
  }
  if (typeof workRoot !== 'string' || workRoot.trim().length === 0) {
    throw new TypeError('workRoot is required for staged multi-pair rendering.');
  }
  if (typeof onProgress !== 'function') {
    throw new TypeError('onProgress must be a function.');
  }

  const absoluteOutputPath = path.resolve(outputPath);
  for (const pair of pairs) {
    if (
      absoluteOutputPath === path.resolve(pair.audioPath) ||
      absoluteOutputPath === path.resolve(pair.visualPath)
    ) {
      throw new InputValidationError(
        'The output path must be different from all input files.',
        'OUTPUT_MATCHES_INPUT',
      );
    }
  }

  await fsPromises.access(path.dirname(absoluteOutputPath), fs.constants.W_OK);
  await fsPromises.access(path.resolve(workRoot), fs.constants.W_OK);
  const outputExisted = await pathExists(absoluteOutputPath, fsPromises);
  if (!overwrite && outputExisted) {
    throw new InputValidationError(
      `The output file already exists: ${absoluteOutputPath}`,
      'OUTPUT_EXISTS',
    );
  }

  const tempPath = temporaryOutputPath(absoluteOutputPath, idFactory());
  if (await pathExists(tempPath, fsPromises)) {
    throw new MediaProcessError(
      `A temporary output file already exists: ${tempPath}`,
      { code: 'TEMP_OUTPUT_EXISTS' },
    );
  }

  let stageDirectory;
  const totalDuration = pairs.reduce(
    (sum, pair, index) =>
      sum + parseDurationSeconds(pair.duration, `Pair ${index + 1} audio`),
    0,
  );
  let completedDuration = 0;
  const emitProgress = (payload) => {
    try {
      onProgress(payload);
    } catch {
      // Renderer progress reporting must never interrupt an active encode.
    }
  };

  try {
    stageDirectory = await fsPromises.mkdtemp(
      path.join(path.resolve(workRoot), 'sound-forge-multi-'),
    );
    const segmentPaths = [];
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      let visualPath = pair.visualPath;
      let badgePath = pair.badgePath;
      emitProgress({
        phase: 'rendering',
        current: index + 1,
        total: pairs.length,
        percent: Math.round((completedDuration / totalDuration) * 90),
      });
      if (pair.visualType === 'image' && pair.badgePath) {
        emitProgress({
          phase: 'compositing',
          current: index + 1,
          total: pairs.length,
          percent: Math.round((completedDuration / totalDuration) * 90),
        });
        visualPath = path.join(
          stageDirectory,
          `artwork-${String(index + 1).padStart(4, '0')}.png`,
        );
        const compositeArgs = buildBadgedStillFfmpegArgs({
          visualPath: pair.visualPath,
          badgePath: pair.badgePath,
          outputPath: visualPath,
        });
        await runProcessImpl(ffmpegPath, compositeArgs, { spawnImpl });
        badgePath = undefined;
      }
      const segmentPath = path.join(
        stageDirectory,
        `segment-${String(index + 1).padStart(4, '0')}.mp4`,
      );
      await createMediaFileImpl(
        {
          ffmpegPath,
          audioPath: pair.audioPath,
          visualPath,
          visualType: pair.visualType,
          duration: pair.duration,
          outputPath: segmentPath,
          badgePath,
        },
        {
          fsPromises,
          idFactory,
          runProcessImpl,
          spawnImpl,
        },
      );
      segmentPaths.push(segmentPath);
      completedDuration += parseDurationSeconds(
        pair.duration,
        `Pair ${index + 1} audio`,
      );
      emitProgress({
        phase: 'rendering',
        current: index + 1,
        total: pairs.length,
        percent: Math.round((completedDuration / totalDuration) * 90),
      });
    }

    const manifestPath = path.join(stageDirectory, 'concat.txt');
    await fsPromises.writeFile(
      manifestPath,
      `${segmentPaths.map(concatManifestLine).join('\n')}\n`,
      'utf8',
    );
    const args = buildConcatFfmpegArgs({
      manifestPath,
      outputPath: tempPath,
    });
    emitProgress({
      phase: 'concatenating',
      current: pairs.length,
      total: pairs.length,
      percent: 95,
    });
    await runProcessImpl(ffmpegPath, args, { spawnImpl });

    if (
      !outputExisted &&
      (await pathExists(absoluteOutputPath, fsPromises))
    ) {
      throw new InputValidationError(
        `The output file was created by another process: ${absoluteOutputPath}`,
        'OUTPUT_EXISTS',
      );
    }

    await fsPromises.rename(tempPath, absoluteOutputPath);
    emitProgress({
      phase: 'complete',
      current: pairs.length,
      total: pairs.length,
      percent: 100,
    });
  } catch (error) {
    await fsPromises.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  } finally {
    if (stageDirectory) {
      await fsPromises
        .rm(stageDirectory, { recursive: true, force: true })
        .catch(() => {});
    }
  }

  return absoluteOutputPath;
}

module.exports = {
  MediaProcessError,
  artworkExtension,
  buildArtworkExtractArgs,
  buildBadgedStillFfmpegArgs,
  buildConcatFfmpegArgs,
  buildFfmpegArgs,
  buildMultiPairFfmpegArgs,
  createMediaFile,
  createMultiPairMediaFile,
  extractEmbeddedArtwork,
  findEmbeddedArtwork,
  generateOutput: createMediaFile,
  inspectInputs,
  inspectMultiPairInputs,
  metadataDuration,
  parseFfprobeJson: parseProbeJson,
  parseProbeJson,
  probeMedia,
  prepareAutoPairInputs,
  runProcess,
  validateInputs: inspectInputs,
  validateProbeMetadata,
};
