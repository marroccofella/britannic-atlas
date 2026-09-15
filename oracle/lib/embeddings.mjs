// Local, pinned sentence embeddings. Download happens only in the explicit setup command.
import path from "node:path";
import { fileURLToPath } from "node:url";
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_REVISION = "751bff37182d3f1213fa05d7196b954e230abad9";
export const EMBEDDING_ID = EMBEDDING_MODEL + "@" + EMBEDDING_REVISION + ":q8:mean:normalised";
export const EMBEDDING_DIMENSIONS = 384;
export const DEFAULT_MODEL_CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/models");
let instance = null;
export async function localEmbedder({ download = false, cacheDir = DEFAULT_MODEL_CACHE } = {}) {
  if (!instance) instance = (async () => {
    const { pipeline, AutoTokenizer, env } = await import("@huggingface/transformers");
    env.cacheDir = cacheDir;
    env.allowRemoteModels = download;
    env.allowLocalModels = true;
    // Version 4's model registry probes the unversioned cache when given a model
    // id. Point offline reads at the exact downloaded revision instead.
    const resource = download ? EMBEDDING_MODEL : path.join(cacheDir, EMBEDDING_MODEL, EMBEDDING_REVISION);
    const pipe = await pipeline("feature-extraction", resource, {
      revision: EMBEDDING_REVISION, dtype: "q8", device: "cpu",
      session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
    });
    const tokenizer = await AutoTokenizer.from_pretrained(resource, { revision: EMBEDDING_REVISION });
    return {
      id: EMBEDDING_ID, dimensions: EMBEDDING_DIMENSIONS,
      async embed(texts) {
        if (!Array.isArray(texts) || texts.length > 16 || texts.some(t => typeof t !== "string" || t.length > 16000)) throw new Error("Embedding batch exceeds local limits.");
        if (!texts.length) return [];
        const result = await pipe(texts, { pooling: "mean", normalize: true, truncation: true, max_length: 256 });
        return result.tolist();
      },
      countTokens(text) { return tokenizer.encode(String(text), { add_special_tokens: false }).length; },
    };
  })().catch(error => { instance = null; throw error; });
  return instance;
}
