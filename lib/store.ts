import { Candidate, PlannedDay } from "./planner";

export interface ConversationTurn {
  role: "interviewer" | "candidate";
  text: string;
}

export interface QuestionEvaluation {
  day: number;
  category: string;
  question: string;
  answer: string;
  score: "solid" | "thin/vague/incorrect";
  reasoning: string;
}

export interface SessionState {
  sessionId: string;
  candidate: Candidate;
  coveragePlan: PlannedDay[];
  currentPlanIndex: number;
  questionsAskedInCurrentDay: number;
  totalQuestionsAsked: number;
  currentQuestionState: "ASKED_INITIAL" | "ASKED_FOLLOWUP" | "NOT_ASKED";
  conversationHistory: ConversationTurn[];
  lastQuestion?: string;
  isDone: boolean;
  evaluations: QuestionEvaluation[];
}

class SessionStore {
  private sessions = new Map<string, SessionState>();

  public get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  public set(sessionId: string, state: SessionState): void {
    this.sessions.set(sessionId, state);
  }

  public delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public clear(): void {
    this.sessions.clear();
  }
}

export const sessionStore = new SessionStore();
