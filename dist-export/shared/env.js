export function flag(name, fallback = false) {
    const v = (process.env[name] ?? "").toString().trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes" || v === "on")
        return true;
    if (v === "0" || v === "false" || v === "no" || v === "off")
        return false;
    return fallback;
}
export function num(name, fallback) {
    const v = Number(process.env[name]);
    return Number.isFinite(v) ? v : fallback;
}
export function str(name, fallback) {
    const v = (process.env[name] ?? "").toString();
    return v.length ? v : fallback;
}
export function required(name) {
    const v = process.env[name];
    if (!v)
        throw new Error(`Missing env: ${name}`);
    return v;
}
//# sourceMappingURL=env.js.map