import { activeCases } from "./graph/nodes/activeCases.js";
import { getClient, getDefaultModel } from "./graph/llm.js";
import { getIntentClassifierSystem, buildIntentClassifierUserMessage } from "./prompts/repository.js";
import { GraphState } from "./graph/state.js";

async function run() {
    console.log("--- DEBUGGING ACTIVE CASES FLOW ---");

    const userMessage = "give me information about top 3 cases";

    // 1. Test Intent Classification
    console.log(`\n1. Testing Intent for: "${userMessage}"`);
    const classifierSystem = getIntentClassifierSystem();
    // buildIntentClassifierUserMessage requires (conversationSnippet, lastUserText, contextSuffix)
    const classifierUser = buildIntentClassifierUserMessage("", userMessage, "");

    const client = getClient();
    const completion = await client.chat.completions.create({
        model: getDefaultModel(),
        messages: [
            { role: "system", content: classifierSystem },
            { role: "user", content: classifierUser },
        ],
        temperature: 0,
    });

    const intent = completion.choices[0].message?.content?.trim();
    console.log(`DETECTED INTENT: ${intent}`);

    // 2. Test Active Cases Node
    console.log("\n2. Testing Active Cases Node Data Fetch...");
    // Mock State
    const mockState: GraphState = {
        messages: [{ role: "user", content: userMessage }],
        metadata: {
            state: {}
        }
    } as any;

    try {
        const result = await activeCases(mockState);

        // Check if data is present
        const data = result.metadata?.state?.active_cases_raw;
        if (!data || (data as any).error) {
            console.error("DATA FETCH FAILURE:", data);
            if ((data as any)?.error) console.error("Error details:", (data as any).error);
        } else {
            console.log("Data fetched successfully.");
            const items = (data as any).data;
            console.log("Count:", items?.length);
            if (items?.length > 0) {
                console.log("First item sample:", JSON.stringify(items[0], null, 2));
            }
        }

        // Check Date Range extraction
        if (result.metadata?.state?.analytics_time_range) {
            console.log("Extracted Date Range:", result.metadata.state.analytics_time_range);
        } else {
            console.log("No Date Range Extracted (using default?)");
        }

    } catch (error) {
        console.error("Active Cases Node threw error:", error);
    }
}

run();
