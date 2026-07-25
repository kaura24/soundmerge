"use strict";

const api = window.soundForge;

const elements = {
  addPairBtn: document.querySelector("#addPairBtn"),
  appVersion: document.querySelector("#appVersion"),
  audioCard: document.querySelector("#audioCard"),
  audioMeta: document.querySelector("#audioMeta"),
  audioName: document.querySelector("#audioName"),
  busyPanel: document.querySelector("#busyPanel"),
  completionCard: document.querySelector("#completionCard"),
  completionPath: document.querySelector("#completionPath"),
  controlRack: document.querySelector(".control-rack"),
  currentTime: document.querySelector("#currentTime"),
  dismissErrorButton: document.querySelector("#dismissErrorButton"),
  errorMessage: document.querySelector("#errorMessage"),
  errorPanel: document.querySelector("#errorPanel"),
  modeMultiBtn: document.querySelector("#modeMultiBtn"),
  modeSingleBtn: document.querySelector("#modeSingleBtn"),
  monitorFrame: document.querySelector("#monitorFrame"),
  monitorPlaceholder: document.querySelector("#monitorPlaceholder"),
  multiModeSection: document.querySelector("#multiModeSection"),
  openOutputButton: document.querySelector("#openOutputButton"),
  outputCard: document.querySelector(".output-card"),
  outputName: document.querySelector("#outputName"),
  outputPath: document.querySelector("#outputPath"),
  pairList: document.querySelector("#pairList"),
  pauseIcon: document.querySelector("#pauseIcon"),
  playIcon: document.querySelector("#playIcon"),
  playOutputButton: document.querySelector("#playOutputButton"),
  playPauseButton: document.querySelector("#playPauseButton"),
  previewCanvas: document.querySelector("#previewCanvas"),
  renderButton: document.querySelector("#renderButton"),
  resultPlayer: document.querySelector("#resultPlayer"),
  revealOutputButton: document.querySelector("#revealOutputButton"),
  resetButton: document.querySelector("#resetButton"),
  selectAudioButton: document.querySelector("#selectAudioButton"),
  selectOutputButton: document.querySelector("#selectOutputButton"),
  selectVisualButton: document.querySelector("#selectVisualButton"),
  singleModeSection: document.querySelector("#singleModeSection"),
  statusLamp: document.querySelector(".status-lamp"),
  systemStatus: document.querySelector("#systemStatus"),
  timeline: document.querySelector("#timeline"),
  totalTime: document.querySelector("#totalTime"),
  visualCard: document.querySelector("#visualCard"),
  visualMeta: document.querySelector("#visualMeta"),
  visualName: document.querySelector("#visualName"),
  artworkOption: document.querySelector(".artwork-option"),
  useArtworkCheckbox: document.querySelector("#useArtworkCheckbox"),
  showTitleBadgeCheckbox: document.querySelector("#showTitleBadgeCheckbox"),
  badgeInputWrap: document.querySelector("#badgeInputWrap"),
  titleBadgeInput: document.querySelector("#titleBadgeInput"),
};

const previewAudio = new Audio();
const previewVideo = document.createElement("video");
const previewImage = new Image();
const canvasContext = elements.previewCanvas.getContext("2d");

previewAudio.preload = "metadata";
previewVideo.preload = "auto";
previewVideo.muted = true;
previewVideo.loop = true;
previewVideo.playsInline = true;

const state = {
  mode: "single", // "single" | "multi"
  audio: null,
  visual: null,
  pairs: [],
  outputPath: "",
  outputFileUrl: "",
  isBusy: false,
  animationFrame: null,
  activePairIndex: 0,
  previewPairOffset: 0,
  showTitleBadge: false,
  titleBadgeText: "",
};

function readableError(error, fallback) {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function showError(error, fallback = "Something unexpected happened. Please try again.") {
  elements.errorMessage.textContent = readableError(error, fallback);
  elements.errorPanel.hidden = false;
}

function clearError() {
  elements.errorPanel.hidden = true;
  elements.errorMessage.textContent = "";
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds]
      .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
      .join(":");
  }

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return "";
  }

  return `${width} × ${height}`;
}

function basename(filePath) {
  return String(filePath || "").split(/[\\/]/).pop() || "output.mp4";
}

function outputSuggestion() {
  const sourceName = state.audio?.name || "sound-forge-master.mp3";
  const stem = sourceName.replace(/\.[^.]+$/, "").trim() || "sound-forge-master";
  return `${stem}-master.mp4`;
}

function filePathToUrl(filePath) {
  if (!filePath) {
    return "";
  }

  const normalized = String(filePath).replace(/\\/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return encodeURI(`file://${prefixed}`).replaceAll("#", "%23").replaceAll("?", "%3F");
}

function mediaFileUrl(media) {
  return media?.fileUrl || filePathToUrl(media?.path);
}

function pairOffset(index) {
  return state.pairs
    .slice(0, index)
    .reduce((sum, pair) => sum + (Number(pair.audio?.duration) || 0), 0);
}

function previewTimelinePosition() {
  if (state.mode === "multi") {
    return state.previewPairOffset + (Number(previewAudio.currentTime) || 0);
  }

  return Number(previewAudio.currentTime) || 0;
}

function durationFromState() {
  if (state.mode === "multi") {
    return state.pairs.reduce((sum, p) => sum + (Number(p.audio?.duration) || 0), 0);
  }

  if (Number.isFinite(previewAudio.duration)) {
    return previewAudio.duration;
  }

  return Number(state.audio?.duration) || 0;
}

function refreshTimeline() {
  const duration = durationFromState();
  const current = Math.min(previewTimelinePosition(), duration);
  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  const hasMedia = state.mode === "multi"
    ? (state.pairs.length > 0 && state.pairs.some(p => p.audio))
    : Boolean(state.audio);

  const canPlay = state.mode === "multi"
    ? (state.pairs.length > 0 && state.pairs.every(p => p.audio && p.visual))
    : Boolean(state.audio && state.visual);

  elements.timeline.max = String(duration);
  elements.timeline.value = String(Math.min(current, duration));
  elements.timeline.style.setProperty("--progress", `${progress}%`);
  elements.currentTime.textContent = formatDuration(current);
  elements.totalTime.textContent = formatDuration(duration);
  elements.timeline.disabled = !hasMedia || duration <= 0 || state.isBusy;
  elements.playPauseButton.disabled = !canPlay || duration <= 0 || state.isBusy;
}

function setTransportPlaying(isPlaying) {
  elements.playIcon.hidden = isPlaying;
  elements.pauseIcon.hidden = !isPlaying;
  elements.playPauseButton.setAttribute("aria-label", isPlaying ? "Pause preview" : "Play preview");
}

function setSystemStatus(label, mode = "standby") {
  elements.systemStatus.textContent = label;
  elements.statusLamp.classList.toggle("is-busy", mode === "busy");
  elements.statusLamp.classList.toggle("is-ready", mode === "ready");
}

function updateActionAvailability() {
  const canRender = state.mode === "multi"
    ? (state.pairs.length > 0 && state.pairs.every(p => p.audio && p.visual) && Boolean(state.outputPath) && !state.isBusy)
    : (Boolean(state.audio && state.visual && state.outputPath) && !state.isBusy);

  elements.renderButton.disabled = !canRender;
  elements.selectAudioButton.disabled = state.isBusy;
  elements.selectVisualButton.disabled = state.isBusy;
  elements.selectOutputButton.disabled = state.isBusy;
  elements.useArtworkCheckbox.disabled = state.isBusy || !state.audio?.hasEmbeddedArtwork;
  if (elements.showTitleBadgeCheckbox) elements.showTitleBadgeCheckbox.disabled = state.isBusy;
  if (elements.titleBadgeInput) elements.titleBadgeInput.disabled = state.isBusy;
  refreshTimeline();
}

function clearCompletion() {
  elements.completionCard.hidden = true;
  elements.completionPath.textContent = "";
  state.outputFileUrl = "";
  stopResultPlayback();
}

function stopResultPlayback() {
  elements.resultPlayer.pause();
  elements.resultPlayer.hidden = true;
  elements.resultPlayer.removeAttribute("src");
  elements.resultPlayer.load();
}

function pausePreview() {
  previewAudio.pause();
  previewVideo.pause();
  setTransportPlaying(false);
}

function waitForAudioMetadata() {
  if (previewAudio.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    previewAudio.addEventListener("loadedmetadata", resolve, { once: true });
    previewAudio.addEventListener("error", reject, { once: true });
  });
}

function waitForVideoMetadata() {
  if (previewVideo.readyState >= 1) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    previewVideo.addEventListener("loadedmetadata", resolve, { once: true });
    previewVideo.addEventListener("error", reject, { once: true });
  });
}

async function loadMultiPairPreview(index, relativeTime = 0) {
  const pair = state.pairs[index];
  if (!pair?.audio || !pair.visual) {
    throw new Error("Choose both an audio track and a visual source for every pair before previewing.");
  }

  state.activePairIndex = index;
  state.previewPairOffset = pairOffset(index);
  const audioUrl = mediaFileUrl(pair.audio);
  if (previewAudio.src !== audioUrl) {
    previewAudio.src = audioUrl;
    previewAudio.load();
    await waitForAudioMetadata();
  }

  const duration = Number(pair.audio.duration) || previewAudio.duration || 0;
  previewAudio.currentTime = Math.max(0, Math.min(Number(relativeTime) || 0, duration));
  syncVisualSource(pair.visual);
  drawPreview();
}

async function seekMultiPairPreview(position) {
  const duration = durationFromState();
  const target = Math.max(0, Math.min(Number(position) || 0, duration));
  let index = 0;
  let offset = 0;

  for (let i = 0; i < state.pairs.length; i += 1) {
    const pairDuration = Number(state.pairs[i].audio?.duration) || 0;
    if (target < offset + pairDuration || i === state.pairs.length - 1) {
      index = i;
      break;
    }
    offset += pairDuration;
  }

  const wasPlaying = !previewAudio.paused;
  pausePreview();
  await loadMultiPairPreview(index, target - offset);
  if (wasPlaying) {
    await playLoadedMultiPair();
  }
  refreshTimeline();
}

function syncVideoToAudio(force = false) {
  const visual = getCurrentVisual();
  if (
    visual?.kind !== "video" ||
    !Number.isFinite(previewVideo.duration) ||
    previewVideo.duration <= 0
  ) {
    return;
  }

  const relativeAudioTime = state.mode === "multi"
    ? previewTimelinePosition() - state.previewPairOffset
    : previewAudio.currentTime;
  const target = relativeAudioTime % previewVideo.duration;
  if (force || Math.abs(previewVideo.currentTime - target) > 0.16) {
    previewVideo.currentTime = target;
  }
}

const offscreenCanvas = document.createElement("canvas");
const offscreenContext = offscreenCanvas.getContext("2d");

function drawSourceToContext(ctx, width, height, source, sourceWidth, sourceHeight) {
  if (!sourceWidth || !sourceHeight) {
    return;
  }

  ctx.fillStyle = "#090b0a";
  ctx.fillRect(0, 0, width, height);

  const coverScale = Math.max(width / sourceWidth, height / sourceHeight);
  const coverWidth = sourceWidth * coverScale;
  const coverHeight = sourceHeight * coverScale;
  const coverX = (width - coverWidth) / 2;
  const coverY = (height - coverHeight) / 2;

  ctx.drawImage(source, coverX, coverY, coverWidth, coverHeight);

  const containScale = Math.min(width / sourceWidth, height / sourceHeight);
  const containWidth = sourceWidth * containScale;
  const containHeight = sourceHeight * containScale;
  const containX = (width - containWidth) / 2;
  const containY = (height - containHeight) / 2;

  ctx.drawImage(source, containX, containY, containWidth, containHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
  ctx.strokeRect(containX, containY, containWidth, containHeight);
}

function getCurrentVisual() {
  if (state.mode === "single") {
    return state.visual;
  }

  if (state.mode === "multi" && state.pairs.length > 0) {
    const current = previewTimelinePosition();
    let accumulated = 0;
    for (const pair of state.pairs) {
      const dur = Number(pair.audio?.duration) || 0;
      if (current >= accumulated && current <= accumulated + dur) {
        return pair.visual;
      }
      accumulated += dur;
    }
    return state.pairs[state.pairs.length - 1]?.visual || null;
  }

  return null;
}

const badgeCanvasCache = new Map();

function getTitleBadgeCanvas(text) {
  if (badgeCanvasCache.has(text)) {
    return badgeCanvasCache.get(text);
  }
  if (badgeCanvasCache.size > 50) {
    badgeCanvasCache.clear();
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "700 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const textWidth = Math.ceil(metrics.width);

  const paddingLeft = 24;
  const iconWidth = 32;
  const iconGap = 14;
  const paddingRight = 28;
  const boxWidth = paddingLeft + iconWidth + iconGap + textWidth + paddingRight;
  const boxHeight = 76;

  const shadowPaddingX = 24;
  const shadowPaddingY = 24;
  canvas.width = boxWidth + shadowPaddingX * 2;
  canvas.height = boxHeight + shadowPaddingY * 2;

  const boxX = shadowPaddingX;
  const boxY = shadowPaddingY;

  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 38);
  } else {
    const r = 38;
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxWidth - r, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + r);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - r);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - r, boxY + boxHeight);
    ctx.lineTo(boxX + r, boxY + boxHeight);
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
  }
  ctx.fillStyle = "rgba(16, 19, 18, 0.88)";
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(227, 168, 78, 0.7)";
  ctx.stroke();

  const iconStartX = boxX + paddingLeft;
  const iconCenterY = boxY + boxHeight / 2;

  ctx.fillStyle = "#e3a84e";
  ctx.fillRect(iconStartX, iconCenterY - 6, 4, 12);
  ctx.fillStyle = "#ffc872";
  ctx.fillRect(iconStartX + 8, iconCenterY - 12, 4, 24);
  ctx.fillStyle = "#e3a84e";
  ctx.fillRect(iconStartX + 16, iconCenterY - 8, 4, 16);
  ctx.fillStyle = "#c28e38";
  ctx.fillRect(iconStartX + 24, iconCenterY - 10, 4, 20);

  ctx.font = font;
  ctx.fillStyle = "#eee8dc";
  ctx.textBaseline = "middle";
  ctx.fillText(text, iconStartX + iconWidth + iconGap, iconCenterY);

  badgeCanvasCache.set(text, canvas);
  return canvas;
}

function getTitleBadgeDataUrl(text) {
  return getTitleBadgeCanvas(text).toDataURL("image/png");
}

function getCurrentPair() {
  if (state.mode !== "multi" || state.pairs.length === 0) return null;
  const current = previewTimelinePosition();
  let accumulated = 0;
  for (const pair of state.pairs) {
    const dur = Number(pair.audio?.duration) || 0;
    if (current >= accumulated && current <= accumulated + dur) {
      return pair;
    }
    accumulated += dur;
  }
  return state.pairs[state.pairs.length - 1] || null;
}

function getActiveBadgeText() {
  if (state.mode === "single") {
    if (state.titleBadgeText && state.titleBadgeText.trim()) {
      return state.titleBadgeText.trim();
    }
    if (state.audio?.name) {
      return state.audio.name.replace(/\.[^/.]+$/, "");
    }
    return "Sound Forge Master";
  } else if (state.mode === "multi") {
    const pair = getCurrentPair();
    if (pair) {
      if (pair.titleBadgeText && pair.titleBadgeText.trim()) {
        return pair.titleBadgeText.trim();
      }
      if (pair.audio?.name) {
        return pair.audio.name.replace(/\.[^/.]+$/, "");
      }
    }
    if (state.titleBadgeText && state.titleBadgeText.trim()) {
      return state.titleBadgeText.trim();
    }
    return "Sound Forge Multi-Master";
  }
  return "";
}

let activeVisualUrl = "";

function syncVisualSource(visual) {
  if (!visual) {
    activeVisualUrl = "";
    return;
  }

  const url = mediaFileUrl(visual);
  if (url === activeVisualUrl) {
    return;
  }
  activeVisualUrl = url;

  const kind = normalizedVisualKind(visual);
  if (kind === "video") {
    previewImage.removeAttribute("src");
    previewVideo.src = url;
    previewVideo.load();
  } else {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
    previewImage.src = url;
  }
}

function drawPreview() {
  const width = elements.previewCanvas.width;
  const height = elements.previewCanvas.height;

  if (width <= 0 || height <= 0) {
    return;
  }

  const currentVisual = getCurrentVisual();
  if (state.mode === "multi" && currentVisual) {
    syncVisualSource(currentVisual);
  }

  const visual = currentVisual || state.visual;
  const kind = visual ? normalizedVisualKind(visual) : null;

  const isVideoReady = kind === "video" && previewVideo.readyState >= 2 && previewVideo.videoWidth > 0;
  const isImageReady = kind === "image" && previewImage.complete && previewImage.naturalWidth > 0;

  canvasContext.clearRect(0, 0, width, height);

  if (isVideoReady || isImageReady) {
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    if (isVideoReady) {
      drawSourceToContext(offscreenContext, width, height, previewVideo, previewVideo.videoWidth, previewVideo.videoHeight);
    } else {
      drawSourceToContext(offscreenContext, width, height, previewImage, previewImage.naturalWidth, previewImage.naturalHeight);
    }

    canvasContext.drawImage(offscreenCanvas, 0, 0);
  } else {
    canvasContext.fillStyle = "#090b0a";
    canvasContext.fillRect(0, 0, width, height);
  }

  if (state.showTitleBadge) {
    const badgeText = getActiveBadgeText();
    if (badgeText) {
      const badgeCanvas = getTitleBadgeCanvas(badgeText);
      const scale = width / 1920;
      const destW = badgeCanvas.width * scale;
      const destH = badgeCanvas.height * scale;
      const destX = width - destW - (40 * scale);
      const destY = 40 * scale;
      canvasContext.drawImage(badgeCanvas, destX, destY, destW, destH);
    }
  }

  if (!previewAudio.paused && kind === "video") {
    state.animationFrame = window.requestAnimationFrame(drawPreview);
  } else {
    state.animationFrame = null;
  }
}

function resizeCanvas() {
  const bounds = elements.previewCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const nextWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const nextHeight = Math.max(1, Math.round(bounds.height * pixelRatio));

  if (
    elements.previewCanvas.width !== nextWidth ||
    elements.previewCanvas.height !== nextHeight
  ) {
    elements.previewCanvas.width = nextWidth;
    elements.previewCanvas.height = nextHeight;
  }

  drawPreview();
}

function startDrawing() {
  if (state.animationFrame !== null) {
    window.cancelAnimationFrame(state.animationFrame);
  }
  drawPreview();
}

async function playLoadedMultiPair() {
  const visual = getCurrentVisual();
  if (visual?.kind === "video") {
    await waitForVideoMetadata();
    syncVideoToAudio(true);
    await previewVideo.play();
  }
  await previewAudio.play();
  setTransportPlaying(true);
  startDrawing();
}

async function playMultiPreview() {
  if (
    state.pairs.length === 0 ||
    !state.pairs.every((pair) => pair.audio && pair.visual)
  ) {
    showError("Choose both an audio track and a visual source for every pair before previewing.");
    return;
  }

  const totalDuration = durationFromState();
  const currentPair = state.pairs[state.activePairIndex];
  const currentUrl = currentPair ? mediaFileUrl(currentPair.audio) : "";
  const needsReset =
    !currentPair ||
    !previewAudio.src ||
    previewAudio.src !== currentUrl ||
    previewTimelinePosition() >= totalDuration;

  try {
    if (needsReset) {
      await loadMultiPairPreview(0, 0);
    } else {
      syncVisualSource(currentPair.visual);
      drawPreview();
    }
    await playLoadedMultiPair();
  } catch (error) {
    pausePreview();
    showError(error, "The selected media could not be played.");
  }
}

async function playPreview() {
  clearError();
  stopResultPlayback();

  if (state.mode === "multi") {
    await playMultiPreview();
    return;
  }

  if (!state.audio || !state.visual) {
    showError("Choose both an audio track and a visual source before previewing.");
    return;
  }

  if (previewAudio.ended || previewAudio.currentTime >= durationFromState()) {
    previewAudio.currentTime = 0;
  }

  try {
    if (state.visual.kind === "video") {
      syncVideoToAudio(true);
      await previewVideo.play();
    }
    await previewAudio.play();
    setTransportPlaying(true);
    startDrawing();
  } catch (error) {
    pausePreview();
    showError(error, "The selected media could not be played.");
  }
}

async function togglePreview() {
  if (previewAudio.paused) {
    await playPreview();
  } else {
    pausePreview();
  }
}

function setAudio(media) {
  pausePreview();
  clearCompletion();
  if (state.visual?.source === "audio-artwork") {
    clearVisualSelection();
  }
  state.audio = media;
  previewAudio.src = mediaFileUrl(media);
  previewAudio.load();

  elements.audioName.textContent = media.name || basename(media.path);
  elements.audioMeta.textContent = `${formatDuration(Number(media.duration))} · MP3 · master duration`;
  elements.audioCard.classList.add("is-selected");
  elements.monitorFrame.classList.add("has-audio");
  elements.useArtworkCheckbox.checked = false;
  elements.useArtworkCheckbox.disabled = !media.hasEmbeddedArtwork;
  elements.useArtworkCheckbox.title = media.hasEmbeddedArtwork
    ? "Use the original cover image embedded in this MP3."
    : "This MP3 does not contain embedded artwork.";
  refreshTimeline();
  updateActionAvailability();
}

function normalizedVisualKind(media) {
  if (media?.kind === "video" || media?.kind === "image") {
    return media.kind;
  }

  return /\.mp4$/i.test(media?.name || media?.path || "") ? "video" : "image";
}

function setVisual(media, source = "manual") {
  pausePreview();
  clearCompletion();

  const kind = normalizedVisualKind(media);
  state.visual = { ...media, kind, source };
  const dimensions = formatDimensions(Number(media.width), Number(media.height));
  const detail = kind === "video"
    ? `${dimensions || "Video"} · ${formatDuration(Number(media.duration))} · loops to audio`
    : `${dimensions || "Image"} · held for full track`;

  elements.visualName.textContent = media.name || basename(media.path);
  elements.visualMeta.textContent = detail;
  elements.visualCard.classList.add("is-selected");
  elements.monitorPlaceholder.hidden = true;
  elements.useArtworkCheckbox.checked = source === "audio-artwork";
  stopResultPlayback();

  if (kind === "video") {
    previewImage.removeAttribute("src");
    previewVideo.src = mediaFileUrl(media);
    previewVideo.load();
  } else {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
    previewImage.src = mediaFileUrl(media);
  }

  updateActionAvailability();
}

function clearVisualSelection() {
  pausePreview();
  stopResultPlayback();
  state.visual = null;
  previewImage.removeAttribute("src");
  previewVideo.removeAttribute("src");
  previewVideo.load();
  elements.visualName.textContent = "Choose a visual file";
  elements.visualMeta.textContent = "Still image or looping H.264 video";
  elements.visualCard.classList.remove("is-selected");
  elements.monitorPlaceholder.hidden = false;
  drawPreview();
  updateActionAvailability();
}

async function toggleEmbeddedArtwork() {
  if (!state.audio) {
    elements.useArtworkCheckbox.checked = false;
    showError("Choose an MP3 before using its embedded artwork.");
    return;
  }

  if (!elements.useArtworkCheckbox.checked) {
    if (state.visual?.source === "audio-artwork") {
      clearVisualSelection();
    }
    return;
  }

  clearError();
  try {
    const media = await api.extractArtwork(state.audio.path);
    setVisual(media, "audio-artwork");
  } catch (error) {
    elements.useArtworkCheckbox.checked = false;
    showError(error, "The selected MP3 does not contain embedded artwork.");
  }
}

function setOutput(output) {
  const selectedPath =
    typeof output === "string" ? output : output?.outputPath || output?.path;
  if (!selectedPath) {
    return;
  }

  clearCompletion();
  state.outputPath = selectedPath;
  elements.outputName.textContent = basename(selectedPath);
  elements.outputPath.textContent = selectedPath;
  elements.outputPath.title = selectedPath;
  elements.outputCard.classList.add("is-selected");
  updateActionAvailability();
}

function resetSession() {
  pausePreview();
  clearCompletion();
  clearError();

  previewAudio.pause();
  previewAudio.removeAttribute("src");
  previewAudio.load();
  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();
  previewImage.removeAttribute("src");

  state.audio = null;
  state.visual = null;
  state.pairs = [];
  state.activePairIndex = 0;
  state.previewPairOffset = 0;
  state.outputPath = "";
  state.outputFileUrl = "";

  elements.audioName.textContent = "Choose an audio file";
  elements.audioMeta.textContent = "MP3 · one track";
  elements.visualName.textContent = "Choose a visual file";
  elements.visualMeta.textContent = "Still image or looping H.264 video";
  elements.outputName.textContent = "Choose destination";
  elements.outputPath.textContent = "Set the folder and filename";
  elements.outputPath.removeAttribute("title");
  elements.audioCard.classList.remove("is-selected");
  elements.visualCard.classList.remove("is-selected");
  elements.outputCard.classList.remove("is-selected");
  elements.monitorFrame.classList.remove("has-audio");
  elements.monitorPlaceholder.hidden = false;
  elements.useArtworkCheckbox.checked = false;
  elements.useArtworkCheckbox.disabled = true;
  elements.useArtworkCheckbox.title = "Choose an MP3 to check for embedded artwork.";
  state.showTitleBadge = false;
  state.titleBadgeText = "";
  if (elements.showTitleBadgeCheckbox) elements.showTitleBadgeCheckbox.checked = false;
  if (elements.titleBadgeInput) {
    elements.titleBadgeInput.value = "";
    if (elements.badgeInputWrap) elements.badgeInputWrap.hidden = true;
  }
  renderPairList();
  switchMode("single");
  setSystemStatus("ENGINE STANDBY", "standby");
  drawPreview();
  updateActionAvailability();
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  elements.busyPanel.hidden = !isBusy;
  elements.renderButton.hidden = isBusy;
  elements.controlRack.setAttribute("aria-busy", String(isBusy));
  if (isBusy) {
    setSystemStatus("ENGINE ACTIVE", "busy");
  }
  updateActionAvailability();
}

async function selectAudio() {
  clearError();
  try {
    const media = await api.selectAudio();
    if (media) {
      setAudio(media);
    }
  } catch (error) {
    showError(error, "The audio chooser could not be opened.");
  }
}

async function selectVisual() {
  clearError();
  try {
    const media = await api.selectVisual();
    if (media) {
      setVisual(media);
    }
  } catch (error) {
    showError(error, "The visual chooser could not be opened.");
  }
}

async function selectOutput() {
  clearError();
  try {
    const output = await api.selectOutput(outputSuggestion());
    if (output) {
      setOutput(output);
    }
  } catch (error) {
    showError(error, "The save location chooser could not be opened.");
  }
}

function renderResultPath(result) {
  if (typeof result === "string") {
    return result;
  }

  return result?.outputPath || result?.path || state.outputPath;
}

async function selectPairAudio(index) {
  clearError();
  try {
    const media = await api.selectAudio();
    if (media && state.pairs[index]) {
      state.pairs[index].audio = media;
      if (state.pairs[index].visual?.source === "audio-artwork") {
        state.pairs[index].visual = null;
      }
      renderPairList();
      updateActionAvailability();
    }
  } catch (error) {
    showError(error, "The audio chooser could not be opened.");
  }
}

async function selectPairArtwork(index) {
  clearError();
  const pair = state.pairs[index];
  if (!pair?.audio) {
    showError("Choose an MP3 for this pair before using its embedded artwork.");
    return;
  }
  if (!pair.audio.hasEmbeddedArtwork) {
    showError("The selected MP3 does not contain embedded artwork.");
    return;
  }

  try {
    const media = await api.extractArtwork(pair.audio.path);
    if (state.pairs[index]) {
      state.pairs[index].visual = { ...media, kind: "image", source: "audio-artwork" };
      renderPairList();
      updateActionAvailability();
    }
  } catch (error) {
    showError(error, "The selected MP3 does not contain embedded artwork.");
  }
}

async function selectPairVisual(index) {
  clearError();
  try {
    const media = await api.selectVisual();
    if (media && state.pairs[index]) {
      const kind = normalizedVisualKind(media);
      state.pairs[index].visual = { ...media, kind };
      renderPairList();
      updateActionAvailability();
    }
  } catch (error) {
    showError(error, "The visual chooser could not be opened.");
  }
}

function addPair() {
  state.pairs.push({
    id: Date.now() + Math.random(),
    audio: null,
    visual: null,
  });
  renderPairList();
  updateActionAvailability();
}

function renderPairList() {
  elements.pairList.innerHTML = "";
  state.pairs.forEach((pair, index) => {
    const item = document.createElement("div");
    item.className = "pair-item";

    const header = document.createElement("div");
    header.className = "pair-item__header";
    header.innerHTML = `
      <span class="pair-item__title">PAIR #${index + 1}</span>
      <div class="pair-item__controls">
        ${index > 0 ? `<button class="pair-btn" data-action="up" data-index="${index}">▲</button>` : ''}
        ${index < state.pairs.length - 1 ? `<button class="pair-btn" data-action="down" data-index="${index}">▼</button>` : ''}
        <button class="pair-btn pair-btn--danger" data-action="remove" data-index="${index}">✕</button>
      </div>
    `;

    const pickers = document.createElement("div");
    pickers.className = "pair-pickers";

    const audioBtn = document.createElement("button");
    audioBtn.type = "button";
    audioBtn.className = "pair-picker-btn";
    audioBtn.innerHTML = pair.audio
      ? `<strong>${pair.audio.name}</strong><small>${formatDuration(Number(pair.audio.duration))} · MP3</small>`
      : `<strong>Select MP3</strong><small>Audio Source</small>`;
    audioBtn.addEventListener("click", () => selectPairAudio(index));

    const visualBtn = document.createElement("button");
    visualBtn.type = "button";
    visualBtn.className = "pair-picker-btn";
    visualBtn.innerHTML = pair.visual
      ? `<strong>${pair.visual.name}</strong><small>Visual Source</small>`
      : `<strong>Select Image</strong><small>Visual Source</small>`;
    visualBtn.addEventListener("click", () => selectPairVisual(index));

    const artworkBtn = document.createElement("button");
    artworkBtn.type = "button";
    artworkBtn.className = "pair-picker-btn pair-artwork-btn";
    artworkBtn.disabled = !pair.audio?.hasEmbeddedArtwork;
    artworkBtn.innerHTML = pair.visual?.source === "audio-artwork"
      ? `<strong>Embedded artwork selected</strong><small>Original MP3 cover image</small>`
      : `<strong>Use MP3 artwork</strong><small>${pair.audio?.hasEmbeddedArtwork ? "Available" : "Not available"}</small>`;
    artworkBtn.addEventListener("click", () => selectPairArtwork(index));

    pickers.appendChild(audioBtn);
    pickers.appendChild(visualBtn);
    pickers.appendChild(artworkBtn);

    item.appendChild(header);
    item.appendChild(pickers);

    if (state.showTitleBadge) {
      const badgeWrap = document.createElement("div");
      badgeWrap.className = "multi-pair-badge-wrap";
      const badgeInput = document.createElement("input");
      badgeInput.type = "text";
      badgeInput.className = "badge-text-input";
      badgeInput.placeholder = pair.audio ? `Title: ${pair.audio.name.replace(/\\.[^/.]+$/, "")}` : "Custom song title for this pair";
      badgeInput.value = pair.titleBadgeText || "";
      badgeInput.addEventListener("input", (e) => {
        pair.titleBadgeText = e.target.value;
        drawPreview();
      });
      badgeWrap.appendChild(badgeInput);
      item.appendChild(badgeWrap);
    }

    header.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = Number(btn.dataset.index);
      if (action === "remove") {
        state.pairs.splice(idx, 1);
        renderPairList();
        updateActionAvailability();
      } else if (action === "up" && idx > 0) {
        const temp = state.pairs[idx];
        state.pairs[idx] = state.pairs[idx - 1];
        state.pairs[idx - 1] = temp;
        renderPairList();
        updateActionAvailability();
      } else if (action === "down" && idx < state.pairs.length - 1) {
        const temp = state.pairs[idx];
        state.pairs[idx] = state.pairs[idx + 1];
        state.pairs[idx + 1] = temp;
        renderPairList();
        updateActionAvailability();
      }
    });

    elements.pairList.appendChild(item);
  });
}

function switchMode(mode) {
  state.mode = mode;
  elements.modeSingleBtn.classList.toggle("mode-tab--active", mode === "single");
  elements.modeSingleBtn.setAttribute("aria-selected", String(mode === "single"));
  elements.modeMultiBtn.classList.toggle("mode-tab--active", mode === "multi");
  elements.modeMultiBtn.setAttribute("aria-selected", String(mode === "multi"));

  elements.singleModeSection.hidden = mode !== "single";
  elements.multiModeSection.hidden = mode !== "multi";

  if (mode === "multi" && state.pairs.length === 0) {
    addPair();
  }

  updateActionAvailability();
}

async function renderMaster() {
  clearError();
  clearCompletion();

  if (state.mode === "multi") {
    if (
      state.pairs.length === 0 ||
      !state.pairs.every((p) => p.audio && p.visual) ||
      !state.outputPath
    ) {
      showError("Ensure all Image + Audio pairs are selected and output destination is set.");
      return;
    }
  } else if (!state.audio || !state.visual || !state.outputPath) {
    showError("Choose an audio track, a visual source, and an output destination first.");
    return;
  }

  pausePreview();
  setBusy(true);

  try {
    let result;
    if (state.mode === "multi") {
      result = await api.renderMulti({
        pairs: state.pairs.map((p) => {
          let text = p.titleBadgeText && p.titleBadgeText.trim()
            ? p.titleBadgeText.trim()
            : (p.audio?.name ? p.audio.name.replace(/\\.[^/.]+$/, "") : (state.titleBadgeText.trim() || "Sound Forge Track"));
          return {
            audioPath: p.audio.path,
            visualPath: p.visual.path,
            badgeDataUrl: state.showTitleBadge ? getTitleBadgeDataUrl(text) : null,
          };
        }),
        outputPath: state.outputPath,
      });
    } else {
      result = await api.render({
        audioPath: state.audio.path,
        visualPath: state.visual.path,
        visualKind: state.visual.kind,
        outputPath: state.outputPath,
        badgeDataUrl: state.showTitleBadge ? getTitleBadgeDataUrl(getActiveBadgeText()) : null,
      });
    }

    if (result && typeof result === "object" && result.success === false) {
      throw new Error(result.error || "The encoder reported an unsuccessful render.");
    }

    const resultPath = renderResultPath(result);

    state.outputPath = resultPath;
    state.outputFileUrl = result?.fileUrl || filePathToUrl(resultPath);
    elements.completionPath.textContent = resultPath;
    elements.completionPath.title = resultPath;
    elements.completionCard.hidden = false;
    setSystemStatus("MASTER READY", "ready");
    elements.completionCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (error) {
    setSystemStatus("ENGINE FAULT", "standby");
    showError(error, "The master could not be created. Your source files were not changed.");
  } finally {
    setBusy(false);
  }
}

async function playOutputInApp() {
  clearError();
  pausePreview();

  if (!state.outputPath) {
    showError("No rendered output is available yet.");
    return;
  }

  try {
    elements.resultPlayer.src = state.outputFileUrl || filePathToUrl(state.outputPath);
    elements.resultPlayer.hidden = false;
    elements.resultPlayer.load();
    await elements.resultPlayer.play();
    elements.monitorFrame.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch (error) {
    stopResultPlayback();
    showError(error, "The rendered video could not be played in the app.");
  }
}

async function openOutput() {
  clearError();
  try {
    await api.open(state.outputPath);
  } catch (error) {
    showError(error, "The rendered video could not be opened.");
  }
}

async function revealOutput() {
  clearError();
  try {
    await api.reveal(state.outputPath);
  } catch (error) {
    showError(error, "The rendered video could not be revealed in Finder.");
  }
}

async function loadAppInfo() {
  if (!api || typeof api.getAppInfo !== "function") {
    setSystemStatus("BRIDGE OFFLINE", "standby");
    showError("The application bridge is unavailable. Restart Sound Forge.");
    updateActionAvailability();
    return;
  }

  try {
    const info = await api.getAppInfo();
    const version = typeof info === "string" ? info : info?.version;
    elements.appVersion.textContent = version ? `v${version}` : "v—";
    setSystemStatus("ENGINE STANDBY", "standby");
  } catch (error) {
    elements.appVersion.textContent = "v—";
    setSystemStatus("INFO UNAVAILABLE", "standby");
  }
}

elements.modeSingleBtn.addEventListener("click", () => switchMode("single"));
elements.modeMultiBtn.addEventListener("click", () => switchMode("multi"));
elements.addPairBtn.addEventListener("click", addPair);
elements.selectAudioButton.addEventListener("click", selectAudio);
elements.selectVisualButton.addEventListener("click", selectVisual);
elements.useArtworkCheckbox.addEventListener("change", toggleEmbeddedArtwork);
if (elements.showTitleBadgeCheckbox) {
  elements.showTitleBadgeCheckbox.addEventListener("change", (e) => {
    state.showTitleBadge = e.target.checked;
    if (elements.badgeInputWrap) {
      elements.badgeInputWrap.hidden = !state.showTitleBadge;
    }
    drawPreview();
    renderPairList();
    updateActionAvailability();
  });
}
if (elements.titleBadgeInput) {
  elements.titleBadgeInput.addEventListener("input", (e) => {
    state.titleBadgeText = e.target.value;
    drawPreview();
  });
}
elements.selectOutputButton.addEventListener("click", selectOutput);
elements.playPauseButton.addEventListener("click", togglePreview);
elements.renderButton.addEventListener("click", renderMaster);
elements.dismissErrorButton.addEventListener("click", clearError);
elements.playOutputButton.addEventListener("click", playOutputInApp);
elements.openOutputButton.addEventListener("click", openOutput);
elements.revealOutputButton.addEventListener("click", revealOutput);
elements.resetButton.addEventListener("click", resetSession);

elements.timeline.addEventListener("input", () => {
  if (state.mode === "multi") {
    seekMultiPairPreview(Number(elements.timeline.value)).catch((error) => {
      showError(error, "The selected media could not be seeked.");
    });
    return;
  }

  previewAudio.currentTime = Number(elements.timeline.value);
  syncVideoToAudio(true);
  refreshTimeline();
  drawPreview();
});

previewAudio.addEventListener("loadedmetadata", refreshTimeline);
previewAudio.addEventListener("durationchange", refreshTimeline);
previewAudio.addEventListener("timeupdate", () => {
  refreshTimeline();
  syncVideoToAudio();
  if (state.mode === "multi") {
    drawPreview();
  }
});
previewAudio.addEventListener("play", () => setTransportPlaying(true));
previewAudio.addEventListener("pause", () => setTransportPlaying(false));
previewAudio.addEventListener("ended", () => {
  if (
    state.mode === "multi" &&
    state.activePairIndex < state.pairs.length - 1
  ) {
    loadMultiPairPreview(state.activePairIndex + 1, 0)
      .then(() => playLoadedMultiPair())
      .catch((error) => {
        pausePreview();
        showError(error, "The selected media could not be played.");
      });
    return;
  }

  previewVideo.pause();
  setTransportPlaying(false);
  refreshTimeline();
  drawPreview();
});
previewAudio.addEventListener("error", () => {
  showError("The selected MP3 could not be decoded.");
});

previewVideo.addEventListener("loadeddata", drawPreview);
previewVideo.addEventListener("seeked", drawPreview);
previewVideo.addEventListener("error", () => {
  showError("The selected video could not be decoded.");
});

previewImage.addEventListener("load", drawPreview);
previewImage.addEventListener("error", () => {
  showError("The selected image could not be decoded.");
});

elements.resultPlayer.addEventListener("error", () => {
  if (!elements.resultPlayer.hidden) {
    showError("The rendered video could not be decoded for in-app playback.");
  }
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isInteractive =
    target instanceof HTMLButtonElement ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLVideoElement;

  if (event.code === "Space" && !isInteractive && !elements.playPauseButton.disabled) {
    event.preventDefault();
    togglePreview();
  }
});

window.addEventListener("beforeunload", () => {
  pausePreview();
  stopResultPlayback();
});

if ("ResizeObserver" in window) {
  new ResizeObserver(resizeCanvas).observe(elements.previewCanvas);
} else {
  window.addEventListener("resize", resizeCanvas);
}

resizeCanvas();
refreshTimeline();
updateActionAvailability();
loadAppInfo();
