import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import AnalysisWorker from "../workers/graphAnalysis.worker?worker&inline";
import type {
  GraphAnalysisInput,
} from "./graphAnalysis";
import {
  GraphAnalysisController,
  type GraphAnalysisState,
} from "./graphAnalysisController";

const INITIAL_STATE: GraphAnalysisState = {
  status: "not-run",
  result: null,
  error: null,
};

export type UseGraphAnalysisResult = GraphAnalysisState & {
  run: (input: GraphAnalysisInput) => void;
  cancel: () => void;
  reset: () => void;
};

export function useGraphAnalysis(): UseGraphAnalysisResult {
  const [state, setState] =
    useState<GraphAnalysisState>(INITIAL_STATE);
  const controllerRef =
    useRef<GraphAnalysisController | null>(null);

  useEffect(() => {
    const controller = new GraphAnalysisController(
      () => new AnalysisWorker(),
      setState,
    );

    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const run = useCallback((input: GraphAnalysisInput) => {
    controllerRef.current?.run(input);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.reset();
  }, []);

  return {
    ...state,
    run,
    cancel,
    reset,
  };
}
