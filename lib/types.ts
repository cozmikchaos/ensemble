import type { AnswerImage } from './content';
export type Analysis = { summary: string; themes: string[]; misconceptions: string[]; weakAreas: string[]; followUpQuestions: string[] };
export type Answer = { id: string; body: string; images: AnswerImage[]; points: 0|1|null };
export type Student = { id: string; name: string; connected: boolean; points: number; submissions: number; selections: number };
export type Round = { id: string; number: number; status: 'open'|'closed'; selectedId: string|null; selectedStudentName: string|null; analysis: Analysis|null; answers: Answer[]; responseCount: number };
export type Snapshot = { role: 'teacher'|'student'; code: string; name: string; createdAt: string; students: Student[]; studentCount: number; connectedCount: number; round: Round|null; totalRounds: number; totalResponses: number; ownAnswer: string; ownImages: AnswerImage[]; studentName: string|null; ownPoints: number; aiAvailable: boolean };
export type Credentials = { code: string; token: string; role: 'teacher'|'student' };
export type Reply<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
