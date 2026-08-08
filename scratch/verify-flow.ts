import { handleInterviewTurn } from "../lib/engine";
import candidatesData from "../lib/candidates.json";

// Configure Mock Mode for testing without external API key dependencies
process.env.MOCK_LLM = "true";

async function runCandidateSimulation(candidateIndex: number) {
  const candidate = candidatesData.candidates[candidateIndex];
  console.log(`\n==================================================`);
  console.log(`SIMULATING INTERVIEW FOR: ${candidate.member.name} (${candidate.member.jobRole})`);
  console.log(`Missions Completed: ${candidate.signals.missionsCompleted}, First Try: ${candidate.signals.missionsFirstTry}`);
  console.log(`==================================================`);

  const sessionId = `test-sess-${candidate.member.id}`;
  
  // Turn 1: Start Interview
  console.log(`[Turn 1] Starting session...`);
  let response = await handleInterviewTurn(sessionId, { candidate });
  console.log(`Interviewer: "${response.reply}"`);
  console.log(`done: ${response.done}`);

  let turn = 2;
  // Loop through subsequent turns
  while (!response.done) {
    console.log(`\n[Turn ${turn}]`);
    
    // Simulate candidate message
    // If the question is about a skipped day, give a vague answer to test follow-up logic.
    // Otherwise, simulate a solid response.
    let simulatedAnswer = "I set up a local Postgres index and connected it to Pinecone vector embeddings.";
    if (turn % 3 === 0) {
      simulatedAnswer = "I am not very sure about this, it was vague.";
    }

    console.log(`Candidate (Simulated): "${simulatedAnswer}"`);
    
    response = await handleInterviewTurn(sessionId, { message: simulatedAnswer });
    console.log(`Interviewer: "${response.reply}"`);
    console.log(`done: ${response.done}`);
    
    if (response.done && response.feedback) {
      console.log(`\n[SUCCESS] Final Feedback Generated:`);
      console.log(`Summary: ${response.feedback.summary}`);
      console.log(`Strengths:`, response.feedback.strengths);
      console.log(`Gaps:`, response.feedback.gaps);
      console.log(`Next Steps:`, response.feedback.next);
    }
    
    turn++;
    if (turn > 20) {
      console.error("FAIL: Interview got stuck in an infinite loop!");
      break;
    }
  }
}

async function runTests() {
  try {
    // Test Sarah Johnson (Index 0) - has struggled/skipped topics
    await runCandidateSimulation(0);
    
    // Test Emily Chen (Index 2) - passed everything first try
    await runCandidateSimulation(2);
    
    console.log("\n==================================================");
    console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("==================================================");
  } catch (error) {
    console.error("Test execution failed:", error);
  }
}

runTests();
