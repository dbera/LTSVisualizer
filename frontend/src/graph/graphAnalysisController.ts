import type { GraphAnalysisInput, GraphAnalysisResult } from "./graphAnalysis";
import {
  createGraphAnalysisWorkerRequest,
  isGraphAnalysisWorkerResponse,
  type GraphAnalysisWorkerResponse,
} from "./graphAnalysisWorker";

export type GraphAnalysisStatus =
  | "not-run"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type GraphAnalysisState = {
  status: GraphAnalysisStatus;
  result: GraphAnalysisResult | null;
  error: string | null;
};

export type GraphAnalysisWorkerLike = {
  postMessage: (message: unknown) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type GraphAnalysisWorkerFactory =
  () => GraphAnalysisWorkerLike;

export type GraphAnalysisStateListener = (
  state: GraphAnalysisState,
) => void;

const INITIAL_STATE: GraphAnalysisState = {
  status: "not-run",
  result: null,
  error: null,
};

export class GraphAnalysisController {
  private state: GraphAnalysisState = INITIAL_STATE;
  private worker: GraphAnalysisWorkerLike | null = null;
  private activeRequestId: string | null = null;
  private nextRequestNumber = 1;
  private disposed = false;

  private readonly createWorker: GraphAnalysisWorkerFactory;
  private readonly onStateChange: GraphAnalysisStateListener;

  public constructor(
    createWorker: GraphAnalysisWorkerFactory,
    onStateChange: GraphAnalysisStateListener,
  ) {
    this.createWorker = createWorker;
    this.onStateChange = onStateChange;
  }

  public getState(): GraphAnalysisState {
    return this.state;
  }

  public run(input: GraphAnalysisInput): void {
    if (this.disposed) {
      return;
    }

    this.terminateWorker();

    const requestId = `graph-analysis-${this.nextRequestNumber}`;
    this.nextRequestNumber += 1;

    const worker = this.createWorker();
    this.worker = worker;
    this.activeRequestId = requestId;

    worker.onmessage = (event: MessageEvent<unknown>) => {
      this.handleWorkerMessage(requestId, event.data);
    };

    worker.onerror = (event: ErrorEvent) => {
      this.handleWorkerError(
        requestId,
        event.message || "Graph analysis worker failed.",
      );
    };

    this.setState({
      status: "running",
      result: null,
      error: null,
    });

    worker.postMessage(
      createGraphAnalysisWorkerRequest(requestId, input),
    );
  }

  public cancel(): void {
    if (this.disposed || this.state.status !== "running") {
      return;
    }

    this.terminateWorker();
    this.setState({
      status: "cancelled",
      result: null,
      error: null,
    });
  }

  public reset(): void {
    if (this.disposed) {
      return;
    }

    this.terminateWorker();
    this.setState(INITIAL_STATE);
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.terminateWorker();
    this.disposed = true;
  }

  private handleWorkerMessage(
    expectedRequestId: string,
    value: unknown,
  ): void {
    if (
      this.disposed ||
      expectedRequestId !== this.activeRequestId ||
      !isGraphAnalysisWorkerResponse(value) ||
      value.requestId !== this.activeRequestId
    ) {
      return;
    }

    this.terminateWorker();

    if (value.type === "success") {
      this.setState({
        status: "completed",
        result: value.result,
        error: null,
      });
      return;
    }

    this.setState({
      status: "failed",
      result: null,
      error: value.error,
    });
  }

  private handleWorkerError(
    expectedRequestId: string,
    error: string,
  ): void {
    if (
      this.disposed ||
      expectedRequestId !== this.activeRequestId
    ) {
      return;
    }

    this.terminateWorker();
    this.setState({
      status: "failed",
      result: null,
      error,
    });
  }

  private terminateWorker(): void {
    if (this.worker !== null) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.terminate();
    }

    this.worker = null;
    this.activeRequestId = null;
  }

  private setState(state: GraphAnalysisState): void {
    this.state = state;
    this.onStateChange(state);
  }
}

export function isWorkerResponseForRequest(
  response: GraphAnalysisWorkerResponse,
  requestId: string,
): boolean {
  return response.requestId === requestId;
}
