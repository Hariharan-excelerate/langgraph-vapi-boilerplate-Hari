import { END } from "@langchain/langgraph";
import { generateAnalyticsSynthesis, generateActiveCasesSynthesis, generateGenericSynthesis } from "../llm.js";
import type { GraphState } from "../state.js";

const NODE = "synthesizer";

export async function synthesizer(state: GraphState): Promise<Partial<GraphState>> {
    const inner = state.metadata?.state;
    const outputMode = inner?.output_mode ?? "voiceText";
    const analyticsData = inner?.analytics_summary_raw;

    // Check if we have analytics data to process
    if (analyticsData) {
        // HANDLE MISSING CONTEXT (CLARIFICATION)
        if (analyticsData.missing_context) {
            const clarification = "I can help with that. Could you please specify which specific year or time period you're interested in?";
            return {
                assistantResponse: clarification,
                metadata: {
                    ...state.metadata,
                    state: {
                        ...inner,
                        voice_output: clarification,
                        text_output: clarification,
                    }
                }
            };
        }

        const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
        const userContent = lastUser?.content ?? "";
        const range = inner?.analytics_time_range ?? null;

        const synthesis = await generateAnalyticsSynthesis(userContent, analyticsData, range);

        // Choose the final assistantResponse based on mode (default to voice for Vapi)
        let finalResponse = synthesis.voice_output;
        if (outputMode === "text") finalResponse = synthesis.text_output;

        return {
            assistantResponse: finalResponse,
            metadata: {
                ...state.metadata,
                state: {
                    ...inner,
                    voice_output: synthesis.voice_output,
                    text_output: synthesis.text_output,
                }
            }
        };
    }

    const activeCasesData = inner?.active_cases_raw;
    if (activeCasesData) {
        const lastUser = [...(state.messages ?? [])].reverse().find((m) => m.role === "user");
        const userContent = lastUser?.content ?? "";
        const range = inner?.analytics_time_range ?? null;

        const synthesis = await generateActiveCasesSynthesis(userContent, activeCasesData, range);

        let finalResponse = synthesis.voice_output;
        if (outputMode === "text") finalResponse = synthesis.text_output;

        return {
            assistantResponse: finalResponse,
            metadata: {
                ...state.metadata,
                state: {
                    ...inner,
                    voice_output: synthesis.voice_output,
                    text_output: synthesis.text_output,
                    // Clear raw data? Same logic as analytics.
                }
            }
        };
    }

    // Generic synthesis (for thanks_end, polite_rejection, etc.)
    // They populate state.assistantResponse
    const genericResponse = state.assistantResponse;

    if (!genericResponse) {
        // Should not happen ideally
        return {};
    }

    const synthesis = await generateGenericSynthesis(genericResponse, outputMode);

    return {
        assistantResponse: synthesis.voice_output, // Default for voice channel
        metadata: {
            ...state.metadata,
            state: {
                ...inner,
                voice_output: synthesis.voice_output,
                text_output: synthesis.text_output
            }
        }
    };
}
