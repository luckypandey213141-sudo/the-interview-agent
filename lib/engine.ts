import { buildCoveragePlan, Candidate, PlannedDay } from "./planner";
import { sessionStore, SessionState, QuestionEvaluation } from "./store";
import { generatePersonalizedQuestion, evaluateCandidateAnswer, generateFinalFeedback, FeedbackOutput } from "./llm";

export interface InterviewResponse {
  reply: string;
  done: boolean;
  feedback?: FeedbackOutput;
}

export async function handleInterviewTurn(
  sessionId: string,
  input: { candidate?: Candidate; message?: string }
): Promise<InterviewResponse> {
  let session = sessionStore.get(sessionId);

  // --- TURN 1: Start Session ---
  if (input.candidate) {
    const coveragePlan = buildCoveragePlan(input.candidate);

    const newSession: SessionState = {
      sessionId,
      candidate: input.candidate,
      coveragePlan,
      currentPlanIndex: 0,
      questionsAskedInCurrentDay: 0,
      totalQuestionsAsked: 0,
      currentQuestionState: "NOT_ASKED",
      conversationHistory: [],
      isDone: false,
      evaluations: [],
    };

    sessionStore.set(sessionId, newSession);

    return {
      reply: "Welcome. Let's begin your interview.",
      done: false,
    };
  }

  // --- TURN 2+: Conversation ---
  if (!session) {
    throw new Error(`Session ${sessionId} not found. Please start the interview first.`);
  }

  if (session.isDone) {
    // If somehow called after completion, return final feedback again
    const finalFeedback = await generateFinalFeedback(
      session.candidate,
      session.evaluations,
      session.conversationHistory
    );
    return {
      reply: "Interview completed.",
      done: true,
      feedback: finalFeedback,
    };
  }

  const userMessage = input.message || "";
  session.conversationHistory.push({
    role: "candidate",
    text: userMessage,
  });

  // Evaluate the candidate's last answer if there was a previous question
  if (session.lastQuestion) {
    const currentDay = session.coveragePlan[session.currentPlanIndex];
    const evaluation = await evaluateCandidateAnswer(currentDay, session.lastQuestion, userMessage);

    const questionEval: QuestionEvaluation = {
      day: currentDay.day,
      category: currentDay.category,
      question: session.lastQuestion,
      answer: userMessage,
      score: evaluation.score,
      reasoning: evaluation.reasoning,
    };

    session.evaluations.push(questionEval);

    // Heuristic + LLM Judgment: decide whether to advance or ask follow-up
    // Rule: Move to next day if:
    //   - Answer is solid AND (we already have >= 8 questions planned/asked OR we reached the max questions for the current day: 2)
    //   - OR we reached the max questions for the day (2)
    const reachedDailyLimit = session.questionsAskedInCurrentDay >= 2;
    const isSolidAnswer = evaluation.score === "solid";

    // Advance condition
    if (reachedDailyLimit || (isSolidAnswer && session.totalQuestionsAsked >= 8)) {
      // Move to next day in coverage plan
      session.currentPlanIndex += 1;
      session.questionsAskedInCurrentDay = 0;
    } else {
      // Otherwise, we either need a follow-up because:
      //   1. The answer was thin/vague/incorrect.
      //   2. We need to hit the 8-question minimum (so we ask a deeper follow-up).
      // If we already reached 2 questions for this day, we must advance anyway (handled by reachedDailyLimit above)
      if (session.questionsAskedInCurrentDay >= 2) {
        session.currentPlanIndex += 1;
        session.questionsAskedInCurrentDay = 0;
      }
    }
  }

  // Check if we should end the interview
  // End conditions:
  // - We have asked at least 8 questions AND
  // - We have covered at least 4 distinct days (which means we completed evaluations for 4 days)
  // Let's count how many distinct days we have evaluated.
  const distinctDaysEvaluated = new Set(session.evaluations.map((e) => e.day));

  if (session.totalQuestionsAsked >= 8 && distinctDaysEvaluated.size >= 4) {
    session.isDone = true;
    sessionStore.set(sessionId, session);

    const finalFeedback = await generateFinalFeedback(
      session.candidate,
      session.evaluations,
      session.conversationHistory
    );

    return {
      reply: "Interview completed.",
      done: true,
      feedback: finalFeedback,
    };
  }

  // Ensure we have a valid planned day. If we ran out of plan (should be rare due to backfill), add a backfill day
  if (session.currentPlanIndex >= session.coveragePlan.length) {
    const curriculum = require("./planner").getCurriculum();
    const seenDays = new Set(session.coveragePlan.map((d) => d.day));
    let backfillDay = curriculum.days.find((d: any) => !seenDays.has(d.day));
    if (!backfillDay) {
      // fallback to any day
      backfillDay = curriculum.days[0];
    }
    session.coveragePlan.push({
      day: backfillDay.day,
      title: backfillDay.title,
      objectives: backfillDay.objectives,
      tools: backfillDay.tools,
      category: "backfill",
    });
  }

  // Generate the next question
  const currentDay = session.coveragePlan[session.currentPlanIndex];
  const nextQuestionState = session.questionsAskedInCurrentDay === 0 ? "ASKED_INITIAL" : "ASKED_FOLLOWUP";

  const nextQuestion = await generatePersonalizedQuestion(
    session.candidate,
    currentDay,
    nextQuestionState,
    session.conversationHistory
  );

  session.conversationHistory.push({
    role: "interviewer",
    text: nextQuestion,
  });

  session.lastQuestion = nextQuestion;
  session.questionsAskedInCurrentDay += 1;
  session.totalQuestionsAsked += 1;
  session.currentQuestionState = nextQuestionState;

  // Save the updated state
  sessionStore.set(sessionId, session);

  return {
    reply: nextQuestion,
    done: false,
  };
}
