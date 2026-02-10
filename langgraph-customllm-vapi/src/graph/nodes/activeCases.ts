import { getActiveCases } from "../../apiClient.js";
import { extractAnalyticsDateRange } from "../llm.js";
import type { GraphState } from "../state.js";

const NODE = "active_cases";

export async function activeCases(state: GraphState): Promise<Partial<GraphState>> {
    const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
    const userContent = lastUser?.content ?? "";

    // Use previous range if available, or current date if not
    const now = new Date().toISOString().split("T")[0];
    const previousRange = state.metadata?.state?.analytics_time_range;

    // Extract date range using LLM
    let range = await extractAnalyticsDateRange(userContent, now);

    // If no new range extracted but we have a previous one and user implies continuation, reuse it.
    if (!range && previousRange) {
        range = previousRange;
    }

    if (!range) {
        // Fallback default (e.g. current year)
        const y = new Date().getFullYear();
        range = { from: `${y}-01-01`, to: `${y}-12-31` };
    }

    try {
        const response = await getActiveCases({
            startDate: range.from,
            endDate: range.to,
            limit: 10 // Limit details to top 10 for voice summary to avoid overload
        });

        return {
            assistantResponse: "", // Synthesizer will fill this
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_time_range: range,
                    active_cases_raw: response,
                    // Clear previous outputs
                    voice_output: null,
                    text_output: null
                }
            }
        };
    } catch (error) {
        console.error("Active Cases API failed:", error);
        return {
            assistantResponse: "I'm sorry, I couldn't access the active cases data at this time.",
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    active_cases_raw: { error: "Failed to fetch data" }
                }
            }
        };
    }
}
