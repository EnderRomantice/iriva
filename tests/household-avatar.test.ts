import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxAvatarBytes, parseAvatar } from '../domain/household-avatar';
import { avatarInitial } from '../domain/initial';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').toString('base64');
test('space avatar accepts small PNG/JPEG/WebP data URLs whose bytes match the declared type', () => {
  assert.equal(parseAvatar(`data:image/png;base64,${png}`)?.type, 'image/png');
  assert.equal(parseAvatar(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`)?.type, 'image/jpeg');
  assert.equal(parseAvatar(`data:image/webp;base64,${Buffer.from('RIFF\0\0\0\0WEBPVP8 ').toString('base64')}`)?.type, 'image/webp');
});
test('space avatar rejects other types, spoofed signatures and oversized images', () => {
  assert.equal(parseAvatar(`data:image/jpeg;base64,${png}`), null, 'PNG bytes labelled JPEG');
  assert.equal(parseAvatar(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`), null);
  assert.equal(parseAvatar('https://example.test/a.png'), null);
  assert.equal(parseAvatar(`data:image/png;base64,${Buffer.concat([Buffer.from('89504e47', 'hex'), Buffer.alloc(maxAvatarBytes)]).toString('base64')}`), null);
  assert.equal(parseAvatar(null), null);
});
test('default avatar is the first visible character of the space name', () => {
  assert.equal(avatarInitial('晨光 Household'), '晨');
  assert.equal(avatarInitial('  daniel Chen的空间'), 'D');
  assert.equal(avatarInitial('👩‍👩‍👧 Family'), '👩‍👩‍👧');
  assert.equal(avatarInitial(''), '·');
});
