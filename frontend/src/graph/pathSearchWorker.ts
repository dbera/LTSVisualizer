import type {
  PathSearchInput,
  PathSearchResult,
} from "./pathSearch";

export type PathSearchWorkerRequest = {
  type: "search";
  requestId: string;
  input: PathSearchInput;
};

export type PathSearchWorkerSuccessResponse = {
  type: "success";
  requestId: string;
  result: PathSearchResult;
};

export type PathSearchWorkerErrorResponse = {
  type: "error";
  requestId: string;
  error: string;
};

export type PathSearchWorkerResponse =
  | PathSearchWorkerSuccessResponse
  | PathSearchWorkerErrorResponse;

export function createPathSearchWorkerRequest(
  requestId: string,
  input: PathSearchInput,
): PathSearchWorkerRequest {
  return {
    type: "search",
    requestId,
    input,
  };
}

export function isPathSearchWorkerResponse(
  value: unknown,
): value is PathSearchWorkerResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (typeof candidate.requestId !== "string") {
    return false;
  }

  if (candidate.type === "error") {
    return typeof candidate.error === "string";
  }

  if (candidate.type === "success") {
    return isPathSearchResult(candidate.result);
  }

  return false;
}

function isPathSearchResult(
  value: unknown,
): value is PathSearchResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    Array.isArray(candidate.paths) &&
    typeof candidate.exhausted === "boolean" &&
    typeof candidate.resourceLimitReached === "boolean" &&
    typeof candidate.cancelled === "boolean" &&
    isStopReason(candidate.stopReason) &&
    typeof candidate.expandedCandidateCount === "number" &&
    typeof candidate.peakQueuedCandidateCount === "number"
  );
}

function isStopReason(value: unknown): boolean {
  return (
    value === "requested-count-reached" ||
    value === "exhausted" ||
    value === "resource-limit-reached" ||
    value === "cancelled"
  );
}
