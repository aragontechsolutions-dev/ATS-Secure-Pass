import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampPage,
  filterCredentials,
  pageCount,
  paginate,
} from '../src/ui/credentialQuery';

const creds = [
  { title: 'GitHub', username: 'me@dev.com', url: 'github.com' },
  { title: 'Gmail', username: 'yo@gmail.com', url: null },
  { title: 'Banco', username: null, url: 'bank.es' },
];

test('filterCredentials busca en título, usuario y url', () => {
  assert.equal(filterCredentials(creds, 'git').length, 1);
  assert.equal(filterCredentials(creds, 'gmail.com')[0].title, 'Gmail');
  assert.equal(filterCredentials(creds, 'bank.es')[0].title, 'Banco');
  assert.equal(filterCredentials(creds, '').length, 3); // vacío = todo
  assert.equal(filterCredentials(creds, 'nada').length, 0);
});

test('filterCredentials es case-insensitive y trim', () => {
  assert.equal(filterCredentials(creds, '  GITHUB ')[0].title, 'GitHub');
});

test('pageCount', () => {
  assert.equal(pageCount(0, 10), 1);
  assert.equal(pageCount(10, 10), 1);
  assert.equal(pageCount(11, 10), 2);
  assert.equal(pageCount(25, 10), 3);
});

test('clampPage mantiene el rango', () => {
  assert.equal(clampPage(0, 25, 10), 1);
  assert.equal(clampPage(5, 25, 10), 3); // 3 páginas máximo
  assert.equal(clampPage(2, 25, 10), 2);
});

test('paginate devuelve la porción correcta', () => {
  const list = Array.from({ length: 25 }, (_, i) => i);
  assert.deepEqual(paginate(list, 1, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(paginate(list, 3, 10), [20, 21, 22, 23, 24]);
  assert.deepEqual(paginate(list, 99, 10), [20, 21, 22, 23, 24]); // clamp a última
});
