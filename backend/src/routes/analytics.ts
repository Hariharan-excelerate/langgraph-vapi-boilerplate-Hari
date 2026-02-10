import { Router } from "express";
import { logger } from "../logger";

const router = Router();

const LEGAL_API_URL = process.env.LEGAL_API_URL || "http://localhost:3000";

router.get("/summary", async (req, res) => {
  const { startDate, endDate } = req.query;
  logger.info(`Fetching analytics summary for range: ${startDate} to ${endDate}`);

  // Mock data as fallback
  const mockData = {
    caseValue: {
      avg_case_value: "$25,000",
      total_fee: "$3,850,000",
      case_count: "154"
    },
    PipelineValue: {
      total_conservative_attorney_fee: "$1,200,000",
      total_llf_attorney_fee: "$4,500,000"
    },
    caseValues: [
      {
        projected_actual_value: "$50,000",
        projected_future_value: "$75,000",
        case_phase: "Litigation"
      },
      {
        projected_actual_value: "$10,000",
        projected_future_value: "$15,000",
        case_phase: "Pre-Litigation"
      }
    ],
    litigationValue: {
      projected_actual_value: "$2,000,000",
      projected_future_value: "$3,500,000",
      count: "45"
    },
    SettlementValue: {
      projected_actual_value: "$1,500,000",
      projected_future_value: "$1,800,000",
      count: "30"
    },
    prospectCount: "12",
    matterCount: "8",
    demandCount: "5",
    activeCasesCount: 154,
    activeCasesByPhase: {
      "Investigation": 20,
      "Medical Treatment": 50,
      "Negotiation": 40,
      "Litigation": 44
    },
    casePhases: {
      "1": "Investigation",
      "2": "Medical Treatment",
      "3": "Negotiation",
      "4": "Litigation"
    },
    treatmentLevels: {
      "1": "Conservative",
      "2": "Surgical"
    }
  };

  try {
    const targetUrl = `${LEGAL_API_URL}/v1/api/analytics/summary?startDate=${startDate}&endDate=${endDate}`;
    logger.info(`Proxying analytics request to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.LEGAL_API_KEY || ""}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      logger.warn(`External API returned ${response.status} ${response.statusText}. Falling back to mock data.`);
      throw new Error(`External API Error: ${response.status}`);
    }

    const externalData = await response.json() as any;
    logger.info("Successfully fetched data from external API");

    // Check if the external data has the specific 'data' wrapper or is the raw object
    // Adjusting based on common API patterns, but assuming it matches our mock structure
    const finalData = externalData.data || externalData;

    res.json({
      success: true,
      data: finalData,
      filters: { startDate, endDate },
      timestamp: new Date().toISOString(),
      source: "external-api"
    });

  } catch (error) {
    logger.error(`Failed to fetch from external API (${LEGAL_API_URL}): ${error}. Using fallback mock data.`);

    res.json({
      success: true,
      data: mockData,
      filters: { startDate, endDate },
      timestamp: new Date().toISOString(),
      source: "mock-fallback"
    });
  }
});

router.get("/active-cases", async (req, res) => {
  const { startDate, endDate, page = "1", limit = "100" } = req.query;
  logger.info(`Fetching active cases for range: ${startDate} to ${endDate}`);

  // Mock data as fallback
  const mockData = {
    success: true,
    data: [], // Mock empty for now as fallback
    pagination: {
      page: 1,
      limit: 100,
      hasMore: false,
      totalCount: 0
    },
    timestamp: new Date().toISOString()
  };

  try {
    const targetUrl = `${LEGAL_API_URL}/v1/api/analytics/active-cases?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${limit}`;
    logger.info(`Proxying active-cases request to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      headers: {
        "Authorization": `Bearer ${process.env.LEGAL_API_KEY || ""}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      logger.warn(`External API returned ${response.status} ${response.statusText}. Falling back to mock data.`);
      throw new Error(`External API Error: ${response.status}`);
    }

    const externalData = await response.json() as any;
    logger.info("Successfully fetched active cases from external API");

    res.json(externalData);

  } catch (error) {
    logger.error(`Failed to fetch active cases from external API (${LEGAL_API_URL}): ${error}. Using fallback mock data.`);
    res.json(mockData);
  }
});

export default router;
