export type Role = "learn" | "host" | "ops";
export interface Entity { id: string; version: number; createdAt: string; updatedAt: string }
export interface User extends Entity { name: string; email: string; timezone: string; avatar: string }
export interface Term extends Entity { name: string; startsOn: string; endsOn: string }
export interface Household extends Entity { name: string; termId: string; hostId: string; timezone: string; capacity: number; theme: string }
export interface Membership extends Entity { householdId: string; userId: string; role: "learner" | "host" }
export interface Session extends Entity { householdId: string; title: string; description: string; startsAt: string; endsAt: string; status: "scheduled" | "completed" | "cancelled"; meetingUrl: string }
export interface Assignment extends Entity { householdId: string; title: string; description: string; category: "prepare" | "practice" | "reflect"; dueAt: string; week: number }
export interface Submission extends Entity { assignmentId: string; learnerId: string; body: string; status: "draft" | "submitted"; completed: boolean }
export interface Feedback extends Entity { submissionId: string; authorId: string; body: string; status: "draft" | "published" }
export interface Application extends Entity { userId: string; goal: string; availability: string; status: "new" | "contacted" | "enrolled" }
export interface Enrollment extends Entity { userId: string; termId: string; householdId: string; plan: string; amountMinor: number; currency: string; paymentStatus: "pending" | "paid" }
export interface State { users: User[]; terms: Term[]; households: Household[]; memberships: Membership[]; sessions: Session[]; assignments: Assignment[]; submissions: Submission[]; feedback: Feedback[]; applications: Application[]; enrollments: Enrollment[] }
export interface Actor { userId: string; role: Role }
export interface Snapshot extends State { actor: Actor; serverTime: string }
export const demoActors: Record<Role, Actor> = {
  learn: { userId: "10000000-0000-4000-8000-000000000001", role: "learn" },
  host: { userId: "10000000-0000-4000-8000-000000000005", role: "host" },
  ops: { userId: "10000000-0000-4000-8000-000000000006", role: "ops" },
};
