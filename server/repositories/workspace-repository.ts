import type { Application, Enrollment, Feedback, Membership, Session, State, Submission, User } from "../../domain/models";

/** Domain-facing port. Only the adapter knows SQLite, SQL names, and driver types. */
export interface WorkspaceUnitOfWork {
  read(): State;
  receipt(actorId: string, commandId: string): { version: number } | undefined;
  acknowledge(actorId: string, commandId: string, version: number): void;
  saveSubmission(value: Submission): void;
  saveFeedback(value: Feedback): void;
  saveApplication(value: Application): void;
  saveSession(value: Session): void;
  saveMembership(value: Membership): void;
  saveEnrollment(value: Enrollment): void;
  saveUser(value: User): void;
  audit(actorId: string, kind: string, entityId: string): void;
}

/** Async boundary supports remote database adapters without changing HTTP handlers.
 * Each adapter supplies a transaction-scoped unit of work and commits atomically. */
export interface WorkspaceRepository {
  snapshot(): Promise<State>;
  transaction<T>(work: (tx: WorkspaceUnitOfWork) => T): Promise<T>;
}
