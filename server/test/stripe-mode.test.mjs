import test from 'node:test';
import assert from 'node:assert/strict';
import { stripeLiveMode } from '../stripe-mode.mjs';
import { Payments } from '../payments.mjs';

test('modern keys identify their environment and reject contradictory configuration', () => {
  for (const prefix of ['sk', 'rk']) {
    assert.equal(stripeLiveMode(prefix + '_live_fixture'), true);
    assert.equal(stripeLiveMode(prefix + '_test_fixture'), false);
    assert.throws(() => stripeLiveMode(prefix + '_live_fixture', 'test'), /disagree/);
    assert.throws(() => stripeLiveMode(prefix + '_test_fixture', 'live'), /disagree/);
  }
});
test('legacy keys fail closed and cannot bypass the live purchase gate', () => {
  assert.throws(() => stripeLiveMode('legacy-fixture'), /explicit/);
  assert.throws(() => stripeLiveMode('legacy-fixture', 'production'), /Invalid/);
  const live = stripeLiveMode('legacy-fixture', 'live');
  assert.equal(live, true);
  assert.equal(stripeLiveMode('legacy-fixture', 'test'), false);
  assert.equal(new Payments({stripe: {}, webhookSecret: 'fixture', enabled: true, live}).enabled, false);
  assert.equal(stripeLiveMode(''), false);
});
