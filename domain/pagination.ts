import type { Snapshot,State } from './models';
export function mergeData(base:Snapshot,extra:Partial<State>,catalog:Snapshot['cardCatalog']=[]) {
 const result={...base};
 for(const key of ['organizations','organizationMemberships','users','terms','households','memberships','sessions','assignments','submissions','feedback','applications','enrollments','channels','channelParticipants','messages'] as (keyof State)[]){if(!Array.isArray(extra[key]))continue;const map=new Map(base[key].map(r=>[r.id,r]));for(const row of extra[key]||[])map.set(row.id,row);(result[key] as unknown[])=Array.from(map.values());}
 result.cardCatalog=Array.from(new Map([...(base.cardCatalog||[]),...(catalog||[])].map(c=>[`${c.reference.type}:${c.reference.entityId}`,c])).values());
 return result;
}
