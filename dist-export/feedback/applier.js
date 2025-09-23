// Conservative merge (shallow): only set fields that do not exist; never overwrite arrays with longer originals
export function conservativeMerge(orig, deltas) {
    const out = { ...orig };
    for (const [k, v] of Object.entries(deltas || {})) {
        if (out[k] === undefined)
            out[k] = v;
        else if (typeof out[k] === "string" &&
            typeof v === "string" &&
            out[k].length < 16)
            out[k] = v; // tiny fields OK
        // else: keep original
    }
    return out;
}
export function applyPatchCard(obj, card) {
    if (!card.applies)
        return { result: obj, changed: [] };
    const before = JSON.stringify(obj);
    const merged = conservativeMerge(obj, card.deltas);
    const changed = before === JSON.stringify(merged) ? [] : Object.keys(card.deltas || {});
    return { result: merged, changed };
}
//# sourceMappingURL=applier.js.map