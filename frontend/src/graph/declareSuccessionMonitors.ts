import type { DeclarePredicateGroup } from "./declareConstraints";
import {
  canonicalMonitorStateKey,
  type DeclareMonitor,
} from "./declareMonitor";
import type { DeclareTransition } from "./declarePredicates";
import {
  createAlternatePrecedenceMonitor,
  createChainPrecedenceMonitor,
  createNotChainPrecedenceMonitor,
  createNotPrecedenceMonitor,
  createPrecedenceMonitor,
} from "./declarePrecedenceMonitors";
import {
  createAlternateResponseMonitor,
  createChainResponseMonitor,
  createNotChainResponseMonitor,
  createNotResponseMonitor,
  createResponseMonitor,
} from "./declareResponseMonitors";
import type { CorrelationCondition } from "./transitionCorrelation";

export type CompositeMonitorState = {
  left: unknown;
  right: unknown;
};

function composeMonitors(
  left: DeclareMonitor<unknown>,
  right: DeclareMonitor<unknown>,
): DeclareMonitor<CompositeMonitorState> {
  return {
    initialState: () => ({
      left: left.initialState(),
      right: right.initialState(),
    }),
    advance: (state, edge: DeclareTransition) => ({
      left: left.advance(state.left, edge),
      right: right.advance(state.right, edge),
    }),
    status: (state) => {
      const leftStatus = left.status(state.left);
      const rightStatus = right.status(state.right);
      return {
        viable: leftStatus.viable && rightStatus.viable,
        accepting: leftStatus.accepting && rightStatus.accepting,
      };
    },
    stateKey: canonicalMonitorStateKey,
  };
}

export function createSuccessionMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CompositeMonitorState> {
  return composeMonitors(
    createResponseMonitor(activation, target, correlation),
    createPrecedenceMonitor(activation, target, correlation),
  );
}

export function createNotSuccessionMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CompositeMonitorState> {
  return composeMonitors(
    createNotResponseMonitor(activation, target, correlation),
    createNotPrecedenceMonitor(activation, target, correlation),
  );
}

export function createChainSuccessionMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CompositeMonitorState> {
  return composeMonitors(
    createChainResponseMonitor(activation, target, correlation),
    createChainPrecedenceMonitor(activation, target, correlation),
  );
}

export function createNotChainSuccessionMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CompositeMonitorState> {
  return composeMonitors(
    createNotChainResponseMonitor(activation, target, correlation),
    createNotChainPrecedenceMonitor(activation, target, correlation),
  );
}

export function createAlternateSuccessionMonitor(
  activation: DeclarePredicateGroup,
  target: DeclarePredicateGroup,
  correlation?: CorrelationCondition,
): DeclareMonitor<CompositeMonitorState> {
  return composeMonitors(
    createAlternateResponseMonitor(activation, target, correlation),
    createAlternatePrecedenceMonitor(activation, target, correlation),
  );
}
