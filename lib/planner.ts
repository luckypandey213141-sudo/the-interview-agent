import fs from "fs";
import path from "path";

export interface CurriculumDay {
  day: number;
  title: string;
  type: string;
  tools: string[];
  objectives: string[];
}

export interface CandidateMission {
  day: number;
  title: string;
  passed?: boolean;
  attempts?: number;
  skipped?: boolean;
}

export interface CandidateMember {
  id: string;
  name: string;
  jobRole: string;
  yearsExperience: number;
  education: string;
  status: string;
}

export interface Candidate {
  member: CandidateMember;
  missions: CandidateMission[];
  signals: {
    commitDays: number;
    missionsCompleted: number;
    missionsFirstTry: number;
  };
}

export interface PlannedDay {
  day: number;
  title: string;
  objectives: string[];
  tools: string[];
  category: "struggled" | "skipped" | "medium" | "strong" | "backfill";
  attempts?: number;
  skipped?: boolean;
}

// Load curriculum.json safely
export function getCurriculum(): { days: CurriculumDay[] } {
  try {
    const filePath = path.join(process.cwd(), "lib", "curriculum.json");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Failed to load curriculum.json:", error);
    return { days: [] };
  }
}

/**
 * Classifies candidate missions and builds an ordered coverage plan of at least 4 distinct curriculum days.
 * Prioritization: struggled -> skipped -> medium -> strong -> backfill
 */
export function buildCoveragePlan(candidate: Candidate): PlannedDay[] {
  const curriculum = getCurriculum();
  const curriculumMap = new Map<number, CurriculumDay>();
  for (const cDay of curriculum.days) {
    curriculumMap.set(cDay.day, cDay);
  }

  const struggledList: PlannedDay[] = [];
  const skippedList: PlannedDay[] = [];
  const mediumList: PlannedDay[] = [];
  const strongList: PlannedDay[] = [];

  const seenDays = new Set<number>();

  for (const mission of candidate.missions) {
    const cDay = curriculumMap.get(mission.day);
    if (!cDay) continue;

    const plannedDay: PlannedDay = {
      day: mission.day,
      title: cDay.title,
      objectives: cDay.objectives,
      tools: cDay.tools,
      category: "strong", // Default fallback
      attempts: mission.attempts,
      skipped: mission.skipped,
    };

    if (mission.skipped === true) {
      plannedDay.category = "skipped";
      skippedList.push(plannedDay);
      seenDays.add(mission.day);
    } else if (mission.passed === false || (mission.attempts !== undefined && mission.attempts > 3)) {
      plannedDay.category = "struggled";
      struggledList.push(plannedDay);
      seenDays.add(mission.day);
    } else if (mission.attempts === 3) {
      plannedDay.category = "medium";
      mediumList.push(plannedDay);
      seenDays.add(mission.day);
    } else if (mission.attempts !== undefined && mission.attempts <= 2) {
      plannedDay.category = "strong";
      strongList.push(plannedDay);
      seenDays.add(mission.day);
    }
  }

  // Combine them in priority order
  let plan: PlannedDay[] = [
    ...struggledList,
    ...skippedList,
    ...mediumList,
    ...strongList,
  ];

  // Ensure at least 4 distinct days. If not, backfill from curriculum
  if (plan.length < 4) {
    for (const cDay of curriculum.days) {
      if (plan.length >= 4) break;
      if (!seenDays.has(cDay.day)) {
        plan.push({
          day: cDay.day,
          title: cDay.title,
          objectives: cDay.objectives,
          tools: cDay.tools,
          category: "backfill",
        });
        seenDays.add(cDay.day);
      }
    }
  }

  return plan;
}
