'use strict';

const path = require('node:path');

const AUDIO_EXTENSIONS = new Set(['.mp3']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const VIDEO_EXTENSIONS = new Set(['.mp4']);

class InputValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'InputValidationError';
    this.code = code;
  }
}

function normalizedExtension(filePath) {
  if (typeof filePath !== 'string') {
    return '';
  }

  return path.extname(filePath.trim()).toLowerCase();
}

function classifyVisualPath(filePath) {
  const extension = normalizedExtension(filePath);

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  return null;
}

function validateInputPaths(audioPath, visualPath) {
  if (typeof audioPath !== 'string' || audioPath.trim() === '') {
    throw new InputValidationError(
      'An MP3 file is required.',
      'AUDIO_REQUIRED',
    );
  }

  if (!AUDIO_EXTENSIONS.has(normalizedExtension(audioPath))) {
    throw new InputValidationError(
      'Only MP3 audio is supported.',
      'UNSUPPORTED_AUDIO_EXTENSION',
    );
  }

  if (typeof visualPath !== 'string' || visualPath.trim() === '') {
    throw new InputValidationError(
      'An image or H.264 MP4 file is required.',
      'VISUAL_REQUIRED',
    );
  }

  const visualType = classifyVisualPath(visualPath);
  if (!visualType) {
    throw new InputValidationError(
      'Only JPG, JPEG, PNG, or H.264 MP4 visual input is supported.',
      'UNSUPPORTED_VISUAL_EXTENSION',
    );
  }

  return {
    audioPath,
    visualPath,
    visualType,
  };
}

function parseDurationSeconds(value, label = 'Media') {
  const duration = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new InputValidationError(
      `${label} does not report a valid duration.`,
      'INVALID_DURATION',
    );
  }

  return duration;
}

function parseFrameRate(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parts = value.split('/');
  if (parts.length === 2) {
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    const rate = numerator / denominator;
    return Number.isFinite(rate) && rate > 0 ? rate : null;
  }

  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function formatMediaTime(value) {
  const totalSeconds =
    Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const twoDigits = (part) => String(part).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
  }

  return `${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

function validateMultiPairInputPaths(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new InputValidationError(
      'At least one image and audio pair is required.',
      'PAIRS_REQUIRED',
    );
  }

  return pairs.map((pair, index) => {
    if (!pair || typeof pair !== 'object') {
      throw new InputValidationError(
        `Pair at position ${index + 1} is invalid.`,
        'INVALID_PAIR',
      );
    }
    const validated = validateInputPaths(pair.audioPath, pair.visualPath);
    return validated;
  });
}

module.exports = {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  InputValidationError,
  VIDEO_EXTENSIONS,
  classifyVisualPath,
  formatDuration: formatMediaTime,
  formatMediaTime,
  normalizedExtension,
  parseDuration: parseDurationSeconds,
  parseDurationSeconds,
  parseFrameRate,
  validateInputPaths,
  validateMultiPairInputPaths,
};
