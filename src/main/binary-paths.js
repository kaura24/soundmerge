'use strict';

const fs = require('node:fs');
const path = require('node:path');

function environmentKey(binaryName) {
  return `SOUND_FORGE_${binaryName.toUpperCase()}_PATH`;
}

function uniquePaths(candidates) {
  return [...new Set(candidates.filter(Boolean))];
}

function binaryCandidates(binaryName, options) {
  const {
    app,
    appPath = app && typeof app.getAppPath === 'function'
      ? app.getAppPath()
      : process.cwd(),
    arch = process.arch,
    isPackaged = Boolean(app && app.isPackaged),
    platform = process.platform,
    resourcesPath = process.resourcesPath,
  } = options;
  const platformArch = `${platform}-${arch}`;

  if (isPackaged) {
    return uniquePaths([
      resourcesPath && path.join(resourcesPath, 'media-tools', binaryName),
      resourcesPath &&
        path.join(resourcesPath, 'bin', platformArch, binaryName),
      resourcesPath && path.join(resourcesPath, 'bin', arch, binaryName),
      resourcesPath && path.join(resourcesPath, 'bin', binaryName),
      resourcesPath &&
        path.join(resourcesPath, 'binaries', platformArch, binaryName),
    ]);
  }

  return uniquePaths([
    path.join(appPath, 'vendor', 'media-tools', binaryName),
    path.join(appPath, 'assets', 'bin', platformArch, binaryName),
    path.join(appPath, 'assets', 'bin', arch, binaryName),
    path.join(appPath, 'assets', 'bin', binaryName),
    path.join('/usr/local/bin', binaryName),
    path.join('/opt/homebrew/bin', binaryName),
  ]);
}

function resolveBinaryPath(binaryName, options = {}) {
  if (binaryName !== 'ffmpeg' && binaryName !== 'ffprobe') {
    throw new TypeError(`Unsupported media binary: ${binaryName}`);
  }

  const {
    env = process.env,
    existsSync = fs.existsSync,
  } = options;
  const overrideKey = environmentKey(binaryName);
  const configuredPath = env[overrideKey];

  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new Error(
        `${overrideKey} points to a missing ${binaryName} binary: ${configuredPath}`,
      );
    }
    return configuredPath;
  }

  const candidates = binaryCandidates(binaryName, options);
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  if (resolvedPath) {
    return resolvedPath;
  }

  throw new Error(
    `Unable to find the bundled ${binaryName} binary. Checked: ${candidates.join(
      ', ',
    )}`,
  );
}

function resolveBinaryPaths(options = {}) {
  return {
    ffmpegPath: resolveBinaryPath('ffmpeg', options),
    ffprobePath: resolveBinaryPath('ffprobe', options),
  };
}

module.exports = {
  binaryCandidates,
  resolveBinaryPath,
  resolveBinaryPaths,
};
