export const oralGrades = ['D', 'C', 'B', 'A', 'A+'] as const;
export type OralGrade = typeof oralGrades[number];
