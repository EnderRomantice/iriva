import type { Channel, ChannelParticipant, Message, Assignment, Household, OrganizationMembership, Application, Enrollment, Feedback, Membership, Session, State, Submission, User } from "../../domain/models";

export type Awaitable<T> = T | Promise<T>;

/** Domain-facing port. Only the adapter knows SQLite, SQL names, and driver types. */
export interface WorkspaceUnitOfWork {
  read(): Awaitable<State>;
  admission(userId: string, organizationId: string, hostId: string): Awaitable<{ registered: boolean; accepted: boolean; order?: { plan: string; amountMinor: number } }>;
  saveChannel(value: Channel): Awaitable<void>;
  saveChannelParticipant(value: ChannelParticipant): Awaitable<void>;
  saveMessage(value: Message): Awaitable<void>;
  receipt(actorId: string, commandId: string): Awaitable<{ version: number } | undefined>;
  acknowledge(actorId: string, commandId: string, version: number): Awaitable<void>;
  saveSubmission(value: Submission): Awaitable<void>;
  saveFeedback(value: Feedback): Awaitable<void>;
  saveApplication(value: Application): Awaitable<void>;
  saveSession(value: Session): Awaitable<void>;
  saveAssignment(value: Assignment): Awaitable<void>;
  saveHousehold(value: Household): Awaitable<void>;
  saveMembership(value: Membership): Awaitable<void>;
  saveEnrollment(value: Enrollment): Awaitable<void>;
  saveUser(value: User): Awaitable<void>;
  saveOrganizationMembership(value: OrganizationMembership): Awaitable<void>;
  audit(actorId: string, kind: string, entityId: string): Awaitable<void>;
}

/** Async boundary supports remote database adapters without changing HTTP handlers.
 * Each adapter supplies a transaction-scoped unit of work and commits atomically. */
export interface WorkspaceRepository {
  snapshot(): Promise<State>;
  transaction<T>(work: (tx: WorkspaceUnitOfWork) => Awaitable<T>): Promise<T>;
}
