import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import PathSearchWorker from "../workers/pathSearch.worker?worker&inline";
import type { PathSearchInput } from "./pathSearch";
import {
  PathSearchController,
  type PathSearchState,
} from "./pathSearchController";

const INITIAL_STATE: PathSearchState = {
  status: "not-run",
  result: null,
  error: null,
};

export type UsePathSearchResult = PathSearchState & {
  run: (input: PathSearchInput) => void;
  cancel: () => void;
  reset: () => void;
};

export function usePathSearch(): UsePathSearchResult {
  const [state, setState] =
    useState<PathSearchState>(INITIAL_STATE);
  const controllerRef =
    useRef<PathSearchController | null>(null);

  useEffect(() => {
    const controller = new PathSearchController(
      () => new PathSearchWorker(),
      setState,
    );

    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const run = useCallback((input: PathSearchInput) => {
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
