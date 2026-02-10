import { extractAnalyticsDateRange } from "../llm.js";
import type { GraphState } from "../state.js";
import { getAnalyticsSummary } from "../../apiClient.js";

const NODE = "analytics_summary";

/**
 * Fetch analytics summary from Legal API using apiClient.
 * LATENCY OPTIMIZATION: Direct Legal API call (no backend proxy)
 * ARCHITECTURE: Uses apiClient for clean abstraction and logging
 */
export async function analyticsSummary(state: GraphState): Promise<Partial<GraphState>> {
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
        // No date and no previous context -> ASK CLARIFICATION
        return {
            assistantResponse: "",
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_summary_raw: { missing_context: true },
                    voice_output: null,
                    text_output: null
                }
            }
        };
    }

    try {
        // USE API CLIENT: Clean abstraction with automatic logging
        const result = await getAnalyticsSummary({
            startDate: range.from,
            endDate: range.to
        });

        const finalData = result.data || result;

        return {
            assistantResponse: "", // Synthesizer will fill this
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_time_range: range,
                    analytics_summary_raw: finalData,
                    voice_output: null,
                    text_output: null
                }
            }
        };
    } catch (error) {
        console.error(`[${NODE}] Legal API failed:`, error);
        // NO MOCK DATA FALLBACK - Return real error
        return {
            assistantResponse: "I couldn't retrieve the analytics data from the system right now.",
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_summary_raw: { error: "Failed to fetch data from Legal API" }
                }
            }
        };
    }
}
