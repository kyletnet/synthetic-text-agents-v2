import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { appendJSONL } from './jsonl.js';
import { flag, num, str } from './env.js';

const RATE = { last: 0, qps: num('LLM_RATE_QPS', 2) };
const COST_STATE = { usd: 0, cap: num('LLM_COST_CAP_USD', 2) }; // naive demo

function sleep(ms:number){ return new Promise(r=>setTimeout(r,ms)); }

async function throttle() {
  const now=Date.now();
  const minInterval = 1000 / Math.max(1, RATE.qps);
  if (now - RATE.last < minInterval) {
    await sleep(minInterval - (now - RATE.last));
  }
  RATE.last = Date.now();
}

export async function generateJSON<T=unknown>(args: {
  system?: string;
  prompt: string;
  schemaHint?: string; // to steer JSON output in prompt
  runId?: string;
}): Promise<{ text: string; json?: T | undefined; usedDryRun: boolean }> {
  const DRY = flag('DRY_RUN', true) || (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY);
  const modelId = str('LLM_MODEL', 'gpt-4o-mini');
  const timeoutMs = num('LLM_TIMEOUT_MS', 20000);
  const maxRetries = num('LLM_MAX_RETRIES', 1);
  const maxTokens = num('LLM_MAX_TOKENS', 1024);

  const runId = args.runId || `run_${Date.now()}`;
  const metaLog = (payload: any) => appendJSONL(`RUN_LOGS/${runId}.jsonl`, payload);

  if (DRY) {
    const mock = `{"mock": true, "note": "dry-run enabled; showing prompt only", "preview": ${JSON.stringify(args.prompt.slice(0, 200))}}`;
    metaLog({ ts: new Date().toISOString(), type: 'llm.dry', modelId, promptPreview: args.prompt.slice(0, 500) });
    return { text: mock, json: undefined as T | undefined, usedDryRun: true };
  }

  if (COST_STATE.usd >= COST_STATE.cap) {
    metaLog({ ts: new Date().toISOString(), type: 'llm.cost_cap', cap: COST_STATE.cap });
    throw new Error(`LLM cost cap reached (cap=${COST_STATE.cap} USD)`);
  }

  const client = openai;
  const controller = new AbortController();

  let attempt=0, lastErr:any;
  while (attempt <= maxRetries) {
    attempt++;
    try {
      await throttle();
      const timer = setTimeout(()=>controller.abort(), timeoutMs);

      const callOptions: any = {
        model: client(modelId),
        prompt: [
          args.schemaHint ? `Return ONLY JSON matching: ${args.schemaHint}` : '',
          args.prompt
        ].filter(Boolean).join('\n\n'),
        abortSignal: controller.signal,
      };

      if (args.system) {
        callOptions.system = args.system;
      }

      const result = await generateText(callOptions);

      const { text, usage } = result;

      clearTimeout(timer);

      // naive cost est (demo). In reality, map usage to provider pricing.
      const usd = ((usage?.totalTokens ?? 0) / 1000) * 0.005;
      COST_STATE.usd += usd;

      metaLog({ ts: new Date().toISOString(), type: 'llm.ok', modelId, usage, usd, attempt });

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      return { text, json: parsed as T, usedDryRun: false };

    } catch (err:any) {
      lastErr = err;
      metaLog({ ts: new Date().toISOString(), type: 'llm.fail', attempt, err: String(err) });
      // simple circuit-breaker: backoff then retry
      if (attempt <= maxRetries) await sleep(500 * attempt);
    }
  }
  throw lastErr;
}
