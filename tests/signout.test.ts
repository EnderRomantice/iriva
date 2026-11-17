import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'iriva-signout-'));
process.env.SQLITE_PATH = path.join(dir, 'signout.sqlite');

test('team sign-out revokes the active session, clears the cookie and returns to team sign-in', async t => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { workspaceRepository } = await import('../server/container');
  const { saveTeamAccount, passwordSignIn } = await import('../server/team-auth');
  const { digest } = await import('../server/auth');
  const { GET } = await import('../app/signout/route');
  const repo = await workspaceRepository();
  await saveTeamAccount(repo, { email: 'staff@example.com', name: 'Staff', password: 'test-password' });
  const login = await passwordSignIn({ email: 'staff@example.com', password: 'test-password' });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const hash = digest(cookie.slice('iriva_session='.length));
  assert.ok(await repo.db.prepare('SELECT 1 FROM auth_sessions WHERE token_hash=?').get(hash));

  const request = new Request('http://localhost:3001/signout?return_to=%2Fteam%2Fsignin', { headers: { cookie } });
  const response = await GET(request);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/team/signin');
  assert.match(response.headers.get('set-cookie')!, /iriva_session=;/);
  assert.match(response.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await repo.db.prepare('SELECT 1 FROM auth_sessions WHERE token_hash=?').get(hash), undefined);
  assert.equal((await GET(request)).status, 303, 'an expired session can still sign out');
});
