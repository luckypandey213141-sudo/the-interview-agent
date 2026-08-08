import { GoogleGenAI, Type } from "@google/genai";
import { Candidate, PlannedDay } from "./planner";
import { ConversationTurn, QuestionEvaluation } from "./store";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables or .env.local");
  }
  return new GoogleGenAI({ apiKey });
}

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Generates an interview question personalized to the candidate's journey on a specific curriculum day.
 */
export async function generatePersonalizedQuestion(
  candidate: Candidate,
  plannedDay: PlannedDay,
  questionState: "ASKED_INITIAL" | "ASKED_FOLLOWUP",
  history: ConversationTurn[]
): Promise<string> {
  // Support Mock Mode if key is missing or explicitly requested
  if (process.env.MOCK_LLM === "true" || !process.env.GEMINI_API_KEY) {
    console.log(`[MOCK MODE] Generating question for Day ${plannedDay.day} (${plannedDay.category})`);
    if (questionState === "ASKED_INITIAL") {
      let promptPrefix = "";
      if (plannedDay.category === "struggled") {
        promptPrefix = `Yo, I saw you spent ${plannedDay.attempts} attempts debugging the Day ${plannedDay.day} mission ("${plannedDay.title}"). Respect the hustle—that's a tough module! 🚀 `;
      } else if (plannedDay.category === "skipped") {
        promptPrefix = `I noticed you skipped the Day ${plannedDay.day} mission ("${plannedDay.title}"). No sweat, let's conceptualize it now. 💡 `;
      } else if (plannedDay.category === "strong") {
        promptPrefix = `You absolutely sailed through Day ${plannedDay.day} ("${plannedDay.title}") on first attempts. Beast mode! ⚡ `;
      } else {
        promptPrefix = `Let's cook with Day ${plannedDay.day} ("${plannedDay.title}"). 🍳 `;
      }
      
      return `${promptPrefix}Can you explain the core design decisions you made here, and how you integrated tools like ${plannedDay.tools.slice(0, 2).join(" or ") || "the curriculum tools"} to make it work?`;
    } else {
      return `Solid explanation! Let's level it up. In regards to Day ${plannedDay.day}'s objective to "${plannedDay.objectives[0]}", how would you build this to scale in production, handle failures gracefully, or optimize API costs?`;
    }
  }

  const client = getClient();
  const historyStr = history
    .map((turn) => `${turn.role === "interviewer" ? "Interviewer" : "Candidate"}: ${turn.text}`)
    .join("\n");

  const prompt = `
You are the Technical Lead Interviewer for the AI Cohort program. Your personality is a supportive, high-vibe, modern engineering lead ("Gen Z tech lead"). 
You talk to the candidate like a peer developer—use positive, encouraging tech slang naturally (like "let's cook 🍳", "beast mode ⚡", "clean code", "solid flow", "respect the hustle 🚀", "let's level this up"). 
Keep the technical probing extremely precise and rigorous, but make the delivery engaging, casual, and supportive.

You are interviewing:
Name: ${candidate.member.name}
Role: ${candidate.member.jobRole}
Experience: ${candidate.member.yearsExperience} years
Education: ${candidate.member.education}

We are currently covering Day ${plannedDay.day}: "${plannedDay.title}"
Category of day for this candidate: ${plannedDay.category.toUpperCase()}
Objectives for this day:
${plannedDay.objectives.map((o) => `- ${o}`).join("\n")}
Tools introduced: ${plannedDay.tools.join(", ")}
${plannedDay.attempts ? `Candidate attempts on this mission: ${plannedDay.attempts}` : ""}
${plannedDay.skipped ? `Candidate skipped this mission: Yes` : ""}

Context for personalization:
- If category is STRUGGLED (attempts > 3), respect their persistence. Acknowledge that the topic is difficult but keep the tone positive. Help them show what they learned while debugging.
- If category is SKIPPED (skipped: true), check conceptual understanding. Acknowledge they skipped writing the code, but dive into the core architecture decisions anyway.
- If category is STRONG (attempts <= 2), go hard on design, trade-offs, and "why" questions since they breezed through it. Show them you want to see their depth.
- If category is MEDIUM (attempts == 3), ask a standard technical question combining concepts and tools.
- If category is BACKFILL, introduce the day's topic with high energy.

Currently we are generating: ${questionState === "ASKED_INITIAL" ? "The initial question for this day" : "A follow-up question for this day based on their previous response"}

Here is the conversation history so far:
${historyStr || "(No history yet)"}

Guidelines:
1. Ask EXACTLY ONE question. Do not bundle multiple questions.
2. Ground your phrasing in their candidate history (mention attempts or skips positively).
3. Do not repeat questions or sound robotic. Speak like a real human engineer.
4. Keep the question concise, focused, and conversational.
`;

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  });

  return response.text ? response.text.trim() : "Failed to generate question.";
}

/**
 * Heuristic/LLM check to evaluate if the candidate's last answer is solid or thin/vague/incorrect.
 */
export async function evaluateCandidateAnswer(
  plannedDay: PlannedDay,
  question: string,
  answer: string
): Promise<{ score: "solid" | "thin/vague/incorrect"; reasoning: string }> {
  // Support Mock Mode if key is missing or explicitly requested
  if (process.env.MOCK_LLM === "true" || !process.env.GEMINI_API_KEY) {
    console.log(`[MOCK MODE] Evaluating answer for Day ${plannedDay.day}`);
    const isThin = answer.toLowerCase().includes("vague") || answer.length < 15;
    return {
      score: isThin ? "thin/vague/incorrect" : "solid",
      reasoning: isThin 
        ? "The candidate gave a brief or placeholder answer lacking specific technical details." 
        : "The candidate explained their design choices and tools with reasonable depth."
    };
  }

  const client = getClient();
  const prompt = `
Evaluate the candidate's response in a technical interview context.
Curriculum Day: Day ${plannedDay.day} - "${plannedDay.title}"
Objectives:
${plannedDay.objectives.map((o) => `- ${o}`).join("\n")}
Tools: ${plannedDay.tools.join(", ")}

Question asked:
"${question}"

Candidate's Answer:
"${answer}"

Determine whether the candidate's answer is:
- "solid": Demonstrates a correct and reasonably complete understanding of the core concept, tool, or objective.
- "thin/vague/incorrect": Is evasive, too brief, lacks technical substance, misses the core question, or contains clear conceptual errors.

Respond with a JSON object containing the fields "score" (either "solid" or "thin/vague/incorrect") and "reasoning" (a brief explanation of your evaluation).
Do not include any markdown format blocks like \`\`\`json. Just return the raw JSON.
`;

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: {
            type: Type.STRING,
            enum: ["solid", "thin/vague/incorrect"],
          },
          reasoning: {
            type: Type.STRING,
          },
        },
        required: ["score", "reasoning"],
      },
    },
  });

  const text = response.text ? response.text.trim() : "";
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse evaluation response:", text, e);
    return {
      score: "thin/vague/incorrect",
      reasoning: "Failed to parse AI evaluation response. Defaulting to thin.",
    };
  }
}

export interface FeedbackOutput {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
}

/**
 * Generates the final structured feedback at the end of the interview.
 */
export async function generateFinalFeedback(
  candidate: Candidate,
  evaluations: QuestionEvaluation[],
  history: ConversationTurn[]
): Promise<FeedbackOutput> {
  // Support Mock Mode if key is missing or explicitly requested
  if (process.env.MOCK_LLM === "true" || !process.env.GEMINI_API_KEY) {
    console.log(`[MOCK MODE] Generating final feedback`);
    const solidEvals = evaluations.filter((e) => e.score === "solid");
    const thinEvals = evaluations.filter((e) => e.score === "thin/vague/incorrect");

    return {
      summary: `Completed the technical interview session for ${candidate.member.name}. The candidate discussed ${evaluations.length} distinct days from their cohort curriculum, demonstrating solid understanding on ${solidEvals.length} areas and showing gaps in ${thinEvals.length} areas. Their overall participation in the cohort (${candidate.signals.missionsCompleted}/31 missions completed, ${candidate.signals.commitDays} active commit days) aligns well with their technical developer profile.`,
      strengths: [
        `Demonstrated analytical thinking on topics like ${solidEvals.map((e) => `Day ${e.day} (${e.category})`).slice(0, 2).join(", ") || "core AI principles"}.`,
        `Committed developer with strong practical execution, completing ${candidate.signals.missionsCompleted} out of 31 total course missions.`
      ],
      gaps: thinEvals.length > 0 
        ? thinEvals.map((e) => `Day ${e.day} (${e.category}): Exhibited gaps in explaining detailed implementation or production trade-offs.`)
        : ["No major conceptual gaps identified during the conversational probing."],
      next: [
        `Re-examine the original objectives for the skipped/struggled days, specifically focusing on ${candidate.missions.filter((m) => m.skipped || (m.attempts || 0) > 3).map((m) => `Day ${m.day}`).slice(0, 2).join(" and ") || "deployment and production scaling"}.`,
        `Build local end-to-end projects with robust evaluation telemetry and container configurations to practicalize advanced modules.`
      ],
    };
  }

  const client = getClient();
  const historyStr = history
    .map((turn) => `${turn.role === "interviewer" ? "Interviewer" : "Candidate"}: ${turn.text}`)
    .join("\n");

  const evaluationsStr = evaluations
    .map(
      (e, idx) =>
        `Topic Day ${e.day} (${e.category}):\nQuestion: ${e.question}\nAnswer: ${e.answer}\nScore: ${e.score.toUpperCase()}\nReasoning: ${e.reasoning}\n`
    )
    .join("\n---\n");

  const prompt = `
Generate the final technical feedback for ${candidate.member.name} who has completed their AI Cohort interview.
Write in the persona of a modern, supportive, high-vibe Engineering Lead. Be honest, professional, but use positive developer phrasing.

Candidate Profile:
- Role: ${candidate.member.jobRole}
- Experience: ${candidate.member.yearsExperience} years
- Aggregate signals: Commit Days: ${candidate.signals.commitDays}, Missions Completed: ${candidate.signals.missionsCompleted}, First Try passes: ${candidate.signals.missionsFirstTry}

Here are the evaluations of the specific topics discussed during the interview:
${evaluationsStr}

Here is the complete conversation history:
${historyStr}

Please synthesize this information and output a comprehensive feedback evaluation.
Your response MUST be a JSON object matching this schema:
{
  "summary": "A concise paragraph summarizing their overall performance, technical mindset, adaptability, and how their cohort progress matches their interview responses.",
  "strengths": [
    "At least 2-3 specific, non-generic strengths shown in the interview or cohort (e.g., strong grasp of vector search trade-offs, highly diligent developer with 30 completed missions)."
  ],
  "gaps": [
    "At least 2-3 specific gaps or areas of improvement identified in their answers (e.g., struggled to explain how Model Context Protocol tools handle errors, gaps in understanding prompt sanitization)."
  ],
  "next": [
    "At least 2-3 concrete, actionable next steps or recommendations for their learning journey (e.g., read the SQLite backend integration objectives for Day 16, build a local Docker project to practice container orchestration)."
  ]
}

Make the points highly specific to what was actually discussed or present in their profile. Avoid generic boilerplate filler like "should keep studying".
Do not include any markdown format blocks like \`\`\`json. Just return the raw JSON.
`;

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          strengths: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          gaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          next: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["summary", "strengths", "gaps", "next"],
      },
    },
  });

  const text = response.text ? response.text.trim() : "";
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse final feedback response:", text, e);
    return {
      summary: "Interview completed. An error occurred generating the detailed summary.",
      strengths: ["Demonstrated overall technical capability during the cohort."],
      gaps: ["Gaps in specific questions asked during the session."],
      next: ["Review the curriculum days and continue building projects."],
    };
  }
}
