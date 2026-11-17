import { workspaceRepository } from '../server/container';
import { saveTeamAccount } from '../server/team-auth';

/**
 * Create or update a team account that signs in at /team/signin.
 * The password comes from TEAM_PASSWORD so it never lands in shell history or the repo.
 *   TEAM_PASSWORD=… npm run team:account -- --email you@example.com --name 姓名 [--role admin|staff]
 * Uses DATABASE_URL when set (production: node --env-file=.env.supabase.local), otherwise local SQLite.
 */
async function main() {
  const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const email = arg('email'), name = arg('name') || email?.split('@')[0], role = arg('role') || 'staff';
  if (!email || !name) throw new Error('Usage: --email <email> --name <name> [--role admin|staff], password in TEAM_PASSWORD.');
  if (role !== 'admin' && role !== 'staff') throw new Error('--role must be admin or staff.');
  const saved = await saveTeamAccount(await workspaceRepository(), { email, name, role, password: process.env.TEAM_PASSWORD });
  console.log(`Team account saved: ${saved.email} (${role})${process.env.TEAM_PASSWORD ? ', password set' : ''}.`);
}
main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
