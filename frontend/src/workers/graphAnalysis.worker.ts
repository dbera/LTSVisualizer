import { analyzeGraph } from "../graph/graphAnalysis";
import type {
  GraphAnalysisWorkerErrorResponse,
  GraphAnalysisWorkerRequest,
  GraphAnalysisWorkerResponse,
  GraphAnalysisWorkerSuccessResponse,
} from "../graph/graphAnalysisWorker";

type GraphAnalysisWorkerScope = {
  addEventListener: (
    type: "message",
    listener: (
      event: MessageEvent<GraphAnalysisWorkerRequest>,
    ) => void,
  ) => void;

  postMessage: (
    response: GraphAnalysisWorkerResponse,
  ) => void;
};

const workerScope =
  globalThis as unknown as GraphAnalysisWorkerScope;

workerScope.addEventListener(
  "message",
  (
    event: MessageEvent<GraphAnalysisWorkerRequest>,
  ): void => {
    const request = event.data;

    if (request.type !== "analyze") {
      return;
    }

    try {
      const response:
        GraphAnalysisWorkerSuccessResponse = {
          type: "success",
          requestId: request.requestId,
          result: analyzeGraph(request.input),
        };

      workerScope.postMessage(response);
    } catch (error: unknown) {
      const response:
        GraphAnalysisWorkerErrorResponse = {
          type: "error",
          requestId: request.requestId,
          error: getErrorMessage(error),
        };

      workerScope.postMessage(response);
    }
  },
);

function getErrorMessage(error: unknown): string {
  if (
    error instanceof Error &&
    error.message.length > 0
  ) {
    return error.message;
  }

  return "Graph analysis failed for an unknown reason.";
}

export {};
