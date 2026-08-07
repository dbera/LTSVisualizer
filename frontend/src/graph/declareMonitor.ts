import type { DeclareTransition } from "./declarePredicates";

export type MonitorStatus = {
  viable: boolean;
  accepting: boolean;
};

export interface DeclareMonitor<State> {
  initialState(): State;
  advance(state: State, edge: DeclareTransition): State;
  status(state: State): MonitorStatus;
  stateKey(state: State): string;
}

export type MonitorSetEntry<State = unknown> = {
  id: string;
  monitor: DeclareMonitor<State>;
  state: State;
};

export type MonitorSetStatus = MonitorStatus & {
  rejectedConstraintIds: string[];
  pendingConstraintIds: string[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }

  return value;
}

export function canonicalMonitorStateKey(state: unknown): string {
  return JSON.stringify(canonicalize(state));
}

export function createMonitorSet(
  monitors: readonly { id: string; monitor: DeclareMonitor<unknown> }[],
): MonitorSetEntry[] {
  return monitors.map(({ id, monitor }) => ({
    id,
    monitor,
    state: monitor.initialState(),
  }));
}

export function advanceMonitorSet(
  entries: readonly MonitorSetEntry[],
  edge: DeclareTransition,
): MonitorSetEntry[] {
  return entries.map((entry) => ({
    ...entry,
    state: entry.monitor.advance(entry.state, edge),
  }));
}

export function getMonitorSetStatus(
  entries: readonly MonitorSetEntry[],
): MonitorSetStatus {
  const rejectedConstraintIds: string[] = [];
  const pendingConstraintIds: string[] = [];

  entries.forEach((entry) => {
    const status = entry.monitor.status(entry.state);
    if (!status.viable) {
      rejectedConstraintIds.push(entry.id);
    } else if (!status.accepting) {
      pendingConstraintIds.push(entry.id);
    }
  });

  return {
    viable: rejectedConstraintIds.length === 0,
    accepting:
      rejectedConstraintIds.length === 0 && pendingConstraintIds.length === 0,
    rejectedConstraintIds,
    pendingConstraintIds,
  };
}

export function monitorSetStateKey(
  entries: readonly MonitorSetEntry[],
): string {
  return JSON.stringify(
    entries.map((entry) => [entry.id, entry.monitor.stateKey(entry.state)]),
  );
}
