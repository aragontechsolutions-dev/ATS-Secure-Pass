import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isInactivityExpired } from '../src/security/autoLockCore';
import { shouldClearClipboard } from '../src/security/clipboardCore';

test('isInactivityExpired: expira al alcanzar o superar el timeout', () => {
  assert.equal(isInactivityExpired(1000, 1000 + 5000, 5000), true); // exacto
  assert.equal(isInactivityExpired(1000, 1000 + 5001, 5000), true); // pasado
  assert.equal(isInactivityExpired(1000, 1000 + 4999, 5000), false); // aún no
});

test('isInactivityExpired: timeout 0 expira siempre (bloquear al ir a background)', () => {
  assert.equal(isInactivityExpired(1000, 1000, 0), true);
  assert.equal(isInactivityExpired(1000, 2000, 0), true);
});

test('shouldClearClipboard: solo limpia si el contenido no cambió', () => {
  assert.equal(shouldClearClipboard('secreto', 'secreto'), true);
  assert.equal(shouldClearClipboard('otra cosa', 'secreto'), false);
  assert.equal(shouldClearClipboard('', 'secreto'), false);
});
