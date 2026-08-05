import "./PathSelectionControls.css";

export type PathSelectionMode = "idle" | "select-start" | "select-edges";
export interface PathCandidateTransition {
  id: string;
  transition: string;
  target: string;
}
interface PathSelectionControlsProps {
  graphLoaded: boolean;
  mode: PathSelectionMode;
  startNodeId: string | null;
  endNodeId: string | null;
  edgeCount: number;
  candidates: PathCandidateTransition[];
  onStart: () => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
  onSelectCandidate: (edgeId: string) => void;
}
export default function PathSelectionControls({
  graphLoaded, mode, startNodeId, endNodeId, edgeCount, candidates,
  onStart, onUndo, onClear, onExport, onSelectCandidate,
}: PathSelectionControlsProps) {
  const active = mode !== "idle";
  const stateCount = startNodeId ? edgeCount + 1 : 0;
  return (
    <div className={`path-controls ${active ? "path-controls-active" : ""}`}>
      <div className="path-controls-main">
        <span className="path-controls-label">Path</span>
        <button type="button" className={active ? "active" : ""} onClick={onStart} disabled={!graphLoaded}>
          {active ? "Restart path" : "Select path"}
        </button>
        <button type="button" onClick={onUndo} disabled={!startNodeId || edgeCount === 0}>Undo</button>
        <button type="button" onClick={onClear} disabled={!active && !startNodeId}>Clear path</button>
        <button type="button" className="path-export-button" onClick={onExport} disabled={!startNodeId}>Export .puml</button>
        {active && <span className="path-summary" aria-live="polite">
          {mode === "select-start" ? "Select a start state" : `${stateCount} state${stateCount === 1 ? "" : "s"}, ${edgeCount} transition${edgeCount === 1 ? "" : "s"}${endNodeId ? `, at ${endNodeId}` : ""}`}
        </span>}
      </div>
      {mode === "select-edges" && <div className="path-candidates" aria-label="Choose next transition">
        <span className="path-candidates-label">Choose next transition</span>
        {candidates.length ? <div className="path-candidate-list">
          {candidates.map((candidate, index) => <button
            key={candidate.id} type="button" className="path-candidate-button"
            onClick={() => onSelectCandidate(candidate.id)}
            title={`${candidate.transition} to state ${candidate.target}`}>
            <span className="path-candidate-number">{index + 1}</span>
            <span className="path-candidate-transition">{candidate.transition}</span>
            <span className="path-candidate-target">→ {candidate.target}</span>
          </button>)}
        </div> : <span className="path-no-candidates">No outgoing transitions</span>}
      </div>}
    </div>
  );
}
