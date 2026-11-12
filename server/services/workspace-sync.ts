import { createHash } from 'node:crypto';
import type { Actor } from '../../domain/models';
import type { WorkspaceRepository } from '../repositories/workspace-repository';
import { authorize, workspacePage } from './workspace-queries';

/** Revisions change in the same transaction as the row. Reading both under one
 * database snapshot prevents skipping late commits, edits or deletions. */
export async function syncWorkspace(repo:WorkspaceRepository,actor:Actor,etag:string|null) {
 return repo.transaction(async tx=>{
  await authorize(tx,actor);
  const revisions=await tx.db.prepare('SELECT name,generation FROM workspace_revisions ORDER BY name').all();
  const tag='"'+createHash('sha256').update(JSON.stringify([actor,revisions,'bounded-v1'])).digest('hex')+'"';
  if(etag===tag)return {etag:tag,snapshot:null};
  return {etag:tag,snapshot:{...await workspacePage(tx,actor),revision:tag}};
 });
}
