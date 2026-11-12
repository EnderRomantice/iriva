import { z } from 'zod';
import { tables } from '@/server/repositories/tables';
import { workspaceRepository } from '@/server/container';
import { actorFromRequest,errorResponse } from '@/server/http';
import { authorize,collectionPage } from '@/server/services/workspace-queries';
import { hydratePage } from '@/server/services/workspace-relations';
const schema=z.object({table:z.enum(tables),kind:z.enum(["direct","non-direct"]).optional(),status:z.enum(["all","todo","done","new","contacted","enrolled"]).optional(),after:z.string().max(1000).optional(),query:z.string().trim().max(200).optional(),channelId:z.uuid().optional(),householdId:z.uuid().optional(),from:z.iso.datetime({offset:true}).optional(),to:z.iso.datetime({offset:true}).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),ids:z.string().max(3700).optional()}).refine(p=>!!p.from===!!p.to,'日期范围必须完整。');
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const actor=await actorFromRequest(request),repo=await workspaceRepository();
  const {table,ids,...options}=schema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return await repo.transaction(async tx=>{
   await authorize(tx,actor);
   const page=await collectionPage(tx,actor,table,{...options,ids:ids?z.array(z.uuid()).max(100).parse(ids.split(',')):undefined});
   const relations=await hydratePage(tx,actor,table,page.items);
   return Response.json({...page,...relations},{headers:{'Cache-Control':'private, no-store'}});
  });
 }catch(error){return errorResponse(error);}
}
