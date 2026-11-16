import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { groupReactions, isReactionEmoji, toggleReaction } from '../domain/household-reactions';

test('reaction emoji accepts any single emoji grapheme and nothing else', () => {
  for (const ok of ['👍', '❤\uFE0F', '👍🏽', '👩‍👩‍👧', '🇨🇳', '#️⃣', '🫶', '🏳️‍🌈']) assert.equal(isReactionEmoji(ok), true, ok);
  for (const bad of ['', 'a', '好', '👍👍', ':tada:', '<b>', '1', ' 👍', 42, null, '👍'.repeat(20)]) assert.equal(isReactionEmoji(bad), false, String(bad));
});

test('reactions group per message in first-use order without duplicate users', () => {
  const grouped = groupReactions([
    { message: 'm1', emoji: '🎉', user: 'a' }, { message: 'm1', emoji: '👍', user: 'b' },
    { message: 'm1', emoji: '🎉', user: 'b' }, { message: 'm1', emoji: '🎉', user: 'b' }, { message: 'm2', emoji: '👀', user: 'a' },
  ]);
  assert.deepEqual(grouped.get('m1'), [{ emoji: '🎉', users: ['a', 'b'] }, { emoji: '👍', users: ['b'] }]);
  assert.deepEqual(grouped.get('m2'), [{ emoji: '👀', users: ['a'] }]);
});

test('optimistic toggles add, join, leave and drop empty reactions', () => {
  const start = [{ emoji: '🎉', users: ['a'] }];
  assert.deepEqual(toggleReaction(start, '🎉', 'b', true), [{ emoji: '🎉', users: ['a', 'b'] }]);
  assert.deepEqual(toggleReaction(start, '🎉', 'a', true), start);
  assert.deepEqual(toggleReaction(start, '👍', 'b', true), [{ emoji: '🎉', users: ['a'] }, { emoji: '👍', users: ['b'] }]);
  assert.deepEqual(toggleReaction(start, '🎉', 'a', false), []);
  assert.deepEqual(start, [{ emoji: '🎉', users: ['a'] }], 'input is not mutated');
});

test('SQLite migration creates the reactions table with one row per member and emoji', () => {
  const repo = new SqliteRepository(':memory:');
  const columns = (repo.db.prepare('PRAGMA table_info(household_message_reactions)').all() as { name: string; pk: number }[]);
  assert.deepEqual(columns.map(c => c.name), ['message_id', 'household_id', 'user_id', 'emoji', 'created_at']);
  assert.deepEqual(columns.filter(c => c.pk).map(c => c.name), ['message_id', 'user_id', 'emoji']);
});

test('emoji spellings with and without VS16 collapse to one canonical form', async () => {
  const { canonicalEmoji } = await import('../domain/household-reactions');
  assert.equal(canonicalEmoji('👍\uFE0F'), '👍');
  assert.equal(canonicalEmoji('👍'), '👍');
  assert.equal(canonicalEmoji('❤'), '❤\uFE0F');
  assert.equal(canonicalEmoji('❤\uFE0F'), '❤\uFE0F');
  assert.equal(canonicalEmoji('👍🏽'), '👍🏽');
  assert.equal(canonicalEmoji('🏳️‍🌈'), '🏳️‍🌈');
});
