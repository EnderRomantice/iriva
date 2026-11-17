import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteRepository } from '../server/repositories/sqlite-repository';
import { asyncSqliteRepository } from '../server/repositories/async-sqlite-repository';
import { addPilotHost, pilotHost } from '../server/services/pilot-hosts';
import { reviewFixture } from './helpers/review-fixture';

test('Host registration precedes account creation, normalizes email and updates without duplicates or households', async t => {
  const repo = asyncSqliteRepository(new SqliteRepository(':memory:'));
  t.after(() => repo.db.close());
  await addPilotHost(repo, { email: ' Emma@Example.com ', name: ' Emma ' });
  assert.deepEqual(await pilotHost(repo, 'EMMA@example.com'), { email: 'emma@example.com', name: 'Emma' });
  await addPilotHost(repo, { email: 'emma@example.com', name: 'Emma Wilson' });
  assert.equal((await repo.db.prepare('SELECT * FROM pilot_hosts').all()).length, 1);
  assert.equal((await repo.db.prepare('SELECT * FROM users').all()).length, 0);
  assert.equal((await repo.db.prepare('SELECT * FROM households').all()).length, 0);
  assert.equal(await pilotHost(repo, 'outsider@example.com'), undefined);
  await assert.rejects(addPilotHost(repo, { email: 'invalid', name: 'Emma' }));
});

test('existing learners cannot become Hosts; registered Host names propagate to their household', async t => {
  const repo = asyncSqliteRepository(new SqliteRepository(':memory:'));
  t.after(() => repo.db.close());
  const ids = await reviewFixture(repo);
  await assert.rejects(addPilotHost(repo, { email: `${ids.learner}@example.test`, name: 'Learner' }), /已作为学员入组/);
  await addPilotHost(repo, { email: `${ids.host}@example.test`, name: 'Updated Host' });
  assert.equal((await repo.db.prepare('SELECT display_name FROM memberships WHERE user_id=?').get(ids.host)).display_name, 'Updated Host');
});
