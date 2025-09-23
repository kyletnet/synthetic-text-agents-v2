const http = require("http"),
  https = require("https");
const RE = /openai|anthropic/i;
function wrap(m) {
  const o = m.request;
  m.request = function (...a) {
    try {
      const x = a[0];
      const u =
        typeof x === "string"
          ? x
          : (x?.protocol || "") +
            "//" +
            (x?.hostname || x?.host || "") +
            (x?.path || "");
      if (RE.test(u)) console.log("[LLM_CALL]", u);
    } catch {}
    return o.apply(this, a);
  };
}
wrap(http);
wrap(https);
