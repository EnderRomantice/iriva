import { z } from "zod";

const base = { id: z.uuid(), entityId: z.uuid(), baseVersion: z.number().int().nonnegative() };
export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("assignment.create"), payload: z.object({ householdId: z.uuid(), title: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(4000), category: z.enum(["prepare", "practice", "reflect"]), dueAt: z.iso.datetime(), week: z.number().int().min(1).max(6) }).strict() }),
  z.object({ ...base, kind: z.literal("session.create"), payload: z.object({ householdId: z.uuid(), title: z.string().trim().min(1).max(120), description: z.string().trim().max(4000), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).strict() }),
  z.object({ ...base, kind: z.literal("household.create"), payload: z.object({ name: z.string().trim().min(1).max(80), theme: z.string().trim().min(1).max(1000), termId: z.uuid(), hostId: z.uuid(), capacity: z.number().int().min(1).max(12) }).strict() }),
  z.object({ ...base, kind: z.literal("submission.save"), payload: z.object({ assignmentId: z.uuid(), body: z.string().max(12000), completed: z.boolean(), status: z.enum(["draft", "submitted"]) }).strict() }),
  z.object({ ...base, kind: z.literal("feedback.save"), payload: z.object({ submissionId: z.uuid(), body: z.string().max(12000), status: z.enum(["draft", "published"]) }).strict() }),
  z.object({ ...base, kind: z.literal("application.contact"), payload: z.object({}).strict() }),
  z.object({ ...base, kind: z.literal("application.enroll"), payload: z.object({ householdId: z.uuid() }).strict() }),
  z.object({ ...base, kind: z.literal("session.reschedule"), payload: z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).strict() }),
]);
export type Command = z.infer<typeof commandSchema>;
export const applicationSchema = z.object({ name: z.string().trim().min(1).max(80), email: z.email().max(200), goal: z.string().trim().min(4).max(2000), availability: z.string().trim().min(2).max(1000) }).strict();
export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
