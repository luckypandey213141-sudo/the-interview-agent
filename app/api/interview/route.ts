import { NextResponse } from "next/server";
import { handleInterviewTurn } from "@/lib/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, candidate, message } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!candidate && message === undefined) {
      return NextResponse.json({ error: "Either candidate or message must be provided" }, { status: 400 });
    }

    const response = await handleInterviewTurn(sessionId, { candidate, message });
    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error in API route:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
