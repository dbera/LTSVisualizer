import type {
  PathSearchInput,
  PathSearchResult,
} from "./pathSearch";
import {
  createPathSearchWorkerRequest,
  isPathSearchWorkerResponse,
} from "./pathSearchWorker";

export type PathSearchStatus =
  | "not-run"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type PathSearchState = {
  status: PathSearchStatus;
  result: PathSearchResult | null;
  error: string | null;
};

export type PathSearchWorkerLike = {
  postMessage: (message: unknown) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type PathSearchWorkerFactory =
  () => PathSearchWorkerLike;

export type PathSearchStateListener = (
  state: PathSearchState,
) => void;

const INITIAL_STATE: PathSearchState = {
  status: "not-run",
  result: null,
  error: null,
};

export class PathSearchController {
  private state: PathSearchState = INITIAL_STATE;
  private worker: PathSearchWorkerLike | null = null;
  private activeRequestId: string | null = null;
  private nextRequestNumber = 1;
  private disposed = false;

  private readonly createWorker: PathSearchWorkerFactory;
  private readonly onStateChange: PathSearchStateListener;

  public constructor(
    createWorker: PathSearchWorkerFactory,
    onStateChange: PathSearchStateListener,
  ) {
    this.createWorker = createWorker;
    this.onStateChange = onStateChange;
  }

  public getState(): PathSearchState {
    return this.state;
  }

  public run(input: PathSearchInput): void {
    if (this.disposed) {
      return;
    }

    this.terminateWorker();

    const requestId = `path-search-${this.nextRequestNumber}`;
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
        event.message || "Path search worker failed.",
      );
    };

    this.setState({
      status: "running",
      result: null,
      error: null,
    });

    worker.postMessage(
      createPathSearchWorkerRequest(requestId, input),
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
      !isPathSearchWorkerResponse(value) ||
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

  private setState(state: PathSearchState): void {
    this.state = state;
    this.onStateChange(state);
  }
}
