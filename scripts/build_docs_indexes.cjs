"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
function ensureDir(p) {
  if (!import_fs.default.existsSync(p)) import_fs.default.mkdirSync(p, { recursive: true });
}
function listLatest(dir, extFilter, limit = 20) {
  if (!import_fs.default.existsSync(dir)) return [];
  return import_fs.default.readdirSync(dir).filter((f) => extFilter.test(f)).map((f) => ({ f, t: import_fs.default.statSync(import_path.default.join(dir, f)).mtime.getTime() })).sort((a, b) => b.t - a.t).slice(0, limit).map((x) => x.f);
}
function writeIndex(root, sub, title, pattern) {
  const dir = import_path.default.join(root, sub);
  ensureDir(dir);
  const files = listLatest(dir, pattern, 50);
  const md = `# ${title}

_Last updated: ${(/* @__PURE__ */ new Date()).toISOString()}_

` + (files.length ? files.map((f) => `- [${f}](${sub}/${f})`).join("\n") : "_No files_") + "\n";
  const out = import_path.default.join(root, sub, "INDEX.md");
  import_fs.default.writeFileSync(out, md, "utf-8");
  return out;
}
const docsRoot = import_path.default.resolve(process.cwd(), "apps", "fe-web", "docs");
const out1 = writeIndex(docsRoot, "RUN_LOGS", "Run Logs (latest)", /\.md$/);
const out2 = writeIndex(docsRoot, "DECISIONS", "Improvement Notes (latest)", /\.md$/);
const out3 = writeIndex(docsRoot, "EXPERIMENTS", "Sandbox Experiments (latest)", /\.md$/);
console.log("Indexes written:", out1, out2, out3);
