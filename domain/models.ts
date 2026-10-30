export type Role = "learn" | "host" | "ops";
export interface Entity { id: string; version: number; createdAt: string; updatedAt: string }
// city stores the local official name (上海, New York, London), independent of UI language.
export interface Organization extends Entity { name: string; initials: string; color: string }
export interface OrganizationMembership extends Entity { organizationId: string; userId: string; role: Role }
export interface User extends Entity { name: string; email: string; city?: string; timezone: string; avatar: string }
export interface Term extends Entity { name: string; startsOn: string; endsOn: string }
export interface Household extends Entity { organizationId?: string; name: string; termId: string; hostId: string; timezone: string; capacity: number; theme: string }
export interface Membership extends Entity { householdId: string; userId: string; role: "learner" | "host" }
export interface Session extends Entity { householdId: string; title: string; description: string; startsAt: string; endsAt: string; status: "scheduled" | "completed" | "cancelled"; meetingUrl: string }
export interface Assignment extends Entity { householdId: string; title: string; description: string; category: "prepare" | "practice" | "reflect"; dueAt: string; week: number }
export interface Submission extends Entity { assignmentId: string; learnerId: string; body: string; status: "draft" | "submitted"; completed: boolean }
export interface Feedback extends Entity { submissionId: string; authorId: string; body: string; status: "draft" | "published" }
export interface Application extends Entity { organizationId?: string; userId: string; goal: string; availability: string; status: "new" | "contacted" | "enrolled" }
export interface Enrollment extends Entity { userId: string; termId: string; householdId: string; plan: string; amountMinor: number; currency: string; paymentStatus: "pending" | "paid" }
export interface Channel extends Entity { organizationId: string; ownerId: string; name: string; description: string; kind: "public" | "private" | "direct"; directKey: string }
export interface ChannelParticipant extends Entity { channelId: string; userId: string }
export interface Message extends Entity { channelId: string; authorId: string; body: string }
export interface State { channels: Channel[]; channelParticipants: ChannelParticipant[]; messages: Message[]; organizations: Organization[]; organizationMemberships: OrganizationMembership[]; users: User[]; terms: Term[]; households: Household[]; memberships: Membership[]; sessions: Session[]; assignments: Assignment[]; submissions: Submission[]; feedback: Feedback[]; applications: Application[]; enrollments: Enrollment[] }
export interface Actor { organizationId?: string; userId: string; role: Role }
export interface Snapshot extends State { actor: Actor; serverTime: string }
export const demoActors: Record<Role, Actor> = {
  learn: { userId: "10000000-0000-4000-8000-000000000001", role: "learn" },
  host: { userId: "10000000-0000-4000-8000-000000000005", role: "host" },
  ops: { userId: "10000000-0000-4000-8000-000000000006", role: "ops" },
};
