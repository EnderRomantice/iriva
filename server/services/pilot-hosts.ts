import { z } from 'zod';
import type { DatabaseRepository } from '../repositories/database-repository';
import { DomainError } from '../../domain/commands';
import { defaultOrganizationId } from '../../domain/workspace';

/** Recognize granted Host identity even before a Household has been assigned. */
export async function pilotHost(repo: DatabaseRepository, email: string): Promise<{ email: string; name: string } | undefined> {
  const normalized = email.trim().toLowerCase();
  const registered = await repo.db.prepare('SELECT email,name FROM pilot_hosts WHERE email=?').get(normalized);
  if (registered) return registered;
  return repo.db.prepare(`SELECT u.email,u.name FROM users u WHERE lower(u.email)=? AND (
    EXISTS (SELECT 1 FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id
      WHERE m.user_id=u.id AND m.role='host' AND (o.id=? OR o.parent_id=?))
    OR EXISTS (SELECT 1 FROM memberships m JOIN households h ON h.id=m.household_id JOIN organizations o ON o.id=h.organization_id
      WHERE m.user_id=u.id AND m.role='host' AND (o.id=? OR o.parent_id=?))
    OR EXISTS (SELECT 1 FROM host_grants g WHERE g.email=? AND g.platform_id=?)
    OR EXISTS (SELECT 1 FROM placements p WHERE p.email=? AND p.role='host')
  )`).get(normalized, defaultOrganizationId, defaultOrganizationId, defaultOrganizationId, defaultOrganizationId, normalized, defaultOrganizationId, normalized);
}

/** Caller must authorize a team member before granting this role. Does not create a household. */
export async function addPilotHost(repo: DatabaseRepository, input: unknown, organizationId=defaultOrganizationId) {
  const { email, name } = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(200)),
    name: z.string().trim().min(1).max(60),
  }).parse(input);
  return repo.transaction(async () => {
    if (await repo.db.prepare("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE lower(u.email)=? AND m.role='learner'").get(email)
      || await repo.db.prepare("SELECT 1 FROM placements WHERE email=? AND role='learner'").get(email)) {
      throw new DomainError(409, '这个邮箱已作为学员入组，请先协调现有分组。');
    }
    const own=await repo.db.prepare('SELECT 1 FROM organization_hosts WHERE organization_id=? AND email=?').get(organizationId,email);
    const elsewhere=await repo.db.prepare('SELECT 1 FROM organization_hosts WHERE organization_id<>? AND email=?').get(organizationId,email);
    await repo.db.prepare('INSERT INTO organization_hosts VALUES (?,?,?,?) ON CONFLICT(organization_id,email) DO UPDATE SET name=excluded.name').run(organizationId,email,name,new Date().toISOString());
    await repo.db.prepare(own||!elsewhere?'INSERT INTO pilot_hosts (email,name,created) VALUES (?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name':'INSERT INTO pilot_hosts (email,name,created) VALUES (?,?,?) ON CONFLICT(email) DO NOTHING').run(email, name, new Date().toISOString());
    await repo.db.prepare("UPDATE placements SET name=? WHERE email=? AND role='host' AND household IN (SELECT id FROM households WHERE organization_id=? OR organization_id IN (SELECT id FROM organizations WHERE parent_id=?))").run(name,email,organizationId,organizationId);
    await repo.db.prepare("UPDATE memberships SET display_name=? WHERE role='host' AND user_id IN (SELECT id FROM users WHERE lower(email)=?) AND household_id IN (SELECT id FROM households WHERE organization_id=? OR organization_id IN (SELECT id FROM organizations WHERE parent_id=?))").run(name,email,organizationId,organizationId);
    return { email, name };
  });
}
