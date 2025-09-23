import { SessionConfig } from "./types";

const SESSION_KEY = "synthetic-agents-session";

export function saveSession(config: SessionConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(config));
  }
}

export function loadSession(): SessionConfig | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function exportSession(config: SessionConfig): void {
  const blob = new Blob([JSON.stringify(config, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importSession(file: File): Promise<SessionConfig> {
  const text = await file.text();
  return JSON.parse(text);
}
