import type { Snapshot } from "@/domain/models";

// This narrows an already-authorized organization snapshot; it is not an authorization boundary.
export function householdSnapshot(data: Snapshot, householdId: string): Snapshot | undefined {
  if (!householdId) return data;
  const household = data.households.find(h => h.id === householdId);
  if (!household) return undefined;
  const assignments = data.assignments.filter(a => a.householdId === householdId);
  const assignmentIds = new Set(assignments.map(a => a.id));
  const submissions = data.submissions.filter(s => assignmentIds.has(s.assignmentId));
  const submissionIds = new Set(submissions.map(s => s.id));
  return {
    ...data,
    households: [household],
    terms: data.terms.filter(t => t.id === household.termId),
    memberships: data.memberships.filter(m => m.householdId === householdId),
    sessions: data.sessions.filter(s => s.householdId === householdId),
    assignments, submissions,
    feedback: data.feedback.filter(f => submissionIds.has(f.submissionId)),
    enrollments: data.enrollments.filter(e => e.householdId === householdId),
    applications: [],
  };
}
