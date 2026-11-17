import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'iriva-team-auth-'));
process.env.SQLITE_PATH = path.join(dir, 'team.sqlite');
// Imported after SQLITE_PATH is set so the container opens the temporary database.
const load = async () => ({ ...await import('../server/container'), ...await import('../server/team-auth'), ...await import('../server/pilot'), ...await import('../server/auth') });
const signIn = async (email: string, password: string) => (await load()).passwordSignIn({ email, password });
const token = (r: Response) => /iriva_session=([0-9a-f]+)/.exec(r.headers.get('set-cookie') || '')?.[1];

test('team accounts sign in with a password; others and wrong passwords cannot', async t => {
  const { workspaceRepository, saveTeamAccount, teamRole, digest } = await load();
  const repo = await workspaceRepository();
  await assert.rejects(saveTeamAccount(repo, { email: 'new@example.com', name: 'New' }), /初始密码/);
  await assert.rejects(saveTeamAccount(repo, { email: 'new@example.com', name: 'New', password: 'short' }), /至少 8 位/);
  await saveTeamAccount(repo, { email: ' Admin@Example.com ', name: 'Admin', password: 'correct-horse', role: 'admin' });

  const ok = await signIn('ADMIN@example.com', 'correct-horse');
  const session = token(ok);
  assert.ok(session);
  const user = await repo.db.prepare('SELECT u.id,u.email,u.name FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?').get(digest(session!)) as { id: string; email: string };
  assert.equal(user.email, 'admin@example.com');
  assert.equal(await teamRole({ userId: user.id, email: user.email, displayName: 'Admin' }), 'admin');

  await assert.rejects(signIn('admin@example.com', 'wrong-password'), /邮箱或密码不正确/);
  await assert.rejects(signIn('nobody@example.com', 'correct-horse'), /邮箱或密码不正确/);

  // Losing team access disables password sign-in even though the credential remains.
  await saveTeamAccount(repo, { email: 'staff@example.com', name: 'Staff', password: 'staff-password' });
  assert.equal(await teamRole({ userId: 'x', email: 'staff@example.com', displayName: 'Staff' }), 'staff');
  await repo.db.prepare('DELETE FROM team_members WHERE email=?').run('staff@example.com');
  await assert.rejects(signIn('staff@example.com', 'staff-password'), /邮箱或密码不正确/);

  // Resetting a password signs out existing sessions.
  await saveTeamAccount(repo, { email: 'admin@example.com', name: 'Admin', password: 'another-pass' });
  assert.equal(await repo.db.prepare('SELECT 1 FROM auth_sessions WHERE token_hash=?').get(digest(session!)), undefined);
  assert.equal(await teamRole({ userId: user.id, email: user.email, displayName: 'Admin' }), 'admin', 'updating without a role keeps admin');
});

test('five failed attempts lock the email for 15 minutes, even with the right password', async t => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { workspaceRepository, saveTeamAccount } = await load();
  const repo = await workspaceRepository();
  await saveTeamAccount(repo, { email: 'lock@example.com', name: 'Lock', password: 'lock-password', role: 'staff' });
  for (let i = 0; i < 5; i++) await assert.rejects(signIn('lock@example.com', 'nope-nope'), /邮箱或密码不正确/);
  await assert.rejects(signIn('lock@example.com', 'lock-password'), /15 分钟/);
});
