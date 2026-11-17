import { z } from 'zod';
import type { DatabaseRepository } from '../repositories/database-repository';
import { DomainError } from '../../domain/commands';

export async function pilotHost(repo: DatabaseRepository, email: string): Promise<{ email: string; name: string } | undefined> {
  return repo.db.prepare('SELECT email,name FROM pilot_hosts WHERE email=?').get(email.trim().toLowerCase());
}

/** Caller must authorize a team member before granting this role. Does not create a household. */
export async function addPilotHost(repo: DatabaseRepository, input: unknown) {
  const { email, name } = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
    name: z.string().trim().min(1).max(60),
  }).parse(input);
  return repo.transaction(async () => {
    if (await repo.db.prepare("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE lower(u.email)=? AND m.role='learner'").get(email)
      || await repo.db.prepare("SELECT 1 FROM placements WHERE email=? AND role='learner'").get(email)) {
      throw new DomainError(409, '这个邮箱已作为学员入组，请先协调现有分组。');
    }
    await repo.db.prepare('INSERT INTO pilot_hosts (email,name,created) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name').run(email, name, new Date().toISOString());
    await repo.db.prepare("UPDATE placements SET name=? WHERE email=? AND role='host'").run(name, email);
    await repo.db.prepare("UPDATE memberships SET display_name=? WHERE role='host' AND user_id IN (SELECT id FROM users WHERE lower(email)=?)").run(name, email);
    return { email, name };
  });
}
