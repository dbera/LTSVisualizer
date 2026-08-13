import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import cytoscape from "cytoscape";
import "./App.css";
import "./CorrelationExplanation.css";
import JsonViewer, { type JsonValue } from "./components/JsonViewer";
import DeclareConstraintBuilder from "./graph/DeclareConstraintBuilder";
import type { DeclareConstraint } from "./graph/declareConstraints";
import { validateExecutableDeclareConstraint } from "./graph/declareMonitorFactory";
import PathSelectionControls, {
  type PathSelectionMode,
} from "./components/PathSelectionControls";
import {
  downloadPlantUmlPath,
  serializePathToPlantUml,
} from "./graph/pathExport";
import {
  extendPath,
  getCandidateEdges,
  resolvePath,
  startPath,
  undoPath,
  type SelectedPath,
} from "./graph/pathSelection";
import {
  createGraphJsonDocument,
  createSelectedPathJsonDocument,
  parseGraphJsonText,
  serializeGraphJson,
  type PersistedPathSearchConfiguration,
} from "./graph/graphJson";
import { useGraphAnalysis } from "./graph/useGraphAnalysis";
import { usePathSearch } from "./graph/usePathSearch";
import type { BoundedPath, ConstraintExplanationEvent, PathSearchStrategy } from "./graph/pathSearch";
import type { StronglyConnectedComponent } from "./graph/graphAnalysis";
import { buildTransitionCatalogue } from "./graph/transitionCatalog";
import { buildTransitionDataCatalogue } from "./graph/transitionDataCatalogue";
import {
  SIDE_PANEL_COLLAPSED_STORAGE_KEY,
  SIDE_PANEL_WIDTH_STORAGE_KEY,
  clampSidePanelWidth,
  getKeyboardResizedSidePanelWidth,
  getSidePanelMaximumWidth,
  parseStoredSidePanelCollapsed,
  parseStoredSidePanelWidth,
} from "./ui/sidePanelState";

interface GraphNode {
  id: string;
  marking_raw: string | null;
  marking: Record<string, unknown[]> | null;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  transition: string;
  color: string | null;
  inputs_raw: string | null;
  inputs: Record<string, unknown> | null;
  outputs_raw: string | null;
  outputs: Record<string, unknown[]> | null;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

type OverviewLayout = "hierarchical" | "grid";
type SidePanelMode = "inspector" | "analysis" | "paths";

interface InspectorInfo {
  type: "node" | "edge";
  title: string;
  subtitle?: string;
  data: JsonValue;
}
interface GraphViewSnapshot {
  nodeIds: string[];
  edgeIds: string[];
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
  showingAll: boolean;
  selectedStateId: string | null;
  searchText: string;
  hopCount: number;
  overviewLayout: OverviewLayout;
}

const TERMINAL_PAGE_SIZE = 100;
const SCC_PAGE_SIZE = 100;
function formatCorrelationEvidenceValue(value: unknown, found: boolean): string {
  if (!found) return "<not found>";
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}

function readStoredSidePanelWidth(): number {
  return parseStoredSidePanelWidth(
    window.localStorage.getItem(SIDE_PANEL_WIDTH_STORAGE_KEY),
    window.innerWidth,
  );
}

function App() {
  const graphContainer = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const graphRef = useRef<GraphData | null>(null);
  const pinnedInspectorRef = useRef<InspectorInfo | null>(null);
  const pathModeRef = useRef<PathSelectionMode>("idle");
  const selectedPathRef = useRef<SelectedPath | null>(null);
  const showPathContextRef = useRef<(path: SelectedPath) => void>(() => {});
  const addEdgeToPathRef = useRef<(edgeId: string) => void>(() => {});
  const graphViewBeforeComputedPathRef = useRef<GraphViewSnapshot | null>(null);

  const [status, setStatus] = useState("Select an LTS graph file to begin");
  const [fileName, setFileName] = useState("");
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [hopCount, setHopCount] = useState(1);
  const [showingAll, setShowingAll] = useState(false);
  const [showTransitionLabels, setShowTransitionLabels] = useState(true);
  const [overviewLayout, setOverviewLayout] =
    useState<OverviewLayout>("hierarchical");
  const [inspectorInfo, setInspectorInfo] = useState<InspectorInfo | null>(null);
  const [pinnedInspector, setPinnedInspector] = useState<InspectorInfo | null>(null);
  const [pathMode, setPathMode] = useState<PathSelectionMode>("idle");
  const [selectedPath, setSelectedPath] = useState<SelectedPath | null>(null);
  const [sidePanelMode, setSidePanelMode] =
    useState<SidePanelMode>("inspector");
  const [sidePanelWidth, setSidePanelWidth] = useState(readStoredSidePanelWidth);
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState(
    () => parseStoredSidePanelCollapsed(
      window.localStorage.getItem(SIDE_PANEL_COLLAPSED_STORAGE_KEY),
    ),
  );
  const graphAnalysis = useGraphAnalysis();
  const pathSearch = usePathSearch();
  const [pathSearchSource, setPathSearchSource] = useState("");
  const [pathSearchTarget, setPathSearchTarget] = useState("");
  const [requestedPathCount, setRequestedPathCount] = useState(5);
  const [pathSearchStrategy, setPathSearchStrategy] = useState<PathSearchStrategy>("shortest");
  const [maximumVisitsPerState, setMaximumVisitsPerState] = useState(1);
  const [requireConstraintExercise, setRequireConstraintExercise] = useState(true);
  const [declareConstraints, setDeclareConstraints] = useState<DeclareConstraint[]>([]);
  const [shownSearchPathIndex, setShownSearchPathIndex] = useState<number | null>(null);
  const [computedPathViewActive, setComputedPathViewActive] = useState(false);
  const [focusedComputedStepKey, setFocusedComputedStepKey] = useState<string | null>(null);
  const [terminalStatesExpanded, setTerminalStatesExpanded] =
    useState(false);
  const [terminalStateFilter, setTerminalStateFilter] = useState("");
  const [terminalStatePage, setTerminalStatePage] = useState(0);
  const [cyclicComponentsExpanded, setCyclicComponentsExpanded] =
    useState(false);
  const [minimumCyclicComponentSize, setMinimumCyclicComponentSize] =
    useState(1);
  const [cyclicComponentPage, setCyclicComponentPage] = useState(0);
  const [selectedCyclicComponentId, setSelectedCyclicComponentId] =
    useState<number | null>(null);

  function beginSidePanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (isSidePanelCollapsed || event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidePanelWidth;
    document.body.classList.add("resizing-side-panel");

    const handlePointerMove = (pointerEvent: globalThis.PointerEvent) => {
      setSidePanelWidth(
        clampSidePanelWidth(
          startWidth + startX - pointerEvent.clientX,
          window.innerWidth,
        ),
      );
    };
    const finishResize = () => {
      document.body.classList.remove("resizing-side-panel");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      window.requestAnimationFrame(() => cyRef.current?.resize());
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
  }

  function resizeSidePanelWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const nextWidth = getKeyboardResizedSidePanelWidth(
      sidePanelWidth,
      event.key,
      event.shiftKey,
      window.innerWidth,
    );
    if (nextWidth === null) return;
    event.preventDefault();
    setSidePanelWidth(nextWidth);
  }

  function toggleSidePanel() {
    setIsSidePanelCollapsed((collapsed) => !collapsed);
  }

  function updatePathMode(mode: PathSelectionMode) {
    pathModeRef.current = mode;
    setPathMode(mode);
  }

  function updateSelectedPath(path: SelectedPath | null) {
    selectedPathRef.current = path;
    setSelectedPath(path);
  }

  function invalidatePathSearchResults() {
    if (pathSearch.status !== "not-run") {
      pathSearch.reset();
      setShownSearchPathIndex(null);
      setFocusedComputedStepKey(null);
      setComputedPathViewActive(false);
    }
  }

  function changeDeclareConstraints(constraints: DeclareConstraint[]) {
    invalidatePathSearchResults();
    setDeclareConstraints(constraints);
  }

  function makeNodeInspector(node: cytoscape.NodeSingular): InspectorInfo {
    const marking = node.data("marking") as JsonValue | null | undefined;

    return {
      type: "node",
      title: `State ${node.id()}`,
      subtitle: "Marking",
      data: marking ?? "No marking data available",
    };
  }

  function makeEdgeInspector(edge: cytoscape.EdgeSingular): InspectorInfo {
    const inputs = edge.data("inputs") as JsonValue | null | undefined;
    const inputsRaw = edge.data("inputs_raw") as string | null | undefined;
    const outputs = edge.data("outputs") as JsonValue | null | undefined;
    const outputsRaw = edge.data("outputs_raw") as string | null | undefined;

    return {
      type: "edge",
      title: edge.data("transition") ?? "Transition",
      subtitle: `${edge.source().id()} -> ${edge.target().id()}`,
      data: {
        inputs: inputs ?? "No transition input data available",
        inputs_raw: inputsRaw ?? "No raw transition input data available",
        outputs: outputs ?? "No transition output data available",
        outputs_raw: outputsRaw ?? "No raw transition output data available",
      },
    };
  }

  function buildElements(
    graph: GraphData,
    visibleNodeIds: Set<string>,
    visibleEdges: GraphEdge[],
    showLabels: boolean
  ): cytoscape.ElementDefinition[] {
    const visibleNodes = graph.nodes.filter((node) =>
      visibleNodeIds.has(node.id)
    );
    const parallelEdgeGroups = new Map<string, GraphEdge[]>();

    for (const edge of graph.edges) {
      const key = `${edge.source}\u0000${edge.target}`;
      const group = parallelEdgeGroups.get(key) ?? [];
      group.push(edge);
      parallelEdgeGroups.set(key, group);
    }

    function getControlPointDistance(edge: GraphEdge): number {
      const key = `${edge.source}\u0000${edge.target}`;
      const group = parallelEdgeGroups.get(key) ?? [edge];

      if (group.length <= 1 || edge.source === edge.target) {
        return 0;
      }

      const position = group.findIndex((candidate) => candidate.id === edge.id);
      return (position - (group.length - 1) / 2) * 56;
    }

    return [
      ...visibleNodes.map((node) => ({
        data: {
          id: node.id,
          label: node.id,
          marking: node.marking,
        },
        grabbable: true,
        selectable: true,
        locked: false,
      })),
      ...visibleEdges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: showLabels ? edge.transition : "",
          transition: edge.transition,
          inputs: edge.inputs,
          inputs_raw: edge.inputs_raw,
          outputs: edge.outputs,
          outputs_raw: edge.outputs_raw,
          lineColor:
            edge.color === "darkorange" ? "#f59e0b" : "#64748b",
          controlPointDistance: getControlPointDistance(edge),
        },
      })),
    ];
  }

  function replaceVisibleGraph(
    elements: cytoscape.ElementDefinition[],
    layoutName: "breadthfirst" | "grid"
  ) {
    const cy = cyRef.current;

    if (!cy) {
      setStatus("The graph viewer is not ready. Refresh the page and try again.");
      return;
    }

    cy.startBatch();
    cy.elements().remove();
    cy.add(elements);
    cy.nodes().unlock();
    cy.nodes().grabify();
    cy.endBatch();

    if (layoutName === "breadthfirst") {
      cy.layout({
        name: "breadthfirst",
        directed: true,
        fit: false,
        padding: 60,
        spacingFactor: 1.8,
        circle: false,
        grid: false,
      }).run();
    } else {
      cy.layout({
        name: "grid",
        fit: false,
        padding: 60,
        avoidOverlap: true,
        avoidOverlapPadding: 16,
        condense: false,
        cols: Math.ceil(Math.sqrt(elements.length)),
      }).run();
    }

    // Keep a natural, readable scale. The user can pan and zoom freely.
    cy.zoom(0.85);
    cy.pan({ x: 90, y: 90 });
  }

  function applyPathClasses(path: SelectedPath | null) {
    const cy = cyRef.current;
    const graph = graphRef.current;
    if (!cy) return;

    cy.elements().removeClass(
      "path-node path-edge path-start path-end path-next-edge path-next-node path-dimmed"
    );
    if (!path || !graph) return;

    const resolvedPath = resolvePath(graph, path);
    const nodeIds = resolvedPath.nodeIds;
    const endNodeId = resolvedPath.endNodeId;
    const selectedEdgeIds = new Set(path.edgeIds);

    cy.elements().addClass("path-dimmed");
    nodeIds.forEach((nodeId) => {
      cy.getElementById(nodeId).removeClass("path-dimmed").addClass("path-node");
    });
    path.edgeIds.forEach((edgeId) => {
      const selectedEdge = cy.getElementById(edgeId);
      selectedEdge
        .removeClass("path-dimmed")
        .addClass("path-edge")
        .data("label", selectedEdge.data("transition") ?? "");
    });
    cy.getElementById(path.startNodeId).addClass("path-start");
    cy.getElementById(endNodeId).addClass("path-end");

    cy.elements().unselect();

    getCandidateEdges(graph, path)
      .filter((edge) => !selectedEdgeIds.has(edge.id))
      .forEach((edge) => {
        cy.getElementById(edge.id)
          .removeClass("path-dimmed")
          .addClass("path-next-edge")
          .data("label", edge.transition);
        cy.getElementById(edge.target)
          .removeClass("path-dimmed")
          .addClass("path-next-node");
      });
  }

  function showPathContext(
    path: SelectedPath,
    positionCompletePath = false,
  ) {
    const graph = graphRef.current;
    const cy = cyRef.current;
    if (!graph || !cy) return;

    const resolvedPath = resolvePath(graph, path);
    const selectedEdges = resolvedPath.edges;
    const pathNodeIds = resolvedPath.nodeIds;
    const uniquePathNodeIds = [...new Set(pathNodeIds)];
    const pathNodeIdSet = new Set(uniquePathNodeIds);
    const endNodeId = resolvedPath.endNodeId;
    const outgoingEdges = getCandidateEdges(graph, path);
    const requiredNodeIds = new Set<string>(uniquePathNodeIds);
    const requiredEdgeIds = new Set<string>([
      ...path.edgeIds,
      ...outgoingEdges.map((edge) => edge.id),
    ]);

    outgoingEdges.forEach((edge) => requiredNodeIds.add(edge.target));

    // Remove stale alternatives from earlier path steps. Keep only the selected
    // path and the valid choices from the current endpoint.
    cy.startBatch();
    cy.edges()
      .filter((edge) => !requiredEdgeIds.has(edge.id()))
      .remove();
    cy.nodes()
      .filter((node) => !requiredNodeIds.has(node.id()))
      .remove();
    cy.endBatch();

    const missingPathNodeIds = uniquePathNodeIds.filter(
      (nodeId) => cy.getElementById(nodeId).empty(),
    );
    const missingCandidateNodeIds = [
      ...new Set(outgoingEdges.map((edge) => edge.target)),
    ].filter(
      (nodeId) =>
        !pathNodeIdSet.has(nodeId) && cy.getElementById(nodeId).empty(),
    );
    const missingNodeIds = new Set([
      ...missingPathNodeIds,
      ...missingCandidateNodeIds,
    ]);
    const missingEdges = [...selectedEdges, ...outgoingEdges].filter(
      (edge) => cy.getElementById(edge.id).empty(),
    );

    const firstVisiblePathNode = uniquePathNodeIds
      .map((nodeId) => cy.getElementById(nodeId))
      .find((node) => node.nonempty());
    const pathOrigin = firstVisiblePathNode?.position() ?? { x: 160, y: 160 };

    cy.startBatch();

    if (missingNodeIds.size > 0) {
      cy.add(
        buildElements(
          graph,
          missingNodeIds,
          [],
          showTransitionLabels,
        ),
      );

      if (positionCompletePath) {
        // Computed paths can contain many nodes that were not part of the
        // previous neighborhood. Give those path nodes deterministic,
        // non-overlapping positions in traversal order. Existing visible path
        // nodes retain their coordinates, preserving the user's orientation.
        const columnCount = Math.max(
          1,
          Math.ceil(Math.sqrt(uniquePathNodeIds.length)),
        );
        const horizontalSpacing = 230;
        const verticalSpacing = 155;

        missingPathNodeIds.forEach((nodeId) => {
          const pathIndex = uniquePathNodeIds.indexOf(nodeId);
          const row = Math.floor(pathIndex / columnCount);
          const positionInRow = pathIndex % columnCount;
          const column =
            row % 2 === 0
              ? positionInRow
              : columnCount - positionInRow - 1;

          cy.getElementById(nodeId).position({
            x: pathOrigin.x + column * horizontalSpacing,
            y: pathOrigin.y + row * verticalSpacing,
          });
        });
      }

      const endpoint = cy.getElementById(endNodeId);
      const endpointPosition = endpoint.nonempty()
        ? endpoint.position()
        : pathOrigin;

      missingCandidateNodeIds.forEach((nodeId, index) => {
        const verticalOffset =
          index - (Math.max(missingCandidateNodeIds.length, 1) - 1) / 2;
        cy.getElementById(nodeId).position({
          x: endpointPosition.x + 230,
          y: endpointPosition.y + verticalOffset * 135,
        });
      });

      // Preserve the original manual path-selection behavior. During manual
      // extension only successor candidates are normally missing.
      if (!positionCompletePath) {
        const targetNodeIds = [
          ...new Set(outgoingEdges.map((edge) => edge.target)),
        ];

        missingPathNodeIds.forEach((nodeId) => {
          const targetIndex = Math.max(0, targetNodeIds.indexOf(nodeId));
          const verticalOffset =
            targetIndex - (Math.max(targetNodeIds.length, 1) - 1) / 2;
          cy.getElementById(nodeId).position({
            x: endpointPosition.x + 230,
            y: endpointPosition.y + verticalOffset * 135,
          });
        });
      }
    }

    if (missingEdges.length > 0) {
      cy.add(buildElements(graph, new Set<string>(), missingEdges, true));
    }

    cy.nodes().unlock();
    cy.nodes().grabify();
    cy.endBatch();
    setShowingAll(false);
    setSelectedStateId(endNodeId);
    setSearchText(endNodeId);
    applyPathClasses(path);
  }

  function startPathSelection() {
    const graph = graphRef.current;
    if (!graph) {
      setStatus("Open a graph before selecting a path");
      return;
    }

    setSelectedCyclicComponentId(null);
    const requestedStateId = selectedStateId ?? searchText.trim();
    const startStateId = graph.nodes.some((node) => node.id === requestedStateId)
      ? requestedStateId
      : null;

    if (selectedCyclicComponentId !== null && startStateId) {
      setSelectedCyclicComponentId(null);
      showNeighborhood(startStateId, hopCount);
    }

    cyRef.current?.elements().removeClass(
      "path-node path-edge path-start path-end path-next-edge path-next-node path-dimmed"
    );

    if (!startStateId) {
      updateSelectedPath(null);
      updatePathMode("select-start");
      setStatus(
        "Path selection: search for a state first, or click a visible state to use it as the start"
      );
      return;
    }

    const path = startPath(graph, startStateId);
    updateSelectedPath(path);
    updatePathMode("select-edges");
    cyRef.current?.edges().forEach((edge) => {
      edge.data("label", edge.data("transition") ?? "");
    });
    applyPathClasses(path);
    setStatus(
      `Path selection started at state ${startStateId}. Select a highlighted transition or cyan target state.`
    );
  }

  function addEdgeToPath(edgeId: string) {
    const graph = graphRef.current;
    const path = selectedPathRef.current;
    if (!graph || !path) return;

    try {
      const nextPath = extendPath(graph, path, edgeId);
      const resolvedPath = resolvePath(graph, nextPath);
      updateSelectedPath(nextPath);
      showPathContext(nextPath);
      setStatus(
        `Path selection: ${resolvedPath.stateCount} states and ${resolvedPath.transitionCount} transitions. Select a highlighted transition or cyan target state from state ${resolvedPath.endNodeId}.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not extend the selected path"
      );
    }
  }

  showPathContextRef.current = showPathContext;
  addEdgeToPathRef.current = addEdgeToPath;

  function undoPathStep() {
    const path = selectedPathRef.current;
    if (!path || path.edgeIds.length === 0) return;
    const nextPath = undoPath(path);
    updateSelectedPath(nextPath);
    showPathContext(nextPath);
    setStatus("Removed the last path transition");
  }

  function clearPathSelection() {
    const previousPath = selectedPathRef.current;
    updateSelectedPath(null);
    updatePathMode("idle");
    cyRef.current?.elements().removeClass(
      "path-node path-edge path-start path-end path-next-edge path-next-node path-dimmed"
    );
    const stateId = selectedStateId ?? previousPath?.startNodeId;
    if (stateId && graphRef.current?.nodes.some((node) => node.id === stateId)) {
      showNeighborhood(stateId, hopCount);
    } else {
      setStatus("Path selection cleared");
    }
  }

  function downloadTextFile(
    content: string,
    fileName: string,
    mimeType: string
  ) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getPersistedPathSearchConfiguration(): PersistedPathSearchConfiguration {
    const sourceNodeId = pathSearchSource.trim();
    const targetNodeId = pathSearchTarget.trim();
    return {
      sourceNodeId,
      strategy: pathSearchStrategy,
      endpointMode: targetNodeId
        ? "specific-target"
        : "constraint-satisfaction",
      ...(targetNodeId ? { targetNodeId } : {}),
      // requestedPathCount: pathSearchStrategy === "any-witness" ? 1 : requestedPathCount,
      requestedPathCount,
      maximumVisitsPerState,
      requireConstraintExercise,
    };
  }
  function exportFullGraphJson() {
    const graph = graphRef.current;
    if (!graph) {
      setStatus("Open an LTS graph before exporting");
      return;
    }

    try {
      const sourceName = fileName.replace(/\.[^.]+$/, "") || "graph";
      const safeName = sourceName
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "graph";
      const document = createGraphJsonDocument(
        graph,
        { title: sourceName },
        declareConstraints,
        getPersistedPathSearchConfiguration(),
      );
      const exportFileName = `${safeName}.json`;

      downloadTextFile(
        serializeGraphJson(document),
        exportFileName,
        "application/json;charset=utf-8"
      );
      setStatus(
        `Exported ${exportFileName}: ${graph.nodes.length} states and ${graph.edges.length} transitions`
      );
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not export the complete graph as JSON"
      );
    }
  }

  function exportSelectedPath() {
    const graph = graphRef.current;
    const path = selectedPathRef.current;
    if (!graph || !path) {
      setStatus("Select a path before exporting");
      return;
    }
    try {
      const exportedPath = serializePathToPlantUml(graph, path);
      downloadPlantUmlPath(exportedPath);
      setStatus(`Exported ${exportedPath.fileName}`);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "Could not export the selected path");
    }
  }

  function exportSelectedPathJson() {
    const graph = graphRef.current;
    const path = selectedPathRef.current;
    if (!graph || !path) {
      setStatus("Select a path before exporting");
      return;
    }

    try {
      const resolved = resolvePath(graph, path);
      const document = createSelectedPathJsonDocument(
        graph,
        path,
        {
          title: `Selected path ${resolved.startNodeId} to ${resolved.endNodeId}`,
        },
        declareConstraints,
      );
      const fileName = `LTSVisualizer-path-${resolved.startNodeId}-to-${resolved.endNodeId}.json`;
      downloadTextFile(
        serializeGraphJson(document),
        fileName,
        "application/json;charset=utf-8"
      );
      setStatus(`Exported ${fileName}`);
    } catch (error) {
      console.error(error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not export the selected path as JSON"
      );
    }
  }

  function leaveComputedPathView() {
    if (!computedPathViewActive) {
      return;
    }

    setShownSearchPathIndex(null);
    setFocusedComputedStepKey(null);
    setComputedPathViewActive(false);
    graphViewBeforeComputedPathRef.current = null;
  }
  function showNeighborhood(
    stateId: string,
    hops: number,
    layout: OverviewLayout = overviewLayout
  ) {
    leaveComputedPathView();
    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    if (!graph.nodes.some((node) => node.id === stateId)) {
      setStatus(`State ${stateId} was not found`);
      return;
    }

    const visibleNodeIds = new Set<string>([stateId]);
    let frontier = new Set<string>([stateId]);

    for (let level = 0; level < hops; level += 1) {
      const nextFrontier = new Set<string>();

      for (const edge of graph.edges) {
        if (frontier.has(edge.source) && !visibleNodeIds.has(edge.target)) {
          visibleNodeIds.add(edge.target);
          nextFrontier.add(edge.target);
        }

        if (frontier.has(edge.target) && !visibleNodeIds.has(edge.source)) {
          visibleNodeIds.add(edge.source);
          nextFrontier.add(edge.source);
        }
      }

      frontier = nextFrontier;

      if (frontier.size === 0) {
        break;
      }
    }

    const visibleEdges = graph.edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    replaceVisibleGraph(
      buildElements(
        graph,
        visibleNodeIds,
        visibleEdges,
        showTransitionLabels
      ),
      layout === "hierarchical" ? "breadthfirst" : "grid"
    );

    setSelectedStateId(stateId);
    setSearchText(stateId);
    setHopCount(hops);
    setShowingAll(false);
    setStatus(
      `State ${stateId}: ${visibleNodeIds.size} states and ${visibleEdges.length} transitions within ${hops} hop${hops === 1 ? "" : "s"}. ${layout === "hierarchical" ? "Hierarchical" : "Grid"} layout.`
    );

    window.setTimeout(() => {
      const cy = cyRef.current;
      const selectedNode = cy?.getElementById(stateId);

      if (selectedNode && selectedNode.nonempty()) {
        cy?.elements().unselect();
        selectedNode.select();
        cy?.animate({
          center: { eles: selectedNode },
          duration: 250,
        });
      }
    }, 0);
  }

  function showAll(layout: OverviewLayout = overviewLayout) {
    leaveComputedPathView();

    const graph = graphRef.current;

    if (!graph) {
      return;
    }

    const allNodeIds = new Set(graph.nodes.map((node) => node.id));
    const layoutName = layout === "hierarchical" ? "breadthfirst" : "grid";

    replaceVisibleGraph(
      buildElements(
        graph,
        allNodeIds,
        graph.edges,
        showTransitionLabels
      ),
      layoutName
    );

    setShowingAll(true);
    setOverviewLayout(layout);
    setStatus(
      `Overview: ${graph.nodes.length} states and ${graph.edges.length} transitions. ${layout === "hierarchical" ? "Hierarchical" : "Grid"} layout; pan and zoom to explore.`
    );
  }

  function toggleTransitionLabels() {
    const nextValue = !showTransitionLabels;
    setShowTransitionLabels(nextValue);

    const cy = cyRef.current;
    if (cy) {
      cy.edges().forEach((edge) => {
        edge.data("label", nextValue ? edge.data("transition") : "");
      });
    }
  }


  function changeOverviewLayout(layout: OverviewLayout) {
    setOverviewLayout(layout);

    if (computedPathViewActive) {
      const cy = cyRef.current;

      if (!cy || cy.elements().empty()) {
        return;
      }

      cy.nodes().unlock();
      cy.nodes().grabify();

      if (layout === "hierarchical") {
        cy.layout({
          name: "breadthfirst",
          directed: true,
          fit: false,
          padding: 60,
          spacingFactor: 1.8,
          circle: false,
          grid: false,
        }).run();
      } else {
        cy.layout({
          name: "grid",
          fit: false,
          padding: 60,
          avoidOverlap: true,
          avoidOverlapPadding: 16,
          condense: false,
          cols: Math.ceil(Math.sqrt(cy.nodes().length)),
        }).run();
      }

      window.requestAnimationFrame(() => {
        cy.resize();
        cy.fit(cy.elements(), 60);
      });

      setStatus(
        `Applied ${
          layout === "hierarchical" ? "hierarchical" : "grid"
        } layout to the displayed computed path`,
      );

      return;
    }

    if (showingAll) {
      showAll(layout);
      return;
    }

    const stateId = selectedStateId ?? searchText.trim();

    if (stateId) {
      showNeighborhood(stateId, hopCount, layout);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const stateId = searchText.trim();

    if (!stateId) {
      setStatus("Enter a state ID, for example 609");
      return;
    }

    showNeighborhood(stateId, hopCount);
  }

  function changeHopCount(hops: number) {
    setHopCount(hops);

    const stateId = selectedStateId ?? searchText.trim();

    if (stateId) {
      showNeighborhood(stateId, hops);
    } else {
      setStatus("Enter a state ID or click a state first");
    }
  }

  function runGraphAnalysis() {
    const graph = graphRef.current;

    if (!graph) {
      setStatus("Open a graph before running analysis");
      return;
    }

    graphAnalysis.run({
      nodeIds: graph.nodes.map((node) => node.id),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
    });
  }

  function runPathSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const graph = graphRef.current;
    const sourceNodeId = pathSearchSource.trim();
    const targetNodeId = pathSearchTarget.trim();
    if (!graph) return;
    if (!graph.nodes.some((node) => node.id === sourceNodeId)) {
      setStatus(`Source state ${sourceNodeId || "(empty)"} was not found`);
      return;
    }
    const enabledConstraints = declareConstraints.filter(
      (constraint) => constraint.enabled,
    );
    if (!targetNodeId && enabledConstraints.length === 0) {
      setStatus(
        "Enter a target state or configure at least one enabled constraint.",
      );
      return;
    }
    if (
      targetNodeId &&
      !graph.nodes.some((node) => node.id === targetNodeId)
    ) {
      setStatus(`Target state ${targetNodeId} was not found`);
      return;
    }
    const constraintErrors = enabledConstraints
      .filter((constraint) => constraint.enabled)
      .flatMap((constraint) =>
        validateExecutableDeclareConstraint(constraint).map(
          (error) => `${constraint.id}: ${error}`,
        ),
      );
    if (constraintErrors.length > 0) {
      setStatus(`Fix the Declare constraints: ${constraintErrors.join(" ")}`);
      return;
    }
    setShownSearchPathIndex(null);
    pathSearch.run({
      nodeIds: graph.nodes.map((node) => node.id),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        transition: edge.transition,
        color: edge.color,
        inputs_raw: edge.inputs_raw,
        inputs: edge.inputs,
        outputs_raw: edge.outputs_raw,
        outputs: edge.outputs,
      })),
      sourceNodeId,
      strategy: pathSearchStrategy,
      ...(targetNodeId
        ? { targetNodeId, endpointMode: "specific-target" as const }
        : { endpointMode: "constraint-satisfaction" as const }),
      // requestedPathCount:
        // pathSearchStrategy === "any-witness" ? 1 : requestedPathCount,
      requestedPathCount,
      maximumVisitsPerState,
      requireConstraintExercise,
      constraints: { declare: declareConstraints },
    });
    // const effectiveRequestedPathCount =
    //   pathSearchStrategy === "any-witness" ? 1 : requestedPathCount;
    setStatus(
      targetNodeId
        ? pathSearchStrategy === "any-witness"
          ? `Searching for up to ${requestedPathCount} witnesses from ${sourceNodeId} to ${targetNodeId} in heuristic discovery order`
          : `Searching for up to ${requestedPathCount} shortest paths from ${sourceNodeId} to ${targetNodeId}`
        : pathSearchStrategy === "any-witness"
          ? `Searching for up to ${requestedPathCount} constraint-satisfying witnesses from ${sourceNodeId} in heuristic discovery order`
          : `Searching for up to ${requestedPathCount} shortest constraint-satisfying paths from ${sourceNodeId}`,
    );
  }

  function captureGraphViewBeforeComputedPath() {
    const cy = cyRef.current;
    if (!cy || graphViewBeforeComputedPathRef.current) return;

    const positions: Record<string, { x: number; y: number }> = {};
    cy.nodes().forEach((node) => {
      positions[node.id()] = { ...node.position() };
    });

    graphViewBeforeComputedPathRef.current = {
      nodeIds: cy.nodes().map((node) => node.id()),
      edgeIds: cy.edges().map((edge) => edge.id()),
      positions,
      zoom: cy.zoom(),
      pan: { ...cy.pan() },
      showingAll,
      selectedStateId,
      searchText,
      hopCount,
      overviewLayout,
    };
  }

  function returnToGraphView() {
    const graph = graphRef.current;
    const cy = cyRef.current;
    const snapshot = graphViewBeforeComputedPathRef.current;
    if (!graph || !cy || !snapshot) return;

    const nodeIds = new Set(snapshot.nodeIds);
    const edgeIds = new Set(snapshot.edgeIds);
    const edges = graph.edges.filter((edge) => edgeIds.has(edge.id));

    cy.startBatch();
    cy.elements().remove();
    cy.add(buildElements(graph, nodeIds, edges, showTransitionLabels));
    cy.nodes().forEach((node) => {
      const position = snapshot.positions[node.id()];
      if (position) node.position(position);
    });
    cy.nodes().unlock();
    cy.nodes().grabify();
    cy.elements().removeClass(
      "path-node path-edge path-start path-end path-next-edge path-next-node path-dimmed"
    );
    cy.endBatch();
    cy.resize();
    cy.zoom(snapshot.zoom);
    cy.pan(snapshot.pan);

    updateSelectedPath(null);
    updatePathMode("idle");
    setShowingAll(snapshot.showingAll);
    setSelectedStateId(snapshot.selectedStateId);
    setSearchText(snapshot.searchText);
    setHopCount(snapshot.hopCount);
    setOverviewLayout(snapshot.overviewLayout);
    setShownSearchPathIndex(null);
    setFocusedComputedStepKey(null);
    setComputedPathViewActive(false);
    graphViewBeforeComputedPathRef.current = null;
    setStatus("Returned to the previous graph view");
  }

  function showComputedPath(path: BoundedPath, index: number) {
    const graph = graphRef.current;
    if (!graph) return;
    const selected: SelectedPath = {
      startNodeId: path.startNodeId,
      edgeIds: path.edgeIds,
    };
    try {
      resolvePath(graph, selected);
      captureGraphViewBeforeComputedPath();
      setSelectedCyclicComponentId(null);
      updateSelectedPath(selected);
      updatePathMode("idle");
      showPathContext(selected, true);
      setShownSearchPathIndex(index);
      setFocusedComputedStepKey(null);
      setComputedPathViewActive(true);
      window.setTimeout(() => {
        const cy = cyRef.current;
        if (cy && cy.elements().nonempty()) {
          cy.animate({
            fit: { eles: cy.elements(), padding: 60 },
            duration: 250,
          });
        }
      }, 0);
      setStatus(`Showing computed path ${index + 1} with ${path.edgeIds.length} transitions`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not display the computed path");
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    graphAnalysis.reset();
    pathSearch.reset();
    setDeclareConstraints([]);
    setShownSearchPathIndex(null);
    setFocusedComputedStepKey(null);
    setComputedPathViewActive(false);
    graphViewBeforeComputedPathRef.current = null;
    setTerminalStatesExpanded(false);
    setTerminalStateFilter("");
    setTerminalStatePage(0);
    setCyclicComponentsExpanded(false);
    setMinimumCyclicComponentSize(1);
    setCyclicComponentPage(0);
    setSelectedCyclicComponentId(null);
    setStatus(`Loading ${file.name}...`);
    setFileName(file.name);
    setInspectorInfo(null);
    setPinnedInspector(null);
    pinnedInspectorRef.current = null;
    updateSelectedPath(null);
    updatePathMode("idle");

    try {
      const parsed = parseGraphJsonText(await file.text());
      const graph: GraphData = parsed.graph;
      const importedPath = parsed.selectedPath;
      setDeclareConstraints(parsed.declareConstraints);

      graphRef.current = graph;
      setGraphLoaded(true);
      setShowTransitionLabels(graph.nodes.length <= 300);

      if (graph.nodes.length === 0) {
        setGraphLoaded(false);
        setStatus("The selected file contains no graph nodes");
        return;
      }

      const defaultPathState = graph.nodes.some((node) => node.id === "0")
        ? "0"
        : graph.nodes[0].id;
      const importedPathSearch = parsed.pathSearch;
      setPathSearchSource(importedPathSearch?.sourceNodeId ?? defaultPathState);
      setPathSearchTarget(importedPathSearch?.targetNodeId ?? "");
      setRequestedPathCount(importedPathSearch?.requestedPathCount ?? 5);
      setPathSearchStrategy(importedPathSearch?.strategy ?? "shortest");
      setMaximumVisitsPerState(
        importedPathSearch?.maximumVisitsPerState ?? 1,
      );
      setRequireConstraintExercise(
        importedPathSearch?.requireConstraintExercise ?? true,
      );

      if (importedPath) {
        const resolved = resolvePath(graph, importedPath);
        const allNodeIds = new Set(graph.nodes.map((node) => node.id));

        updateSelectedPath(null);
        updatePathMode("idle");
        setShowTransitionLabels(true);
        replaceVisibleGraph(
          buildElements(graph, allNodeIds, graph.edges, true),
          "breadthfirst"
        );
        setSelectedStateId(importedPath.startNodeId);
        setSearchText(importedPath.startNodeId);
        setShowingAll(true);
        setOverviewLayout("hierarchical");
        setStatus(
          `Loaded ${file.name} as a regular graph: ${graph.nodes.length} unique states and ${graph.edges.length} unique transitions. The saved traversal contains ${resolved.stateCount} state occurrences and ${resolved.transitionCount} transition steps, ending at state ${resolved.endNodeId}.`
        );
        return;
      }

      const initialState = graph.nodes.some((node) => node.id === "0")
        ? "0"
        : graph.nodes[0].id;

      showNeighborhood(initialState, 1);
      setStatus(
        `Loaded ${file.name}: ${graph.nodes.length} states and ${graph.edges.length} transitions. Showing state ${initialState} and its 1-hop neighborhood.`
      );
    } catch (error) {
      console.error(error);
      setGraphLoaded(false);

      if (error instanceof Error) {
        setStatus(error.message);
      } else {
        setStatus(`Could not load ${file.name}`);
      }
    } finally {
      event.target.value = "";
    }
  }

  useEffect(() => {
    if (!graphContainer.current) {
      return;
    }

    const cy = cytoscape({
      container: graphContainer.current,
      userPanningEnabled: true,
      userZoomingEnabled: true,
      autoungrabify: false,
      autounselectify: false,
      boxSelectionEnabled: false,
      elements: [],
      layout: { name: "preset" },
      minZoom: 0.05,
      maxZoom: 4,
      wheelSensitivity: 0.55,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#2563eb",
            label: "data(label)",
            color: "#ffffff",
            "font-size": "10px",
            "font-weight": 600,
            "text-valign": "center",
            "text-halign": "center",
            width: "42px",
            height: "42px",
            "border-width": 2,
            "border-color": "#1e3a8a",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "data(lineColor)",
            "target-arrow-color": "data(lineColor)",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.8,
            "curve-style": "unbundled-bezier",
            "control-point-distances": "data(controlPointDistance)",
            "control-point-weights": 0.5,
            label: "data(label)",
            "font-size": "9px",
            color: "#334155",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.92,
            "text-background-padding": "3px",
            "text-rotation": "none",
            "text-wrap": "wrap",
            "text-max-width": "190px",
            "text-margin-x": 12,
          },
        },
        {
          selector: ".path-dimmed",
          style: { opacity: 0.32 },
        },
        {
          selector: "node.path-node",
          style: {
            opacity: 1,
            "overlay-color": "#2563eb",
            "overlay-opacity": 0,
            "background-color": "#2563eb",
            "border-color": "#1d4ed8",
            "border-width": 4,
          },
        },
        {
          selector: "node.path-start",
          style: {
            "background-color": "#16a34a",
            "border-color": "#14532d",
          },
        },
        {
          selector: "node.path-end",
          style: {
            "background-color": "#f59e0b",
            "border-color": "#92400e",
          },
        },
        {
          selector: "node.path-next-node",
          style: {
            opacity: 1,
            width: "56px",
            height: "56px",
            "background-color": "#06b6d4",
            "border-color": "#0e7490",
            "border-width": 4,
          },
        },
        {
          selector: "edge.path-edge",
          style: {
            opacity: 1,
            width: 4,
            "line-color": "#2563eb",
            "target-arrow-color": "#2563eb",
          },
        },
        {
          selector: "edge.path-next-edge",
          style: {
            opacity: 1,
            width: 6,
            "line-color": "#06b6d4",
            "target-arrow-color": "#06b6d4",
            "arrow-scale": 1.05,
          },
        },
        {
          selector: "node:active",
          style: {
            "overlay-color": "#2563eb",
            "overlay-opacity": 0.18,
            "overlay-padding": 8,
          },
        },
        {
          selector: "node:selected",
          style: {
            "background-color": "#16a34a",
            "border-color": "#14532d",
            "border-width": 4,
          },
        },
        {
          selector: "edge:selected",
          style: {
            width: 4,
            "line-color": "#16a34a",
            "target-arrow-color": "#16a34a",
          },
        },
      ],
    });

    cyRef.current = cy;
    cy.autoungrabify(false);
    cy.nodes().unlock();
    cy.nodes().grabify();

    cy.on("mouseover", "node", (event) => {
      if (!pinnedInspectorRef.current) {
        setInspectorInfo(makeNodeInspector(event.target));
      }
    });

    cy.on("mouseover", "edge", (event) => {
      if (!pinnedInspectorRef.current) {
        setInspectorInfo(makeEdgeInspector(event.target));
      }
    });

    cy.on("mouseout", "node, edge", () => {
      if (!pinnedInspectorRef.current) {
        setInspectorInfo(null);
      }
    });

    cy.on("tap", "node", (event) => {
      const node = event.target;
      const stateId = node.id();
      const info = makeNodeInspector(node);

      if (pathModeRef.current === "select-start") {
        const graph = graphRef.current;
        if (!graph) return;
        const path = startPath(graph, stateId);
        updateSelectedPath(path);
        updatePathMode("select-edges");
        cyRef.current?.edges().forEach((edge) => {
          edge.data("label", edge.data("transition") ?? "");
        });
        showPathContextRef.current(path);
        setStatus(
          `Path selection started at state ${stateId}. Select a highlighted transition or target state.`
        );
      } else if (pathModeRef.current === "select-edges") {
        const graph = graphRef.current;
        const path = selectedPathRef.current;

        if (graph && path) {
          const endNodeId = resolvePath(graph, path).endNodeId;
          const matchingEdges = getCandidateEdges(graph, path).filter(
            (edge) => edge.target === stateId
          );

          if (matchingEdges.length === 1) {
            addEdgeToPathRef.current(matchingEdges[0].id);
          } else if (matchingEdges.length > 1) {
            setStatus(
              `${matchingEdges.length} transitions connect state ${endNodeId} to state ${stateId}. Click the desired highlighted transition.`
            );
          } else if (stateId === endNodeId) {
            setStatus(
              `State ${stateId} is the current path endpoint. Select a highlighted transition or cyan target state.`
            );
          } else {
            setStatus(
              `State ${stateId} is not directly reachable from state ${endNodeId}. Select a cyan target state.`
            );
          }
        }
      } else {
        setSelectedStateId(stateId);
        setSearchText(stateId);
      }

      pinnedInspectorRef.current = info;
      setPinnedInspector(info);
      setInspectorInfo(info);
    });

    cy.on("tap", "edge", (event) => {
      const edge = event.target;
      const info = makeEdgeInspector(edge);
      if (pathModeRef.current === "select-edges") {
        addEdgeToPathRef.current(edge.id());
      }
      pinnedInspectorRef.current = info;
      setPinnedInspector(info);
      setInspectorInfo(info);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) {
      return;
    }

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        cy.resize();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [pathMode, selectedPath?.edgeIds.length]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDE_PANEL_WIDTH_STORAGE_KEY,
      String(Math.round(sidePanelWidth)),
    );
  }, [sidePanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(
      SIDE_PANEL_COLLAPSED_STORAGE_KEY,
      String(isSidePanelCollapsed),
    );
    const frame = window.requestAnimationFrame(() => cyRef.current?.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [isSidePanelCollapsed]);

  useEffect(() => {
    const handleWindowResize = () => {
      setSidePanelWidth((current) =>
        clampSidePanelWidth(current, window.innerWidth),
      );
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    const container = graphContainer.current;
    const cy = cyRef.current;
    if (!container || !cy || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      cy.resize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const transitionOptions = buildTransitionCatalogue(
    graphRef.current?.edges.map((edge) => edge.transition) ?? [],
  );
  const transitionDataCatalogue = buildTransitionDataCatalogue(
    graphRef.current?.edges.map((edge) => ({
      transition: edge.transition,
      inputs: edge.inputs,
      outputs: edge.outputs,
    })) ?? [],
  );
  const visibleInspector = pinnedInspector ?? inspectorInfo;
  const selectedPathEdges = selectedPath?.edgeIds ?? [];
  const selectedPathEndNodeId = (() => {
    if (!selectedPath || !graphRef.current) return null;
    return resolvePath(graphRef.current, selectedPath).endNodeId;
  })();
  const pathSelectionActive = pathMode !== "idle";
  const pathCandidateEdges = (() => {
    const graph = graphRef.current;
    if (
      !graph ||
      !selectedPath ||
      pathMode !== "select-edges" ||
      !selectedPathEndNodeId
    ) {
      return [];
    }

    return getCandidateEdges(graph, selectedPath).map((edge) => ({
      id: edge.id,
      transition: edge.transition,
      target: edge.target,
    }));
  })();

  const filteredTerminalNodeIds = (() => {
    const terminalNodeIds = graphAnalysis.result?.terminalNodeIds ?? [];
    const filter = terminalStateFilter.trim().toLocaleLowerCase();

    if (!filter) return terminalNodeIds;

    return terminalNodeIds.filter((nodeId) =>
      nodeId.toLocaleLowerCase().includes(filter)
    );
  })();
  const terminalPageCount = Math.max(
    1,
    Math.ceil(filteredTerminalNodeIds.length / TERMINAL_PAGE_SIZE)
  );
  const safeTerminalStatePage = Math.min(
    terminalStatePage,
    terminalPageCount - 1
  );
  const visibleTerminalNodeIds = filteredTerminalNodeIds.slice(
    safeTerminalStatePage * TERMINAL_PAGE_SIZE,
    (safeTerminalStatePage + 1) * TERMINAL_PAGE_SIZE
  );
  const terminalResultStart =
    filteredTerminalNodeIds.length === 0
      ? 0
      : safeTerminalStatePage * TERMINAL_PAGE_SIZE + 1;
  const terminalResultEnd = Math.min(
    (safeTerminalStatePage + 1) * TERMINAL_PAGE_SIZE,
    filteredTerminalNodeIds.length
  );

  function focusTerminalState(stateId: string) {
    setSelectedCyclicComponentId(null);
    showNeighborhood(stateId, hopCount);
    setStatus(`Focused terminal state ${stateId}`);
  }

  const filteredCyclicComponents =
    graphAnalysis.result?.cyclicComponents.filter(
      (component) => component.nodeIds.length >= minimumCyclicComponentSize
    ) ?? [];
  const cyclicComponentPageCount = Math.max(
    1,
    Math.ceil(filteredCyclicComponents.length / SCC_PAGE_SIZE)
  );
  const safeCyclicComponentPage = Math.min(
    cyclicComponentPage,
    cyclicComponentPageCount - 1
  );
  const visibleCyclicComponents = filteredCyclicComponents.slice(
    safeCyclicComponentPage * SCC_PAGE_SIZE,
    (safeCyclicComponentPage + 1) * SCC_PAGE_SIZE
  );
  const cyclicComponentResultStart =
    filteredCyclicComponents.length === 0
      ? 0
      : safeCyclicComponentPage * SCC_PAGE_SIZE + 1;
  const cyclicComponentResultEnd = Math.min(
    (safeCyclicComponentPage + 1) * SCC_PAGE_SIZE,
    filteredCyclicComponents.length
  );
  const selectedCyclicComponent =
    graphAnalysis.result?.cyclicComponents.find(
      (component) => component.id === selectedCyclicComponentId
    ) ?? null;

  function getCyclicComponentNumber(componentId: number): number {
    const index = graphAnalysis.result?.cyclicComponents.findIndex(
      (component) => component.id === componentId
    ) ?? -1;

    return index >= 0 ? index + 1 : 0;
  }

  function showCyclicComponent(component: StronglyConnectedComponent) {
    const graph = graphRef.current;
    const cy = cyRef.current;
    if (!graph || !cy) return;

    const componentNodeIds = new Set(component.nodeIds);
    const componentEdgeIds = new Set(component.internalEdgeIds);
    const componentEdges = graph.edges.filter(
      (edge) =>
        componentEdgeIds.has(edge.id) &&
        componentNodeIds.has(edge.source) &&
        componentNodeIds.has(edge.target)
    );
    const componentNumber = getCyclicComponentNumber(component.id);

    updateSelectedPath(null);
    updatePathMode("idle");

    // Replace the canvas contents and then defensively remove anything that
    // does not belong to the selected SCC. This guarantees an exact component
    // view even if Cytoscape retained elements from a previous view.
    replaceVisibleGraph(
      buildElements(graph, componentNodeIds, componentEdges, showTransitionLabels),
      overviewLayout === "hierarchical" ? "breadthfirst" : "grid"
    );

    cy.startBatch();
    cy.nodes()
      .filter((node) => !componentNodeIds.has(node.id()))
      .remove();
    cy.edges()
      .filter((edge) => !componentEdgeIds.has(edge.id()))
      .remove();
    cy.elements().removeClass(
      "path-node path-edge path-start path-end path-next-edge path-next-node path-dimmed"
    );
    cy.endBatch();
    cy.resize();

    setSelectedCyclicComponentId(component.id);
    setShowingAll(false);
    setSelectedStateId(component.nodeIds[0] ?? null);
    if (component.nodeIds[0]) setSearchText(component.nodeIds[0]);
    setStatus(
      `Showing cyclic component ${componentNumber}: ${component.nodeIds.length} states and ${component.internalEdgeIds.length} internal transitions.`
    );
  }

  function clearCyclicComponentView() {
    setSelectedCyclicComponentId(null);
    const graph = graphRef.current;
    if (!graph) return;

    const stateId = selectedStateId ?? graph.nodes[0]?.id;
    if (stateId) showNeighborhood(stateId, hopCount);
  }

  function focusComputedPathEdge(edgeId: string, stepKey: string) {
    const cy = cyRef.current;
    const edge = cy?.getElementById(edgeId);
    if (!cy || !edge || edge.empty()) {
      setStatus(`Transition ${edgeId} is not visible. Show the path first.`);
      return;
    }

    cy.elements().unselect();
    edge.select();
    const info = makeEdgeInspector(edge);
    pinnedInspectorRef.current = info;
    setPinnedInspector(info);
    setInspectorInfo(info);
    setFocusedComputedStepKey(stepKey);
    cy.animate({
      center: { eles: edge },
      duration: 250,
    });
    setStatus(`Focused transition ${edge.data("transition") ?? edgeId}`);
  }

  function focusComputedPathNode(nodeId: string, stepKey: string) {
    const cy = cyRef.current;
    const node = cy?.getElementById(nodeId);
    if (!cy || !node || node.empty()) {
      setStatus(`State ${nodeId} is not visible. Show the path first.`);
      return;
    }

    cy.elements().unselect();
    node.select();
    const info = makeNodeInspector(node);
    pinnedInspectorRef.current = info;
    setPinnedInspector(info);
    setInspectorInfo(info);
    setFocusedComputedStepKey(stepKey);
    setSelectedStateId(nodeId);
    setSearchText(nodeId);
    cy.animate({
      center: { eles: node },
      duration: 250,
    });
    setStatus(`Focused state ${nodeId}`);
  }

  function focusExplanationEvent(
    explanationEvent: ConstraintExplanationEvent,
    pathIndex: number,
  ) {
    focusComputedPathEdge(
      explanationEvent.edgeId,
      `explanation-${pathIndex}-${explanationEvent.stepNumber}-${explanationEvent.edgeId}`,
    );
  }
  function getComputedPathSteps(path: BoundedPath) {
    const graph = graphRef.current;
    if (!graph) return [];

    try {
      return resolvePath(graph, {
        startNodeId: path.startNodeId,
        edgeIds: path.edgeIds,
      }).edges.map((edge, index) => ({
        index,
        id: edge.id,
        source: edge.source,
        target: edge.target,
        transition: edge.transition,
      }));
    } catch {
      return [];
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div className="title-block">
          <h1>Reachability Graph Dashboard</h1>
          <p>{status}</p>
          {fileName && <span className="file-name">{fileName}</span>}
        </div>

        <div className="header-actions">
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            className="file-input"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInput.current?.click()}
          >
            Open LTS Graph File
          </button>
        </div>
      </header>

      <section className="toolbar" aria-label="Graph controls">
        <form className="search-form" onSubmit={handleSearch}>
          <label htmlFor="state-search">State ID</label>
          <input
            id="state-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="e.g. 609"
            disabled={!graphLoaded || pathSelectionActive}
          />
          <button type="submit" disabled={!graphLoaded || pathSelectionActive}>
            Show state
          </button>
        </form>

        <div className="hop-controls">
          <span>Neighborhood</span>
          {[1, 2, 3].map((hops) => (
            <button
              key={hops}
              type="button"
              className={!showingAll && hopCount === hops ? "active" : ""}
              onClick={() => changeHopCount(hops)}
              disabled={!graphLoaded || pathSelectionActive}
            >
              {hops} hop{hops === 1 ? "" : "s"}
            </button>
          ))}
        </div>

        <div className="layout-controls">
          <span>Layout</span>
          <button
            type="button"
            className={overviewLayout === "hierarchical" ? "active" : ""}
            onClick={() => changeOverviewLayout("hierarchical")}
            disabled={!graphLoaded || pathSelectionActive}
          >
            Hierarchical
          </button>
          <button
            type="button"
            className={overviewLayout === "grid" ? "active" : ""}
            onClick={() => changeOverviewLayout("grid")}
            disabled={!graphLoaded || pathSelectionActive}
          >
            Grid
          </button>
        </div>

        <button
          type="button"
          className={showTransitionLabels ? "active" : ""}
          onClick={toggleTransitionLabels}
          disabled={!graphLoaded || pathSelectionActive}
        >
          {showTransitionLabels ? "Hide labels" : "Show labels"}
        </button>

        <button
          type="button"
          className={showingAll ? "active" : ""}
          onClick={() => showAll()}
          disabled={!graphLoaded || pathSelectionActive}
        >
          Show all
        </button>

        <button
          type="button"
          onClick={exportFullGraphJson}
          disabled={!graphLoaded}
          title="Export every node and transition in the loaded graph"
        >
          Export graph JSON
        </button>

        <PathSelectionControls
          graphLoaded={graphLoaded}
          mode={pathMode}
          startNodeId={selectedPath?.startNodeId ?? null}
          endNodeId={selectedPathEndNodeId}
          edgeCount={selectedPathEdges.length}
          onStart={startPathSelection}
          onUndo={undoPathStep}
          onClear={clearPathSelection}
          onExport={exportSelectedPath}
          onExportJson={exportSelectedPathJson}
          candidates={pathCandidateEdges}
          onSelectCandidate={addEdgeToPath}
        />
      </section>

      <section
        className={`workspace${isSidePanelCollapsed ? " side-panel-collapsed" : ""}`}
        style={
          {
            "--side-panel-width": `${sidePanelWidth}px`,
          } as CSSProperties
        }
      >
        <div className="graph-panel">
          {!graphLoaded && (
            <div className="empty-overlay">
              <h2>No graph loaded</h2>
              <p>Open an LTSVisualizer JSON graph file to begin.</p>
            </div>
          )}
          <div ref={graphContainer} className="graph-container" />
        </div>

        {!isSidePanelCollapsed && (
          <div
            className="side-panel-resizer"
            role="separator"
            aria-label="Resize side panel"
            aria-orientation="vertical"
            aria-valuemin={380}
            aria-valuemax={getSidePanelMaximumWidth(window.innerWidth)}
            aria-valuenow={Math.round(sidePanelWidth)}
            tabIndex={0}
            onPointerDown={beginSidePanelResize}
            onKeyDown={resizeSidePanelWithKeyboard}
            title="Drag to resize. Use arrow keys when focused."
          />
        )}
        <aside className="inspector" aria-label="Graph tools">
          <div className="side-panel-shell-header">
            {!isSidePanelCollapsed && (
              <span className="side-panel-shell-title">Graph tools</span>
            )}
            <button
              type="button"
              className={
                isSidePanelCollapsed
                  ? "side-panel-expand-button"
                  : "side-panel-collapse-button"
              }
              onClick={toggleSidePanel}
              aria-label={
                isSidePanelCollapsed ? "Expand side panel" : "Collapse side panel"
              }
              aria-expanded={!isSidePanelCollapsed}
              title={
                isSidePanelCollapsed ? "Expand side panel" : "Collapse side panel"
              }
            >
              <span aria-hidden="true">{isSidePanelCollapsed ? "<" : ">"}</span>
            </button>
          </div>
          {!isSidePanelCollapsed && (
            <div className="side-panel-content">
          <div className="side-panel-tabs" role="tablist" aria-label="Side panel">
            <button
              type="button"
              role="tab"
              aria-selected={sidePanelMode === "inspector"}
              className={sidePanelMode === "inspector" ? "active" : ""}
              onClick={() => setSidePanelMode("inspector")}
            >
              Inspector
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePanelMode === "analysis"}
              className={sidePanelMode === "analysis" ? "active" : ""}
              onClick={() => setSidePanelMode("analysis")}
            >
              Analysis
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidePanelMode === "paths"}
              className={sidePanelMode === "paths" ? "active" : ""}
              onClick={() => setSidePanelMode("paths")}
            >
              Paths
            </button>
          </div>

          {sidePanelMode === "inspector" ? (
            <>
              <div className="inspector-heading">
                <div>
                  <span className="eyebrow">Inspector</span>
                  <h2>{visibleInspector?.title ?? "Nothing selected"}</h2>
                </div>
                {pinnedInspector && (
                  <button
                    type="button"
                    className="clear-button"
                    onClick={() => {
                      pinnedInspectorRef.current = null;
                      setPinnedInspector(null);
                      setInspectorInfo(null);
                      cyRef.current?.elements().unselect();
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {visibleInspector ? (
                <>
                  <div className={`inspector-type ${visibleInspector.type}`}>
                    {visibleInspector.type === "node"
                      ? "STATE MARKING"
                      : "TRANSITION DATA"}
                  </div>
                  {visibleInspector.subtitle && (
                    <p className="inspector-subtitle">{visibleInspector.subtitle}</p>
                  )}
                  <JsonViewer
                    key={`${visibleInspector.type}-${visibleInspector.title}`}
                    value={visibleInspector.data}
                    label={`${visibleInspector.title} ${visibleInspector.subtitle ?? "data"}`}
                  />
                  <p className="inspector-tip">
                    {pinnedInspector
                      ? "This item is pinned. Select Clear to resume hover inspection."
                      : "Click a state or transition to pin this information."}
                  </p>
                </>
              ) : (
                <div className="inspector-empty">
                  <p>Hover over a state or transition to inspect its data.</p>
                  <p>Click an item to keep its data visible.</p>
                </div>
              )}
            </>
          ) : sidePanelMode === "analysis" ? (
            <section className="analysis-panel" role="tabpanel">
              <div className="analysis-heading">
                <span className="eyebrow">Graph analysis</span>
                <h2>Terminal states and cycles</h2>
              </div>

              {!graphLoaded ? (
                <div className="analysis-message">
                  <p>Open a graph before running analysis.</p>
                </div>
              ) : graphAnalysis.status === "not-run" ? (
                <div className="analysis-message">
                  <p>Analysis has not been run for this graph.</p>
                  <dl className="analysis-input-summary">
                    <div>
                      <dt>States</dt>
                      <dd>{graphRef.current?.nodes.length ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Transitions</dt>
                      <dd>{graphRef.current?.edges.length ?? 0}</dd>
                    </div>
                  </dl>
                  <p className="analysis-note">
                    Terminal states have no outgoing transitions. Whether a terminal
                    state represents a deadlock or successful completion depends on
                    the model.
                  </p>
                  <button
                    type="button"
                    className="primary-button analysis-action"
                    onClick={runGraphAnalysis}
                  >
                    Run analysis
                  </button>
                </div>
              ) : graphAnalysis.status === "running" ? (
                <div className="analysis-message" aria-live="polite">
                  <p>Analyzing graph...</p>
                  <div className="analysis-progress" aria-hidden="true" />
                  <button
                    type="button"
                    className="analysis-action"
                    onClick={graphAnalysis.cancel}
                  >
                    Cancel
                  </button>
                </div>
              ) : graphAnalysis.status === "completed" && graphAnalysis.result ? (
                <div className="analysis-results" aria-live="polite">
                  <dl className="analysis-summary">
                    <div>
                      <dt>Terminal states</dt>
                      <dd>{graphAnalysis.result.terminalNodeIds.length}</dd>
                    </div>
                    <div>
                      <dt>Cyclic components</dt>
                      <dd>{graphAnalysis.result.cyclicComponents.length}</dd>
                    </div>
                    <div>
                      <dt>States in cyclic components</dt>
                      <dd>{graphAnalysis.result.statesInCyclicComponents}</dd>
                    </div>
                    <div>
                      <dt>Largest cyclic component</dt>
                      <dd>{graphAnalysis.result.largestCyclicComponentSize}</dd>
                    </div>
                  </dl>
                  <details
                    className="analysis-result-group"
                    open={terminalStatesExpanded}
                    onToggle={(event) =>
                      setTerminalStatesExpanded(event.currentTarget.open)
                    }
                  >
                    <summary>
                      Terminal states ({graphAnalysis.result.terminalNodeIds.length})
                    </summary>
                    <div className="analysis-result-content">
                      <label
                        className="analysis-filter-label"
                        htmlFor="terminal-state-filter"
                      >
                        Filter by state ID
                      </label>
                      <input
                        id="terminal-state-filter"
                        className="analysis-filter-input"
                        value={terminalStateFilter}
                        onChange={(event) => {
                          setTerminalStateFilter(event.target.value);
                          setTerminalStatePage(0);
                        }}
                        placeholder="Enter all or part of an ID"
                      />
                      {filteredTerminalNodeIds.length === 0 ? (
                        <p className="analysis-note">
                          No terminal states match this filter.
                        </p>
                      ) : (
                        <>
                          <p className="analysis-result-range">
                            Showing {terminalResultStart}-{terminalResultEnd} of{" "}
                            {filteredTerminalNodeIds.length}
                          </p>
                          <div className="terminal-state-list">
                            {visibleTerminalNodeIds.map((nodeId) => (
                              <button
                                key={nodeId}
                                type="button"
                                onClick={() => focusTerminalState(nodeId)}
                              >
                                {nodeId}
                              </button>
                            ))}
                          </div>
                          {terminalPageCount > 1 && (
                            <div className="analysis-pagination">
                              <button
                                type="button"
                                disabled={safeTerminalStatePage === 0}
                                onClick={() =>
                                  setTerminalStatePage((page) =>
                                    Math.max(0, page - 1)
                                  )
                                }
                              >
                                Previous
                              </button>
                              <span>
                                Page {safeTerminalStatePage + 1} of {terminalPageCount}
                              </span>
                              <button
                                type="button"
                                disabled={safeTerminalStatePage >= terminalPageCount - 1}
                                onClick={() =>
                                  setTerminalStatePage((page) =>
                                    Math.min(terminalPageCount - 1, page + 1)
                                  )
                                }
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </details>
                  <details
                    className="analysis-result-group"
                    open={cyclicComponentsExpanded}
                    onToggle={(event) =>
                      setCyclicComponentsExpanded(event.currentTarget.open)
                    }
                  >
                    <summary>
                      Cyclic components ({graphAnalysis.result.cyclicComponents.length})
                    </summary>
                    <div className="analysis-result-content">
                      <label
                        className="analysis-filter-label"
                        htmlFor="cyclic-component-minimum-size"
                      >
                        Minimum component size
                      </label>
                      <input
                        id="cyclic-component-minimum-size"
                        className="analysis-filter-input"
                        type="number"
                        min="1"
                        step="1"
                        value={minimumCyclicComponentSize}
                        onChange={(event) => {
                          const value = Number.parseInt(event.target.value, 10);
                          setMinimumCyclicComponentSize(
                            Number.isFinite(value) ? Math.max(1, value) : 1
                          );
                          setCyclicComponentPage(0);
                        }}
                      />
                      {filteredCyclicComponents.length === 0 ? (
                        <p className="analysis-note">
                          No cyclic components match this minimum size.
                        </p>
                      ) : (
                        <>
                          <p className="analysis-result-range">
                            Showing {cyclicComponentResultStart}-
                            {cyclicComponentResultEnd} of{" "}
                            {filteredCyclicComponents.length}
                          </p>
                          <div className="cyclic-component-list">
                            {visibleCyclicComponents.map((component) => (
                              <button
                                key={component.id}
                                type="button"
                                className={
                                  selectedCyclicComponentId === component.id
                                    ? "active"
                                    : ""
                                }
                                onClick={() => showCyclicComponent(component)}
                              >
                                <span>Cyclic component {getCyclicComponentNumber(component.id)}</span>
                                <small>
                                  {component.nodeIds.length} states{" \u00b7 "}
                                  {component.internalEdgeIds.length} transitions
                                </small>
                              </button>
                            ))}
                          </div>
                          {cyclicComponentPageCount > 1 && (
                            <div className="analysis-pagination">
                              <button
                                type="button"
                                disabled={safeCyclicComponentPage === 0}
                                onClick={() =>
                                  setCyclicComponentPage((page) =>
                                    Math.max(0, page - 1)
                                  )
                                }
                              >
                                Previous
                              </button>
                              <span>
                                Page {safeCyclicComponentPage + 1} of{" "}
                                {cyclicComponentPageCount}
                              </span>
                              <button
                                type="button"
                                disabled={
                                  safeCyclicComponentPage >=
                                  cyclicComponentPageCount - 1
                                }
                                onClick={() =>
                                  setCyclicComponentPage((page) =>
                                    Math.min(cyclicComponentPageCount - 1, page + 1)
                                  )
                                }
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {selectedCyclicComponent && (
                        <div className="selected-component-details">
                          <div>
                            <strong>
                              Cyclic component {getCyclicComponentNumber(selectedCyclicComponent.id)}
                            </strong>
                            <span>
                              {selectedCyclicComponent.nodeIds.length} states and{" "}
                              {selectedCyclicComponent.internalEdgeIds.length} internal
                              transitions
                            </span>
                          </div>
                          <button type="button" onClick={clearCyclicComponentView}>
                            Clear component view
                          </button>
                        </div>
                      )}
                    </div>
                  </details>
                  <p className="analysis-note">
                    Terminal-state navigation uses the current neighborhood depth.
                    Selecting a cyclic component shows only its states and internal
                    transitions.
                  </p>
                  <button
                    type="button"
                    className="analysis-action"
                    onClick={runGraphAnalysis}
                  >
                    Run again
                  </button>
                </div>
              ) : graphAnalysis.status === "failed" ? (
                <div className="analysis-message" role="alert">
                  <p>Analysis could not be completed.</p>
                  <p className="analysis-error">
                    {graphAnalysis.error ?? "An unknown error occurred."}
                  </p>
                  <button
                    type="button"
                    className="analysis-action"
                    onClick={runGraphAnalysis}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="analysis-message">
                  <p>Analysis was cancelled.</p>
                  <button
                    type="button"
                    className="analysis-action"
                    onClick={runGraphAnalysis}
                  >
                    Run analysis
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="path-search-panel" role="tabpanel">
              <div className="analysis-heading path-search-heading">
                <div>
                  <span className="eyebrow">Alternative paths</span>
                  <h2>Bounded shortest paths</h2>
                </div>
                {computedPathViewActive && (
                  <button
                    type="button"
                    className="clear-button"
                    onClick={returnToGraphView}
                  >
                    Return to graph view
                  </button>
                )}
              </div>
              {!graphLoaded ? (
                <div className="analysis-message"><p>Open a graph before searching for paths.</p></div>
              ) : (
                <>
                  <form className="path-search-form" onSubmit={runPathSearch}>
                    <label htmlFor="path-search-strategy">Search strategy</label>
                    <select
                      id="path-search-strategy"
                      value={pathSearchStrategy}
                      onChange={(event) => {
                        invalidatePathSearchResults();
                        setPathSearchStrategy(event.target.value as PathSearchStrategy);
                      }}
                      disabled={pathSearch.status === "running"}
                    >
                      <option value="shortest">Shortest paths</option>
                      <option value="any-witness">Any witness (fast)</option>
                    </select>
                    <p className="path-search-help">
                      {pathSearchStrategy === "any-witness"
                        ? "Returns up to the requested number of satisfying paths in heuristic discovery order. Results are not guaranteed to be shortest."
                        : "Returns paths in deterministic shortest-first order."}
                    </p>
                    <label htmlFor="path-search-source">Source state</label>
                    <input id="path-search-source" value={pathSearchSource} onChange={(event) => { invalidatePathSearchResults(); setPathSearchSource(event.target.value); }} disabled={pathSearch.status === "running"} />
                    <label htmlFor="path-search-target">Target state (optional)</label>
                    <input
                      id="path-search-target"
                      value={pathSearchTarget}
                      placeholder="Leave empty to end at any state"
                      onChange={(event) => {
                        invalidatePathSearchResults();
                        const nextTarget = event.target.value;
                        setPathSearchTarget(nextTarget);
                        if (!nextTarget.trim()) {
                          setRequireConstraintExercise(true);
                        }
                      }}
                      disabled={pathSearch.status === "running"}
                    />
                    <label className="path-search-checkbox" htmlFor="path-search-exercise">
                      <input
                        id="path-search-exercise"
                        type="checkbox"
                        checked={requireConstraintExercise}
                        onChange={(event) => {
                          invalidatePathSearchResults();
                          setRequireConstraintExercise(event.target.checked);
                        }}
                        disabled={pathSearch.status === "running"}
                      />
                      <span>Require constraints to be exercised</span>
                    </label>
                    <p className="path-search-help">
                      Without a target, paths may end at any state after all enabled
                      constraints are satisfied. When exercise checking is enabled,
                      returned paths must exercise every enabled constraint that
                      requires exercise.
                    </p>
                    <div className="path-search-number-row">
                      <div>
                        <label htmlFor="path-search-count">Number of paths</label>
                        <input id="path-search-count" type="number" min="1" max="100" step="1" value={requestedPathCount} onChange={(event) => { invalidatePathSearchResults(); setRequestedPathCount(Math.max(1, Number.parseInt(event.target.value, 10) || 1)); }} disabled={pathSearch.status === "running"} />
                      </div>
                      <div>
                        <label htmlFor="path-search-visits">Visits per state</label>
                        <input id="path-search-visits" type="number" min="1" max="10" step="1" value={maximumVisitsPerState} onChange={(event) => { invalidatePathSearchResults(); setMaximumVisitsPerState(Math.max(1, Number.parseInt(event.target.value, 10) || 1)); }} disabled={pathSearch.status === "running"} />
                      </div>
                    </div>
                    <DeclareConstraintBuilder
                      constraints={declareConstraints}
                      transitionOptions={transitionOptions}
                      transitionDataCatalogue={transitionDataCatalogue}
                      disabled={pathSearch.status === "running"}
                      onChange={changeDeclareConstraints}
                    />
                    <p className="analysis-note">A visit limit of 1 produces loopless paths. Higher values allow bounded revisits. Paths are unique by ordered edge IDs.</p>
                    {pathSearch.status === "running" ? (
                      <button type="button" onClick={pathSearch.cancel}>Cancel</button>
                    ) : (
                      <button type="submit" className="primary-button">Find paths</button>
                    )}
                  </form>
                  {pathSearch.status === "running" && <div className="path-search-status" aria-live="polite"><p>Searching for paths...</p><div className="analysis-progress" aria-hidden="true" /></div>}
                  {pathSearch.status === "cancelled" && <p className="path-search-status">Path search was cancelled.</p>}
                  {pathSearch.status === "failed" && <div className="analysis-error" role="alert">{pathSearch.error ?? "Path search failed."}</div>}
                  {pathSearch.status === "completed" && pathSearch.result && (
                    <div className="path-search-results" aria-live="polite">
                      <div className="path-search-result-heading">
                        <strong>{pathSearch.result.paths.length} path{pathSearch.result.paths.length === 1 ? "" : "s"} found</strong>
                        <span>{pathSearch.result.expandedCandidateCount} candidates expanded</span>
                      </div>
                      {pathSearch.result.paths.length === 0 ? (
                        <p className="analysis-note">{pathSearchTarget.trim() ? "No path reaches the target while satisfying the configured constraints and visit bound." : "No path satisfies the configured constraints and visit bound."}</p>
                      ) : (
                        <div className="computed-path-list">
                          {pathSearch.result.paths.map((path, index) => {
                            const steps = getComputedPathSteps(path);

                            return (
                              <article
                                key={`${index}-${path.edgeIds.join("|")}`}
                                className={
                                  shownSearchPathIndex === index
                                    ? "computed-path-card active"
                                    : "computed-path-card"
                                }
                              >
                                <button
                                  type="button"
                                  className="computed-path-show"
                                  onClick={() => showComputedPath(path, index)}
                                >
                                  <span>Path {index + 1}</span>
                                  <small>
                                    {path.edgeIds.length} transition
                                    {path.edgeIds.length === 1 ? "" : "s"}
                                    {` \u00b7 Ends at state ${
                                      path.endNodeId ??
                                      steps.at(-1)?.target ??
                                      path.startNodeId
                                    }`}
                                  </small>
                                </button>
                                {(path.explanations?.length ?? 0) > 0 && (
                                  <details className="computed-path-explanations">
                                    <summary>Why this path satisfies the constraints</summary>
                                    <div className="constraint-explanation-list">
                                      {path.explanations?.map((explanation) => (
                                        <section
                                          key={explanation.constraintId}
                                          className="constraint-explanation"
                                        >
                                          <div className="constraint-explanation-heading">
                                            <strong>{explanation.constraintId}</strong>
                                            <span>Satisfied</span>
                                          </div>
                                          <small>{explanation.template}</small>
                                          <p>{explanation.summary}</p>
                                          <p className="constraint-exercise-status">
                                            {explanation.exercised
                                              ? "Constraint was exercised by this path."
                                              : "Constraint was satisfied without an exercise event."}
                                          </p>
                                          {explanation.events.length > 0 && (
                                            <ol>
                                              {explanation.events.map((explanationEvent, eventIndex) => (
                                                <li key={`${explanationEvent.role}-${explanationEvent.stepNumber}-${explanationEvent.edgeId}-${eventIndex}`}>
                                                  <button
                                                    type="button"
                                                    onClick={() => focusExplanationEvent(explanationEvent, index)}
                                                  >
                                                    {explanationEvent.role}: step {explanationEvent.stepNumber}{" "}
                                                    {explanationEvent.transition} ({explanationEvent.edgeId})
                                                  </button>
                                                </li>
                                              ))}
                                            </ol>
                                          )}
                                          {explanation.correlations.length > 0 && (
                                            <div className="constraint-correlation-evidence">
                                              <div className="constraint-correlation-heading">
                                                <strong>Correlation matched</strong>
                                                <span>Alias evidence</span>
                                              </div>
                                              {explanation.correlations.map((correlation, correlationIndex) => (
                                                <div className="constraint-correlation-pair" key={`${correlation.activationStepNumber}-${correlation.targetStepNumber}-${correlationIndex}`}>
                                                  {correlation.comparisons.map((comparison, comparisonIndex) => {
                                                    const activationReference = comparison.left.kind === "activation" ? comparison.left : comparison.right.kind === "activation" ? comparison.right : undefined;
                                                    const targetReference = comparison.left.kind === "target" ? comparison.left : comparison.right.kind === "target" ? comparison.right : undefined;
                                                    return (
                                                      <div className="constraint-correlation-match" key={`${comparisonIndex}-${comparison.left.label}-${comparison.right.label}`}>
                                                        {activationReference ? (
                                                          <>
                                                            <div className="constraint-correlation-value-row">
                                                              <code>${activationReference.alias ?? "alias"}</code>
                                                              <span>=</span>
                                                              <strong>{formatCorrelationEvidenceValue(activationReference.value, activationReference.found)}</strong>
                                                              <span className="constraint-correlation-badge">Matched</span>
                                                            </div>
                                                            <div className="constraint-correlation-provenance">
                                                              <p>Captured at step {correlation.activationStepNumber} from <code>{activationReference.path ?? activationReference.label}</code></p>
                                                              <p>Matched at step {correlation.targetStepNumber} against <code>{targetReference?.path ?? targetReference?.label ?? "target value"}</code></p>
                                                            </div>
                                                          </>
                                                        ) : (
                                                          <div className="constraint-correlation-value-row">
                                                            <code>{comparison.left.label}</code>
                                                            <strong>{formatCorrelationEvidenceValue(comparison.left.value, comparison.left.found)}</strong>
                                                            <span>{comparison.operator}</span>
                                                            <code>{comparison.right.label}</code>
                                                            <strong>{formatCorrelationEvidenceValue(comparison.right.value, comparison.right.found)}</strong>
                                                            <span className="constraint-correlation-badge">Matched</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </section>
                                      ))}
                                    </div>
                                  </details>
                                )}
                                <details className="computed-path-details">
                                  <summary>Show transition details</summary>
                                  {steps.length === 0 ? (
                                    <p>Zero-transition path at state {path.startNodeId}.</p>
                                  ) : (
                                    <ol>
                                      {steps.map((step) => (
                                        <li
                                          key={`${step.index}-${step.id}`}
                                          className={
                                            focusedComputedStepKey === `${index}-${step.index}-${step.id}`
                                              ? "active"
                                              : ""
                                          }
                                        >
                                          <button
                                            type="button"
                                            className="computed-step-transition"
                                            onClick={() =>
                                              focusComputedPathEdge(
                                                step.id,
                                                `${index}-${step.index}-${step.id}`
                                              )
                                            }
                                          >
                                            {step.transition}
                                          </button>
                                          <span className="computed-step-route">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                focusComputedPathNode(
                                                  step.source,
                                                  `${index}-${step.index}-${step.id}`
                                                )
                                              }
                                            >
                                              {step.source}
                                            </button>
                                            <span aria-hidden="true">{"\u2192"}</span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                focusComputedPathNode(
                                                  step.target,
                                                  `${index}-${step.index}-${step.id}`
                                                )
                                              }
                                            >
                                              {step.target}
                                            </button>
                                          </span>
                                          <button
                                            type="button"
                                            className="computed-step-edge-id"
                                            onClick={() =>
                                              focusComputedPathEdge(
                                                step.id,
                                                `${index}-${step.index}-${step.id}`
                                              )
                                            }
                                          >
                                            {step.id}
                                          </button>
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                </details>
                              </article>
                            );
                          })}
                        </div>
                      )}
                      {pathSearch.result.resourceLimitReached && <p className="path-search-warning">Search stopped at the internal resource limit. Additional valid paths may exist.</p>}
                      {pathSearch.result.exhausted && pathSearch.result.paths.length < requestedPathCount && <p className="analysis-note">The bounded search space was exhausted. No additional paths exist for this visit limit.</p>}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;

