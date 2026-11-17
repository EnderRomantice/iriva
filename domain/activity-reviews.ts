import { z } from 'zod';
export const supportOptions = ['Host 的提问', '其他学员的回应', '准备卡里的表达', '我自己想出来的', '还没有找到方法'] as const;
export const goalOptions = ['主动追问一次', '分享一个自己的经历', '说出不同意见', '没听懂时请对方重复'] as const;
const short = z.string().trim().min(1).max(1000);
const identity = { session: z.string().min(1).max(100), learner: z.string().min(1).max(100) };
export const reviewCommand = z.discriminatedUnion('action', [
 z.object({ ...identity, action: z.literal('reflect'), moment: short, support: z.enum(supportOptions), comfort: z.number().int().min(1).max(5), goal: short, expression: z.string().trim().max(1000), consent: z.literal(true) }).strict(),
 z.object({ ...identity, action: z.literal('observe'), attendance: z.enum(['present','absent','unknown']), moment: z.string().trim().max(1000), invitation: z.string().trim().max(1000), status: z.enum(['draft','submitted']), version: z.number().int().nonnegative() }).strict(),
 z.object({ ...identity, action: z.literal('card'), noticed: z.string().trim().max(1000), expression: z.string().trim().max(1000), next_step: z.string().trim().max(1000), status: z.enum(['draft','published']), version: z.number().int().nonnegative() }).strict(),
 z.object({ ...identity, action: z.literal('respond'), usefulness: z.enum(['yes','partly','no']), return_intent: z.enum(['yes','unsure','no']) }).strict(),
]);
export type ReviewCommand = z.infer<typeof reviewCommand>;
export type Reflection = {moment:string;support:string;comfort:number;goal:string;expression:string;submitted_at:string};
export type Observation = {attendance:'present'|'absent'|'unknown';moment:string;invitation:string;status:'draft'|'submitted';version:number};
export type ReviewCard = {noticed:string;expression:string;next_step:string;status:'draft'|'published';version:number;published_at:string|null;usefulness:'yes'|'partly'|'no'|null;return_intent:'yes'|'unsure'|'no'|null};
export type ReviewRecord = {session_id:string;learner_id:string;title:string;at:string;household:string;household_name:string;learner_name:string;reflection:Reflection|null;observation:Observation|null;card:ReviewCard|null};
export type ReviewPayload = {role:'team'|'host'|'learner';records:ReviewRecord[];page:number;total:number;stats:{eligible:number;reflections:number;published:number;present:number;helpful:number;responses:number};latestGoal:{goal:string;next_step:string|null;title:string}|null};
