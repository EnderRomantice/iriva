import type { Actor, State } from '../../domain/models';
import type { CardPreview, CardType, MessageCard } from '../../domain/message-cards';
import { plans } from '../../domain/account';

// state is already restricted to the actor's organization. Only public profile
// and explicitly shared group summaries go into the catalog; task details require access.
export function cardCatalog(state:State, actor:Actor):CardPreview[] {
  const result:CardPreview[] = [];
  const add = (type:CardType, entityId:string, title:string, description:string, metadata:(string|undefined)[]) => result.push({ reference:{version:1,type,entityId} as MessageCard, title, description, metadata:metadata.filter((v):v is string => !!v) });
  const hostIds = new Set(state.organizationMemberships.filter(m => m.role === 'host').map(m => m.userId));
  const memberIds = new Set(state.organizationMemberships.map(m => m.userId));
  for (const user of state.users.filter(u => memberIds.has(u.id))) {
    add('user',user.id,user.name,user.signature || '',[user.occupation,user.city,user.timezone]);
    if (hostIds.has(user.id)) add('host',user.id,user.name,user.signature || '一起在真实的对话里练习英语。',[user.occupation,user.city,user.timezone,...(user.hostQualifications || []),user.hostFeatured ? '明星 Host · Pro / Max' : user.hostFullTime ? '全职 Host' : 'Host']);
  }
  const accessible = new Set(state.households.filter(h => actor.role === 'ops' || (actor.role === 'host' ? h.hostId === actor.userId : state.memberships.some(m => m.householdId === h.id && m.userId === actor.userId && m.role === 'learner'))).map(h => h.id));
  const sharedGroups = new Set(state.messages.flatMap(m => (m.cards || []).filter(c => c.type === 'group').map(c => c.entityId)));
  for (const group of state.households.filter(h => accessible.has(h.id) || sharedGroups.has(h.id))) add('group',group.id,group.name,group.theme,[state.users.find(u => u.id === group.hostId)?.name,group.timezone,`${group.capacity} 人小组`]);
  for (const task of state.assignments.filter(a => accessible.has(a.householdId))) add('task',task.id,task.title,task.description,[state.households.find(h => h.id === task.householdId)?.name,`第 ${task.week} 周`,`截止 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(task.dueAt))}`]);
  for (const plan of plans) add('plan',plan.id,plan.name,plan.description,[plan.label,plan.id === 'free' ? '免费' : `¥${(plan.prices[0]/100).toLocaleString('zh-CN')} 起 / 学期`,...plan.benefits]);
  return result;
}
