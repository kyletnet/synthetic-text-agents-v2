export function matchContext(run, sel = {}) {
    if (!run)
        return false;
    if (sel.domain && run.domain !== sel.domain)
        return false;
    if (sel.tags && Array.isArray(sel.tags)) {
        // best-effort: check run issues/tags text
        const txt = JSON.stringify(run.issues || []);
        if (!sel.tags.every((t) => txt.includes(t)))
            return false;
    }
    if (typeof sel.difficulty_min === "number" &&
        (run.difficulty ?? 0) < sel.difficulty_min)
        return false;
    if (typeof sel.difficulty_max === "number" &&
        (run.difficulty ?? 10) > sel.difficulty_max)
        return false;
    return true;
}
//# sourceMappingURL=selectors.js.map