import type {
  GraphAnalysisInput,
  GraphAnalysisResult,
} from "./graphAnalysis";

export type GraphAnalysisWorkerRequest = {
  type: "analyze";
  requestId: string;
  input: GraphAnalysisInput;
};

export type GraphAnalysisWorkerSuccessResponse = {
  type: "success";
  requestId: string;
  result: GraphAnalysisResult;
};

export type GraphAnalysisWorkerErrorResponse = {
  type: "error";
  requestId: string;
  error: string;
};

export type GraphAnalysisWorkerResponse =
  | GraphAnalysisWorkerSuccessResponse
  | GraphAnalysisWorkerErrorResponse;

export function createGraphAnalysisWorkerRequest(
  requestId: string,
  input: GraphAnalysisInput,
): GraphAnalysisWorkerRequest {
  return {
    type: "analyze",
    requestId,
    input,
  };
}

export function isGraphAnalysisWorkerResponse(
  value: unknown,
): value is GraphAnalysisWorkerResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.requestId !== "string") {
    return false;
  }

  if (candidate.type === "success") {
    return isGraphAnalysisResult(candidate.result);
  }

  if (candidate.type === "error") {
    return typeof candidate.error === "string";
  }

  return false;
}

function isGraphAnalysisResult(
  value: unknown,
): value is GraphAnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.terminalNodeIds) &&
    Array.isArray(candidate.components) &&
    Array.isArray(candidate.cyclicComponents) &&
    typeof candidate.statesInCyclicComponents === "number" &&
    typeof candidate.largestCyclicComponentSize === "number"
  );
}
