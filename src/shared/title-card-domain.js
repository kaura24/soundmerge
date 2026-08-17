'use strict';

const TITLE_CARD_TEMPLATES = ['editorial', 'split', 'warm'];
const TITLE_CARD_DURATIONS = [3, 5];
const DEFAULT_TITLE_CARD_TEMPLATE = 'editorial';
const DEFAULT_TITLE_CARD_DURATION = 5;

function normalizeTitleCardTemplate(value) {
  return TITLE_CARD_TEMPLATES.includes(value)
    ? value
    : DEFAULT_TITLE_CARD_TEMPLATE;
}

function normalizeTitleCardDuration(value) {
  const numeric = Number(value);
  return TITLE_CARD_DURATIONS.includes(numeric)
    ? numeric
    : DEFAULT_TITLE_CARD_DURATION;
}

const titleCardDomain = {
  DEFAULT_TITLE_CARD_DURATION,
  DEFAULT_TITLE_CARD_TEMPLATE,
  TITLE_CARD_DURATIONS,
  TITLE_CARD_TEMPLATES,
  normalizeTitleCardDuration,
  normalizeTitleCardTemplate,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = titleCardDomain;
}

if (typeof globalThis !== 'undefined') {
  globalThis.SoundForgeTitleCardDomain = titleCardDomain;
}
