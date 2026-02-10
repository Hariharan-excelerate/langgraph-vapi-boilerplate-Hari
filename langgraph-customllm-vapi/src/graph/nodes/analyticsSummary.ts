import { getAnalyticsSummary } from "../../apiClient.js";
import { extractAnalyticsDateRange } from "../llm.js";
import type { GraphState } from "../state.js";

const NODE = "analytics_summary";

export async function analyticsSummary(state: GraphState): Promise<Partial<GraphState>> {
    const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
    const userContent = lastUser?.content ?? "";

    // Use previous range if available, or current date if not
    const now = new Date().toISOString().split("T")[0];
    const previousRange = state.metadata?.state?.analytics_time_range;

    // Extract date range using LLM
    let range = await extractAnalyticsDateRange(userContent, now);

    // If no new range extracted but we have a previous one and user implies continuation, reuse it.
    // For simplicity, we default to "this year" (handled by prompt) if not specified.
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
        const response = await getAnalyticsSummary({
            startDate: range.from,
            endDate: range.to
        });

        return {
            assistantResponse: "", // Synthesizer will fill this
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_time_range: range,
                    analytics_summary_raw: response.data,
                    // Clear previous outputs
                    voice_output: null,
                    text_output: null
                }
            }
        };
    } catch (error) {
        console.error("Analytics API failed:", error);
        return {
            assistantResponse: "I'm sorry, I couldn't access the analytics data at this time.",
            metadata: {
                ...state.metadata,
                state: {
                    ...state.metadata.state,
                    analytics_summary_raw: { error: "Failed to fetch data" }
                }
            }
        };
    }
}
