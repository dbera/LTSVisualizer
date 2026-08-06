import { findKShortestBoundedPaths } from "../graph/pathSearch";
import type {
  PathSearchWorkerErrorResponse,
  PathSearchWorkerRequest,
  PathSearchWorkerResponse,
  PathSearchWorkerSuccessResponse,
} from "../graph/pathSearchWorker";

type PathSearchWorkerScope = {
  addEventListener: (
    type: "message",
    listener: (
      event: MessageEvent<PathSearchWorkerRequest>,
    ) => void,
  ) => void;
  postMessage: (response: PathSearchWorkerResponse) => void;
};

const workerScope =
  globalThis as unknown as PathSearchWorkerScope;

workerScope.addEventListener(
  "message",
  (event: MessageEvent<PathSearchWorkerRequest>): void => {
    const request = event.data;

    if (request.type !== "search") {
      return;
    }

    try {
      const response: PathSearchWorkerSuccessResponse = {
        type: "success",
        requestId: request.requestId,
        result: findKShortestBoundedPaths(request.input),
      };

      workerScope.postMessage(response);
    } catch (error: unknown) {
      const response: PathSearchWorkerErrorResponse = {
        type: "error",
        requestId: request.requestId,
        error: getErrorMessage(error),
      };

      workerScope.postMessage(response);
    }
  },
);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "Path search failed for an unknown reason.";
}

export {};
