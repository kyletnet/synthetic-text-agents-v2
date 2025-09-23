export function flag(name: string, fallback = false): boolean {
  const v = (process.env[name] ?? "").toString().trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}
export function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}
export function str(name: string, fallback: string): string {
  const v = (process.env[name] ?? "").toString();
  return v.length ? v : fallback;
}
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
