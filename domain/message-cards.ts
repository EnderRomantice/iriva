import { z } from 'zod';

// References are the wire/storage format. Display data is resolved for each viewer.
export const messageCardSchema = z.discriminatedUnion('type', [
  z.object({ version:z.literal(1), type:z.enum(['user','task','group','host']), entityId:z.uuid() }).strict(),
  z.object({ version:z.literal(1), type:z.literal('plan'), entityId:z.enum(['free','lite','pro','max']) }).strict(),
]);
export const messageCardsSchema = z.array(messageCardSchema).max(5).refine(cards => new Set(cards.map(cardKey)).size === cards.length, '不能重复添加同一张卡片');
export type MessageCard = z.infer<typeof messageCardSchema>;
export type CardType = MessageCard['type'];
export interface CardPreview { reference:MessageCard; title:string; description:string; metadata:string[] }
export const cardLabels:Record<CardType,string> = { user:'用户', task:'Task', group:'小组', host:'Host', plan:'Plan' };
export function cardKey(card:MessageCard) { return `${card.type}:${card.entityId}`; }
export function findCard(catalog:CardPreview[] | undefined, card:MessageCard) { return catalog?.find(item => cardKey(item.reference) === cardKey(card)); }
