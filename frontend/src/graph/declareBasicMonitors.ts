import type { DeclarePredicateGroup } from "./declareConstraints";
import {
  canonicalMonitorStateKey,
  type DeclareMonitor,
} from "./declareMonitor";
import {
  evaluateDeclarePredicateGroup,
  type DeclareTransition,
} from "./declarePredicates";

type CountState = {
  count: number;
  violated: boolean;
};

type ConsecutiveCountState = CountState & {
  runStarted: boolean;
  runEnded: boolean;
};

type PositionState = {
  seenTransition: boolean;
  matches: boolean;
  violated: boolean;
};

type ChoiceState = {
  seenActivation: boolean;
  seenTarget: boolean;
  violated: boolean;
};

function matches(group: DeclarePredicateGroup, edge: DeclareTransition): boolean {
  return evaluateDeclarePredicateGroup(group, edge).matches;
}

function validateCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Count must be a non-negative integer.");
  }
}

export function createAtLeastMonitor(
  activation: DeclarePredicateGroup,
  minimum: number,
): DeclareMonitor<CountState> {
  validateCount(minimum);
  return {
    initialState: () => ({ count: 0, violated: false }),
    advance: (state, edge) => ({
      count: Math.min(minimum, state.count + (matches(activation, edge) ? 1 : 0)),
      violated: state.violated,
    }),
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.count >= minimum,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createAtMostMonitor(
  activation: DeclarePredicateGroup,
  maximum: number,
): DeclareMonitor<CountState> {
  validateCount(maximum);
  return {
    initialState: () => ({ count: 0, violated: false }),
    advance: (state, edge) => {
      if (state.violated || !matches(activation, edge)) {
        return state;
      }
      const count = state.count + 1;
      return { count, violated: count > maximum };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createExactlyMonitor(
  activation: DeclarePredicateGroup,
  expected: number,
): DeclareMonitor<CountState> {
  validateCount(expected);
  return {
    initialState: () => ({ count: 0, violated: false }),
    advance: (state, edge) => {
      if (state.violated || !matches(activation, edge)) {
        return state;
      }
      const count = state.count + 1;
      return { count, violated: count > expected };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.count === expected,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createExactlyConsecutiveMonitor(
  activation: DeclarePredicateGroup,
  expected: number,
): DeclareMonitor<ConsecutiveCountState> {
  validateCount(expected);
  return {
    initialState: () => ({
      count: 0,
      runStarted: false,
      runEnded: false,
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }
      const isActivation = matches(activation, edge);
      if (isActivation) {
        if (state.runEnded || expected === 0) {
          return { ...state, violated: true };
        }
        const count = state.count + 1;
        return {
          count,
          runStarted: true,
          runEnded: false,
          violated: count > expected,
        };
      }
      return state.runStarted
        ? { ...state, runEnded: true }
        : state;
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: !state.violated && state.count === expected,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createInitMonitor(
  activation: DeclarePredicateGroup,
): DeclareMonitor<PositionState> {
  return {
    initialState: () => ({
      seenTransition: false,
      matches: false,
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.seenTransition) {
        return state;
      }
      const firstMatches = matches(activation, edge);
      return {
        seenTransition: true,
        matches: firstMatches,
        violated: !firstMatches,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting: state.seenTransition && state.matches && !state.violated,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createEndMonitor(
  activation: DeclarePredicateGroup,
): DeclareMonitor<PositionState> {
  return {
    initialState: () => ({
      seenTransition: false,
      matches: false,
      violated: false,
    }),
    advance: (_state, edge) => ({
      seenTransition: true,
      matches: matches(activation, edge),
      violated: false,
    }),
    status: (state) => ({
      viable: true,
      accepting: state.seenTransition && state.matches,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createChoiceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
): DeclareMonitor<ChoiceState> {
  return {
    initialState: () => ({
      seenActivation: false,
      seenTarget: false,
      violated: false,
    }),
    advance: (state, edge) => ({
      seenActivation: state.seenActivation || matches(activation, edge),
      seenTarget: state.seenTarget || matches(target, edge),
      violated: state.violated,
    }),
    status: (state) => ({
      viable: !state.violated,
      accepting:
        !state.violated && (state.seenActivation || state.seenTarget),
    }),
    stateKey: canonicalMonitorStateKey,
  };
}

export function createExclusiveChoiceMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
): DeclareMonitor<ChoiceState> {
  return {
    initialState: () => ({
      seenActivation: false,
      seenTarget: false,
      violated: false,
    }),
    advance: (state, edge) => {
      if (state.violated) {
        return state;
      }
      const seenActivation = state.seenActivation || matches(activation, edge);
      const seenTarget = state.seenTarget || matches(target, edge);
      return {
        seenActivation,
        seenTarget,
        violated: seenActivation && seenTarget,
      };
    },
    status: (state) => ({
      viable: !state.violated,
      accepting:
        !state.violated && state.seenActivation !== state.seenTarget,
    }),
    stateKey: canonicalMonitorStateKey,
  };
}
