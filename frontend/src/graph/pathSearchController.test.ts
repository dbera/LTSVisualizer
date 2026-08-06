import { describe, expect, it } from "vitest";

import type {
  PathSearchInput,
  PathSearchResult,
} from "./pathSearch";
import {
  PathSearchController,
  type PathSearchState,
  type PathSearchWorkerLike,
} from "./pathSearchController";

class FakeWorker implements PathSearchWorkerLike {
  public postedMessages: unknown[] = [];
  public terminateCount = 0;
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;

  public postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  public terminate(): void {
    this.terminateCount += 1;
  }

  public respond(value: unknown): void {
    this.onmessage?.({ data: value } as MessageEvent<unknown>);
  }

  public fail(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

const INPUT: PathSearchInput = {
  nodeIds: ["A", "B"],
  edges: [
    {
      id: "ab",
      source: "A",
      target: "B",
    },
  ],
  sourceNodeId: "A",
  targetNodeId: "B",
  requestedPathCount: 5,
  maximumVisitsPerState: 1,
  constraints: {},
};

const RESULT: PathSearchResult = {
  paths: [
    {
      startNodeId: "A",
      edgeIds: ["ab"],
    },
  ],
  exhausted: true,
  resourceLimitReached: false,
  cancelled: false,
  stopReason: "exhausted",
  expandedCandidateCount: 2,
  peakQueuedCandidateCount: 1,
};

function setup() {
  const workers: FakeWorker[] = [];
  const states: PathSearchState[] = [];
  const controller = new PathSearchController(
    () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
    (state) => states.push(state),
  );

  return { controller, workers, states };
}

function getRequestId(worker: FakeWorker): string {
  const request = worker.postedMessages[0] as {
    requestId: string;
  };

  return request.requestId;
}

describe("PathSearchController", () => {
  it("starts a search and posts a typed request", () => {
    const { controller, workers, states } = setup();

    controller.run(INPUT);

    expect(workers).toHaveLength(1);
    expect(states).toEqual([
      {
        status: "running",
        result: null,
        error: null,
      },
    ]);
    expect(workers[0].postedMessages).toEqual([
      {
        type: "search",
        requestId: "path-search-1",
        input: INPUT,
      },
    ]);
  });

  it("stores a successful result and terminates the worker", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    workers[0].respond({
      type: "success",
      requestId: getRequestId(workers[0]),
      result: RESULT,
    });

    expect(controller.getState()).toEqual({
      status: "completed",
      result: RESULT,
      error: null,
    });
    expect(workers[0].terminateCount).toBe(1);
  });

  it("stores a worker error response", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    workers[0].respond({
      type: "error",
      requestId: getRequestId(workers[0]),
      error: "Search failed.",
    });

    expect(controller.getState()).toEqual({
      status: "failed",
      result: null,
      error: "Search failed.",
    });
  });

  it("stores a worker runtime error", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    workers[0].fail("Worker crashed.");

    expect(controller.getState()).toEqual({
      status: "failed",
      result: null,
      error: "Worker crashed.",
    });
  });

  it("cancels a running search", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    controller.cancel();

    expect(controller.getState()).toEqual({
      status: "cancelled",
      result: null,
      error: null,
    });
    expect(workers[0].terminateCount).toBe(1);
  });

  it("ignores cancellation when no search is running", () => {
    const { controller, workers, states } = setup();

    controller.cancel();

    expect(workers).toEqual([]);
    expect(states).toEqual([]);
    expect(controller.getState().status).toBe("not-run");
  });

  it("terminates the previous worker when search runs again", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    controller.run(INPUT);

    expect(workers).toHaveLength(2);
    expect(workers[0].terminateCount).toBe(1);
    expect(workers[1].postedMessages[0]).toMatchObject({
      requestId: "path-search-2",
    });
  });

  it("ignores a stale response from an earlier request", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    const firstWorker = workers[0];
    const firstRequestId = getRequestId(firstWorker);

    controller.run(INPUT);
    const secondWorker = workers[1];
    const secondRequestId = getRequestId(secondWorker);

    firstWorker.respond({
      type: "success",
      requestId: firstRequestId,
      result: RESULT,
    });

    expect(controller.getState().status).toBe("running");

    secondWorker.respond({
      type: "success",
      requestId: secondRequestId,
      result: RESULT,
    });

    expect(controller.getState().status).toBe("completed");
  });

  it("ignores malformed worker responses", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    workers[0].respond({ type: "success" });

    expect(controller.getState().status).toBe("running");
    expect(workers[0].terminateCount).toBe(0);
  });

  it("resets state and terminates active work", () => {
    const { controller, workers } = setup();

    controller.run(INPUT);
    controller.reset();

    expect(controller.getState()).toEqual({
      status: "not-run",
      result: null,
      error: null,
    });
    expect(workers[0].terminateCount).toBe(1);
  });

  it("disposes active work and ignores future searches", () => {
    const { controller, workers, states } = setup();

    controller.run(INPUT);
    controller.dispose();
    controller.run(INPUT);

    expect(workers).toHaveLength(1);
    expect(workers[0].terminateCount).toBe(1);
    expect(states).toHaveLength(1);
  });
});
