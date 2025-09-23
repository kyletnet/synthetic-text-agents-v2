import { RunRequest, RunResult, SessionConfig } from "./types";

const API_BASE = "";

export async function runGeneration(request: RunRequest): Promise<RunResult> {
  const response = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getSession(): Promise<SessionConfig> {
  const response = await fetch(`${API_BASE}/api/session`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
