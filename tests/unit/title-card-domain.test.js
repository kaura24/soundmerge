'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_TITLE_CARD_DURATION,
  DEFAULT_TITLE_CARD_TEMPLATE,
  TITLE_CARD_DURATIONS,
  TITLE_CARD_TEMPLATES,
  normalizeTitleCardDuration,
  normalizeTitleCardTemplate,
} = require('../../src/shared/title-card-domain');

test('title card templates are limited to A, B, and E layouts', () => {
  assert.deepEqual(TITLE_CARD_TEMPLATES, ['editorial', 'split', 'warm']);
  assert.equal(DEFAULT_TITLE_CARD_TEMPLATE, 'editorial');
  assert.equal(normalizeTitleCardTemplate('split'), 'split');
  assert.equal(normalizeTitleCardTemplate('waveform'), 'editorial');
});

test('title card durations are limited to three or five seconds', () => {
  assert.deepEqual(TITLE_CARD_DURATIONS, [3, 5]);
  assert.equal(DEFAULT_TITLE_CARD_DURATION, 5);
  assert.equal(normalizeTitleCardDuration(3), 3);
  assert.equal(normalizeTitleCardDuration('5'), 5);
  assert.equal(normalizeTitleCardDuration(8), 5);
});
