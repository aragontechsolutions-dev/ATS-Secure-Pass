import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avatarColor, luminance, resolveBrand } from '../src/ui/brandResolve';

test('resolveBrand encuentra marcas por título exacto', () => {
  assert.equal(resolveBrand('GitHub')?.title, 'GitHub');
  assert.equal(resolveBrand('Netflix')?.title, 'Netflix');
  assert.equal(resolveBrand('Spotify Premium')?.title, 'Spotify');
});

test('resolveBrand usa la URL como pista', () => {
  assert.equal(resolveBrand('Mi cuenta', 'https://github.com/user')?.title, 'GitHub');
});

test('resolveBrand aplica alias', () => {
  assert.equal(resolveBrand('IG')?.title, 'Instagram');
  assert.equal(resolveBrand('yt')?.title, 'YouTube');
});

test('resolveBrand no hace match por subcadena (evita falsos positivos)', () => {
  // "x" es una marca (Twitter/X) pero no debe activarse dentro de otra palabra.
  assert.equal(resolveBrand('Linux server'), null);
  assert.equal(resolveBrand('Trabajo interno'), null);
});

test('resolveBrand devuelve null para desconocidos', () => {
  assert.equal(resolveBrand('Servidor NAS casa'), null);
});

test('luminance: negro ~0, blanco ~1', () => {
  assert.ok(luminance('000000') < 0.01);
  assert.ok(luminance('ffffff') > 0.99);
  assert.ok(luminance('fffc00') > 0.62); // amarillo Snapchat → texto oscuro
});

test('avatarColor es estable y válido', () => {
  const a = avatarColor('Servidor');
  assert.equal(a, avatarColor('Servidor'));
  assert.match(a, /^#[0-9A-F]{6}$/i);
});
