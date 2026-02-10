import { extractAnalyticsDateRange } from "../llm.js";
import type { GraphState } from "../state.js";
import { getActiveCases } from "../../apiClient.js";

const NODE = "active_cases";

/**
 * Fetch active cases from Legal API using apiClient.
 * LATENCY OPTIMIZATION: Direct Legal API call (no backend proxy)
 * ARCHITECTURE: Uses apiClient for clean abstraction and logging
 */
export async function activeCases(state: GraphState): Promise<Partial<GraphState>> {
    const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
    const userContent = lastUser?.content ?? "";

    const now = new Date().toISOString().split("T")[0];
    const previousRange = state.metadata?.state?.analytics_time_range;

    // Extract date range using LLM
    let range = await extractAnalyticsDateRange(userContent, now);

    if (!range && previousRange) {
        range = previousRange;
    }

    if (!range) {
        // Fallback default (e.g. current year)
        const y = new Date().getFullYear();
        range = { from: `${y}-01-01`, to: `${y}-12-31` };
    }

    try {
        // USE API CLIENT: Clean abstraction with automatic logging
        const result = await getActiveCases({
            startDate: range.from,
            endDate: range.to,
            limit: 10
        });

        return {
            assistantResponse: "", // Synthesizer will fill this
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_time_range: range,
                    active_cases_raw: result,
                    voice_output: null,
                    text_output: null
                }
            }
        };
    } catch (error) {
        console.error(`[${NODE}] Legal API failed:`, error);
        // NO MOCK DATA FALLBACK - Return real error
        return {
            assistantResponse: "I couldn't retrieve the active cases data from the system right now.",
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    active_cases_raw: { error: "Failed to fetch data from Legal API" }
                }
            }
        };
    }
}
