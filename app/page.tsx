"use client";

import React, { useState, useEffect, useRef } from "react";
import candidatesData from "@/lib/candidates.json";

interface CandidateMember {
  id: string;
  name: string;
  jobRole: string;
  yearsExperience: number;
  education: string;
  status: string;
}

interface CandidateMission {
  day: number;
  title: string;
  passed?: boolean;
  attempts?: number;
  skipped?: boolean;
}

interface Candidate {
  member: CandidateMember;
  missions: CandidateMission[];
  signals: {
    commitDays: number;
    missionsCompleted: number;
    missionsFirstTry: number;
  };
}

interface Message {
  role: "interviewer" | "candidate";
  text: string;
  timestamp: string;
}

interface Feedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
}

// Snappy, interactive Typewriter component that allows clicking to skip
const TypewriterText = ({ text, onComplete }: { text: string; onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [skipped, setSkipped] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (skipped) {
      setDisplayedText(text);
      if (onComplete) onComplete();
      return;
    }

    let index = 0;
    setDisplayedText("");
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (onComplete) onComplete();
      }
    }, 10); // snappier writing speed for better QoL

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, skipped]);

  return (
    <span onClick={() => setSkipped(true)} style={{ cursor: "pointer" }} title="Click to skip typing">
      {displayedText}
      {!skipped && displayedText.length < text.length && (
        <span 
          style={{
            fontWeight: "bold",
            color: "var(--primary)",
            marginLeft: "2px",
            animation: "blink 0.8s infinite"
          }}
        >
          |
        </span>
      )}
    </span>
  );
};

export default function Home() {
  const [candidatesList] = useState<Candidate[]>(candidatesData.candidates);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [customCandidateJson, setCustomCandidateJson] = useState<string>("");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);

  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInterviewStarted, setIsInterviewStarted] = useState<boolean>(false);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Stats for current session
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [coveragePlan, setCoveragePlan] = useState<any[]>([]);
  const [currentPlanIndex, setCurrentPlanIndex] = useState<number>(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Set initial candidate
  useEffect(() => {
    if (!isCustomMode && candidatesList[selectedCandidateIndex]) {
      setCandidate(candidatesList[selectedCandidateIndex]);
    }
  }, [selectedCandidateIndex, isCustomMode, candidatesList]);

  // Generate a unique session ID
  const generateSessionId = () => {
    return "sess-" + Math.random().toString(36).substring(2, 11);
  };

  const handleStartInterview = async () => {
    let currentCandidate: Candidate;
    if (isCustomMode) {
      try {
        currentCandidate = JSON.parse(customCandidateJson);
      } catch (e) {
        alert("Invalid JSON format for custom candidate.");
        return;
      }
    } else {
      if (!candidate) return;
      currentCandidate = candidate;
    }

    setIsLoading(true);
    setIsInterviewStarted(true);
    setIsDone(false);
    setFeedback(null);
    setMessages([]);
    setQuestionsCount(0);
    setCurrentPlanIndex(0);

    const generatedSessionId = generateSessionId();
    setSessionId(generatedSessionId);

    // Call API Route for Turn 1
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: generatedSessionId,
          candidate: currentCandidate,
        }),
      });

      const data = await response.json();
      if (data.error) {
        alert(`Error starting interview: ${data.error}`);
        setIsInterviewStarted(false);
        setIsLoading(false);
        return;
      }

      setMessages([
        {
          role: "interviewer",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // Calculate the client-side plan visualization
      const calculatedPlan = buildClientCoveragePlan(currentCandidate);
      setCoveragePlan(calculatedPlan);
    } catch (error) {
      console.error(error);
      alert("Failed to connect to the server.");
      setIsInterviewStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading || isDone) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    // Add user message to log
    setMessages((prev) => [
      ...prev,
      {
        role: "candidate",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setIsLoading(true);

    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userText,
        }),
      });

      const data = await response.json();
      if (data.error) {
        alert(`API Error: ${data.error}`);
        setIsLoading(false);
        return;
      }

      // Add interviewer reply to log
      setMessages((prev) => [
        ...prev,
        {
          role: "interviewer",
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      // Update question counts & indices
      setQuestionsCount((prev) => prev + 1);

      if (data.done) {
        setIsDone(true);
        setFeedback(data.feedback);
      } else {
        const nextIndex = Math.min(Math.floor((questionsCount + 1) / 2), coveragePlan.length - 1);
        setCurrentPlanIndex(nextIndex);
      }
    } catch (error) {
      console.error(error);
      alert("Error sending message.");
    } finally {
      setIsLoading(false);
    }
  };

  const buildClientCoveragePlan = (cand: Candidate) => {
    // Basic local emulation of buildCoveragePlan for UI display purposes
    const struggled = cand.missions.filter((m) => m.skipped !== true && (m.attempts || 0) > 3).map(m => ({ ...m, category: "struggled" }));
    const skipped = cand.missions.filter((m) => m.skipped === true).map(m => ({ ...m, category: "skipped" }));
    const medium = cand.missions.filter((m) => m.skipped !== true && m.attempts === 3).map(m => ({ ...m, category: "medium" }));
    const strong = cand.missions.filter((m) => m.skipped !== true && (m.attempts || 0) <= 2).map(m => ({ ...m, category: "strong" }));
    
    let list = [...struggled, ...skipped, ...medium, ...strong];
    if (list.length < 4) {
      for (let i = 1; i <= 31; i++) {
        if (list.length >= 4) break;
        if (!list.find(x => x.day === i)) {
          list.push({ day: i, title: `Day ${i} Curriculum`, category: "backfill" });
        }
      }
    }
    return list;
  };

  return (
    <div className="app-container">
      {/* Ambient background container */}
      <div className="ambient-container">
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
      </div>

      {/* Sidebar Panel */}
      <div className="sidebar">
        <div className="brand">
          <div className="brand-logo">I</div>
          <div className="brand-name">Interview Agent</div>
        </div>

        {/* Candidate Configuration */}
        {!isInterviewStarted ? (
          <>
            <div className="candidate-selector">
              <span className="section-title">Configure Candidate</span>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <button
                  className={`btn-send`}
                  style={{ flex: 1, padding: "8px 12px", background: !isCustomMode ? undefined : "rgba(255,255,255,0.05)" }}
                  onClick={() => setIsCustomMode(false)}
                >
                  Presets
                </button>
                <button
                  className={`btn-send`}
                  style={{ flex: 1, padding: "8px 12px", background: isCustomMode ? undefined : "rgba(255,255,255,0.05)" }}
                  onClick={() => {
                    setIsCustomMode(true);
                    if (!customCandidateJson) {
                      setCustomCandidateJson(JSON.stringify(candidatesList[0], null, 2));
                    }
                  }}
                >
                  Custom JSON
                </button>
              </div>

              {!isCustomMode ? (
                <select
                  className="select-input"
                  value={selectedCandidateIndex}
                  onChange={(e) => setSelectedCandidateIndex(Number(e.target.value))}
                >
                  {candidatesList.map((c, idx) => (
                    <option key={c.member.id} value={idx}>
                      {c.member.name} — {c.member.jobRole}
                    </option>
                  ))}
                </select>
              ) : (
                <textarea
                  className="select-input"
                  style={{ height: "240px", fontFamily: "monospace", fontSize: "0.8rem", resize: "none" }}
                  value={customCandidateJson}
                  onChange={(e) => setCustomCandidateJson(e.target.value)}
                  placeholder="Paste Candidate JSON here..."
                />
              )}
            </div>

            {candidate && !isCustomMode && (
              <div className="candidate-card">
                <div className="candidate-name">{candidate.member.name}</div>
                <div className="candidate-meta">
                  <div>Role: <span>{candidate.member.jobRole}</span></div>
                  <div>Experience: <span>{candidate.member.yearsExperience} years</span></div>
                  <div>Education: <span>{candidate.member.education}</span></div>
                </div>
                <div className="signals-grid">
                  <div className="signal-badge">
                    <span className="signal-val">{candidate.signals.commitDays}</span>
                    <span className="signal-lbl">Commits</span>
                  </div>
                  <div className="signal-badge">
                    <span className="signal-val">{candidate.signals.missionsCompleted}</span>
                    <span className="signal-lbl">Missions</span>
                  </div>
                  <div className="signal-badge">
                    <span className="signal-val">{candidate.signals.missionsFirstTry}</span>
                    <span className="signal-lbl">First Try</span>
                  </div>
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={handleStartInterview}>
              Start Interview
            </button>
          </>
        ) : (
          <>
            <div className="candidate-card">
              <span className="section-title">Interviewing</span>
              <div className="candidate-name" style={{ marginBottom: "8px" }}>
                {isCustomMode ? "Custom Candidate" : candidate?.member.name}
              </div>
              <div className="candidate-meta">
                <div>Role: <span>{isCustomMode ? "Unseen/Grade Candidate" : candidate?.member.jobRole}</span></div>
                <div>Session: <span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{sessionId}</span></div>
              </div>
            </div>

            {/* Coverage Plan visualization */}
            <div>
              <span className="section-title">Coverage Plan Progress</span>
              <div className="plan-container">
                {coveragePlan.map((planDay, idx) => {
                  const isActive = idx === currentPlanIndex;
                  const isCompleted = idx < currentPlanIndex;
                  return (
                    <div
                      key={planDay.day}
                      className={`plan-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
                    >
                      <div className={`plan-dot ${planDay.category}`} />
                      <div className="plan-info">
                        <div className="plan-title">Day {planDay.day}: {planDay.title}</div>
                        <div className="plan-type">
                          {planDay.category} {planDay.attempts ? `(${planDay.attempts} attempts)` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              className="btn-send"
              style={{ marginTop: "auto", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#ef4444" }}
              onClick={() => setIsInterviewStarted(false)}
            >
              Reset Session
            </button>
          </>
        )}
      </div>

      {/* Main Chat Panel */}
      <div className="chat-area">
        {!isInterviewStarted ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <h2>AI Cohort Interview Agent</h2>
            <p style={{ maxWidth: "460px", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              Configure a candidate from the left panel and click **Start Interview** to begin a personalized,
              multi-turn technical evaluation of their learning journey.
            </p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-header-title">
                <h2>Active Interview</h2>
                <div className="chat-status-bar">
                  <div className="status-stat">
                    Questions Asked: <span>{questionsCount}</span>
                  </div>
                  <div className="status-stat">
                    Days Covered: <span>{Math.min(currentPlanIndex + 1, coveragePlan.length)}/4</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="messages-container">
              {messages.map((msg, index) => {
                const isLast = index === messages.length - 1;
                const isInterviewer = msg.role === "interviewer";
                return (
                  <div key={index} className={`message-wrapper ${msg.role}`}>
                    <div className="message-bubble">
                      {isLast && isInterviewer ? (
                        <TypewriterText text={msg.text} />
                      ) : (
                        <span>{msg.text}</span>
                      )}
                    </div>
                    <div className="message-meta">{msg.timestamp}</div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="message-wrapper interviewer">
                  <div className="message-bubble thinking">
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                    <div className="thinking-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-bar" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder={isDone ? "Interview completed" : "Type your technical response here..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading || isDone}
              />
              <button type="submit" className="btn-send" disabled={isLoading || isDone || !inputMessage.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </div>

      {/* Final Feedback Overlay */}
      {isDone && feedback && (
        <div className="feedback-overlay">
          <div className="feedback-card">
            <div className="feedback-header">
              <h3>Technical Interview Feedback</h3>
              <p>Completed evaluation summary and insights</p>
            </div>

            <div className="feedback-summary">
              {feedback.summary}
            </div>

            <div className="feedback-details">
              <div className="feedback-section">
                <div className="feedback-section-title strengths">
                  <span>🟢</span> Technical Strengths
                </div>
                <ul className="feedback-list">
                  {feedback.strengths.map((item, idx) => (
                    <li key={idx} className="feedback-list-item strength">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="feedback-section">
                <div className="feedback-section-title gaps">
                  <span>🔴</span> Knowledge Gaps
                </div>
                <ul className="feedback-list">
                  {feedback.gaps.map((item, idx) => (
                    <li key={idx} className="feedback-list-item gap">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="feedback-section feedback-details-full">
                <div className="feedback-section-title next">
                  <span>🔵</span> Recommended Actionable Next Steps
                </div>
                <ul className="feedback-list">
                  {feedback.next.map((item, idx) => (
                    <li key={idx} className="feedback-list-item next-step">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              className="btn-primary btn-restart"
              onClick={() => {
                setIsInterviewStarted(false);
                setIsDone(false);
                setFeedback(null);
              }}
            >
              Finish & Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
