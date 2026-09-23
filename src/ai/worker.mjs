import { AutoTokenizer, pipeline, env } from "@huggingface/transformers";
import * as ort from "onnxruntime-web";
import { LocalDetector } from "./gliner.mjs";
import {
  parsePlan,
  instructionDetails,
  completeInstructionPlan,
} from "./core.mjs";
import { plannerMessages } from "./prompt.mjs";
const origin = self.location.origin;
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = origin + "/ai-models/";
env.useBrowserCache = false;
env.useFSCache = false;
env.backends.onnx.wasm.wasmPaths = origin + "/ai-runtime/";
env.backends.onnx.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = origin + "/ai-runtime/";
ort.env.wasm.numThreads = 1;
let detector, planner;
async function run(type, payload) {
  if (type === "plan") {
    if (
      typeof payload.instruction !== "string" ||
      payload.instruction.length > 1000
    )
      throw new Error("Instruction trop longue.");
    const details = instructionDetails(payload.instruction);
    if (
      details.literals.length &&
      !/noms|adresses|e-mails|emails|téléphones|iban|cartes|names|addresses|phones/iu.test(
        payload.instruction,
      )
    )
      return completeInstructionPlan({ categories: [] }, payload.instruction);
    if (detector) {
      await detector.session.release();
      detector = null;
    }
    planner ||= await pipeline("text-generation", "planner", {
      dtype: "q4f16",
      device: "wasm",
    });
    const result = await planner(plannerMessages(payload.instruction), {
      max_new_tokens: 80,
      tokenizer_encode_kwargs: { enable_thinking: false },
      do_sample: false,
      return_full_text: false,
    });
    const generated = result[0].generated_text;
    const answer =
      typeof generated === "string" ? generated : generated.at(-1).content;
    return completeInstructionPlan(
      parsePlan(answer, payload.instruction),
      payload.instruction,
    );
  }
  if (type === "detect") {
    if (planner) {
      await planner.dispose();
      planner = null;
    }
    if (!detector) {
      const tokenizer = await AutoTokenizer.from_pretrained("ner");
      const session = await ort.InferenceSession.create(
        origin + "/ai-models/ner/onnx/model_fp16.onnx",
        { executionProviders: ["wasm"] },
      );
      detector = new LocalDetector(ort, tokenizer, session);
    }
    return detector.detect(payload.text, payload.labels);
  }
  throw new Error("Commande inconnue.");
}
let running = false;
self.onmessage = async ({ data }) => {
  const { id, type, payload } = data;
  if (running) {
    self.postMessage({ id, error: "Analyse déjà en cours." });
    return;
  }
  running = true;
  try {
    self.postMessage({ id, result: await run(type, payload) });
  } catch (error) {
    self.postMessage({
      id,
      error: error.message || "Le modèle local n’a pas pu traiter la demande.",
    });
  } finally {
    running = false;
  }
};
