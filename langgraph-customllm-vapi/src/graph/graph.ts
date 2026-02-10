import { START, END, StateGraph } from "@langchain/langgraph";
import { GraphStateAnnotation, type GraphState } from "./state.js";
import { lookup } from "./nodes/lookup.js";
import { greetPersonalized, greetGeneral } from "./nodes/greet.js";
import { mentionServices } from "./nodes/mentionServices.js";
import { confirmIdentity } from "./nodes/confirmIdentity.js";
import { identityFailedEnd } from "./nodes/identityFailedEnd.js";
import { detectIntent } from "./nodes/detectIntent.js";
import { thanksEnd } from "./nodes/thanksEnd.js";
import { politeRejection } from "./nodes/politeRejection.js";
import { analyticsSummary } from "./nodes/analyticsSummary.js";
import { synthesizer } from "./nodes/synthesizer.js";
import { activeCases } from "./nodes/activeCases.js";

function entryRouter(
  state: GraphState
): "lookup" | "confirm_identity" | "detect_intent" {
  const lastMessage = state.messages?.[state.messages.length - 1];
  if (lastMessage?.role === "user") {
    return "detect_intent";
  }

  const iter = state.metadata?.state?.iteration_count ?? 0;
  if (iter === 1) return "lookup";

  const step = state.metadata?.state?.current_step ?? "";
  if (step === "ask_are_you_name" || step === "ask_dob") return "confirm_identity";

  return "detect_intent";
}

function routeUserFound(state: GraphState): "greet_personalized" | "greet_general" {
  const found =
    (state.metadata?.state?.is_registered === true) ||
    (state.user_id != null) ||
    (state.user != null);
  return found ? "greet_personalized" : "greet_general";
}

function routeAfterConfirmIdentity(
  state: GraphState
): "identity_failed_end" | "end" {
  const failed = state.metadata?.state?.identity_failed_end === true;
  return failed ? "identity_failed_end" : "end";
}

function routeAfterMentionServices(state: GraphState): "end" | "detect_intent" {
  const iter = state.metadata?.state?.iteration_count ?? 0;
  return iter === 1 ? "end" : "detect_intent";
}

function isExplicitNothingElse(lastUserContent: string): boolean {
  const t = lastUserContent.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return false;
  const explicitPatterns = [
    /^no(\s|,|\.|$)/,
    /nothing\s*else/,
    /that'?s\s*all/,
    /goodbye|bye\b/,
    /that'?s\s*it/,
    /no\s*thanks/,
    /i'?m\s*done/,
    /all\s*done/,
    /nothing\s*more/,
    /not\s*really/,
    /we're\s*good|we\s*are\s*good/,
    /that\s*will\s*be\s*all/,
    /no\s*that'?s\s*(it|all)/,
  ];
  return explicitPatterns.some((p) => p.test(t));
}

function intentRouter(state: GraphState): string {
  const intent = state.current_intent ?? state.metadata?.state?.current_intent ?? "unsupported";
  const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
  const lastUserContent = (lastUser?.content ?? "").trim();

  const map: Record<string, string> = {
    analytics_summary: "analytics_summary",
    active_cases: "active_cases",
    greeting: "greet_general",
    no_request: "thanks_end",

    // Everything else maps to polite_rejection in this simplified analytics-only agent
    invalid_business: "polite_rejection",
    unsupported: "polite_rejection",
    frustration: "polite_rejection",
    emergency: "polite_rejection",
    book: "polite_rejection",
    register: "polite_rejection",
    reschedule: "polite_rejection",
    cancel: "polite_rejection",
    get_appointments: "polite_rejection",
    org_info: "polite_rejection",
  };

  const next = map[intent] ?? "polite_rejection";

  if (next === "thanks_end" && !isExplicitNothingElse(lastUserContent)) {
    return "polite_rejection";
  }
  return next;
}

const builder = new StateGraph(GraphStateAnnotation)
  .addNode("lookup", lookup)
  .addNode("greet_personalized", greetPersonalized)
  .addNode("greet_general", greetGeneral)
  .addNode("mention_services", mentionServices)
  .addNode("confirm_identity", confirmIdentity)
  .addNode("identity_failed_end", identityFailedEnd)
  .addNode("detect_intent", detectIntent)
  .addNode("thanks_end", thanksEnd)
  .addNode("polite_rejection", politeRejection)
  .addNode("analytics_summary", analyticsSummary)
  .addNode("synthesizer", synthesizer)
  .addNode("active_cases", activeCases);

// Wiring
builder.addConditionalEdges(START, entryRouter, {
  lookup: "lookup",
  confirm_identity: "confirm_identity",
  detect_intent: "detect_intent",
});

builder.addConditionalEdges("lookup", routeUserFound, {
  greet_personalized: "greet_personalized",
  greet_general: "greet_general",
});

builder.addEdge("greet_personalized", END);
builder.addEdge("greet_general", "mention_services");

builder.addConditionalEdges("confirm_identity", routeAfterConfirmIdentity, {
  identity_failed_end: "identity_failed_end",
  end: END,
});
builder.addEdge("identity_failed_end", END);

builder.addEdge("mention_services", END);

// MAIN INTENT ROUTING
builder.addConditionalEdges("detect_intent", intentRouter, {
  analytics_summary: "analytics_summary",
  active_cases: "active_cases",
  greet_general: "greet_general",
  thanks_end: "thanks_end",
  polite_rejection: "polite_rejection",
});

// UNIVERSAL SYNTHESIZER ROUTING
builder.addEdge("analytics_summary", "synthesizer");
builder.addEdge("active_cases", "synthesizer");
builder.addEdge("thanks_end", "synthesizer");
builder.addEdge("polite_rejection", "synthesizer");

// Synthesizer to END
builder.addEdge("synthesizer", END);

export const compiledGraph = builder.compile();

export function compileGraph() {
  return compiledGraph;
}
