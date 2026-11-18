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

test('Host identity does not depend on registration or a Household; learners remain learners', async t => {
  const { randomUUID } = await import('node:crypto');
  const { defaultOrganizationId } = await import('../domain/workspace');
  const repo = asyncSqliteRepository(new SqliteRepository(':memory:'));
  t.after(() => repo.db.close());
  const ids = await reviewFixture(repo);
  const email = `${ids.outsider}@example.test`;
  const now = new Date().toISOString();

  // An existing Household Host is recognized without a pilot_hosts entry.
  assert.equal((await pilotHost(repo, `${ids.host}@example.test`))?.name, 'Review host');
  assert.equal(await pilotHost(repo, `${ids.learner}@example.test`), undefined);
  assert.equal(await pilotHost(repo, email), undefined);

  // A platform Host with no assigned Household must skip learner onboarding.
  await repo.saveOrganizationMembership({ id: randomUUID(), organizationId: defaultOrganizationId,
    userId: ids.outsider, role: 'host', version: 1, createdAt: now, updatedAt: now });
  assert.equal((await pilotHost(repo, ` ${email.toUpperCase()} `))?.name, 'Review outsider');
  assert.equal(await repo.db.prepare('SELECT 1 FROM memberships WHERE user_id=?').get(ids.outsider), undefined);
  await repo.db.prepare('DELETE FROM organization_memberships WHERE user_id=?').run(ids.outsider);
  assert.equal(await pilotHost(repo, email), undefined, 'revoked role must not leave a cached Host identity');

  // Pending grants also identify Hosts before their next sign-in activates them.
  await repo.db.prepare('INSERT INTO host_grants (id,platform_id,email,user_id,created_by,created_at) VALUES (?,?,?,?,?,?)')
    .run(randomUUID(), defaultOrganizationId, email, null, ids.team, now);
  assert.equal((await pilotHost(repo, email))?.name, 'Review outsider');
  await repo.db.prepare('DELETE FROM host_grants WHERE email=?').run(email);

  // A Host role in an unrelated platform must not grant a local Host identity.
  const other = randomUUID();
  await repo.put('organizations', { id: other, name: 'Other platform', initials: 'O', color: '#123456', kind: 'platform', version: 1, createdAt: now, updatedAt: now });
  await repo.saveOrganizationMembership({ id: randomUUID(), organizationId: other,
    userId: ids.outsider, role: 'host', version: 1, createdAt: now, updatedAt: now });
  assert.equal(await pilotHost(repo, email), undefined);
});
