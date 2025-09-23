import fs from "fs";
import path from "path";
export function appendJSONL(p, obj) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(obj) + "\n", "utf8");
}
export function writeText(p, s) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, s, "utf8");
}
//# sourceMappingURL=log.js.map