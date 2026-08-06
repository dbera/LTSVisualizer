import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import cytoscape from "cytoscape";
import "./App.css";
import JsonViewer, { type JsonValue } from "./components/JsonViewer";
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
} from "./graph/graphJson";

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

interface InspectorInfo {
  type: "node" | "edge";
  title: string;
  subtitle?: string;
  data: JsonValue;
}

const API_URL = "http://127.0.0.1:8000/graph/upload";

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

  function updatePathMode(mode: PathSelectionMode) {
    pathModeRef.current = mode;
    setPathMode(mode);
  }

  function updateSelectedPath(path: SelectedPath | null) {
    selectedPathRef.current = path;
    setSelectedPath(path);
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

  function showPathContext(path: SelectedPath) {
    const graph = graphRef.current;
    const cy = cyRef.current;
    if (!graph || !cy) return;

    const resolvedPath = resolvePath(graph, path);
    const selectedEdges = resolvedPath.edges;
    const pathNodeIds = resolvedPath.nodeIds;
    const endNodeId = resolvedPath.endNodeId;
    const outgoingEdges = getCandidateEdges(graph, path);
    const requiredNodeIds = new Set<string>(pathNodeIds);
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

    const missingNodeIds = new Set(
      [...requiredNodeIds].filter((nodeId) => cy.getElementById(nodeId).empty())
    );
    const missingEdges = [...selectedEdges, ...outgoingEdges].filter(
      (edge) => cy.getElementById(edge.id).empty()
    );

    const endpoint = cy.getElementById(endNodeId);
    const endpointPosition = endpoint.nonempty()
      ? endpoint.position()
      : { x: 160, y: 160 };
    const targetNodeIds = [...new Set(outgoingEdges.map((edge) => edge.target))];

    cy.startBatch();

    if (missingNodeIds.size > 0) {
      const nodeElements = buildElements(graph, missingNodeIds, [], showTransitionLabels);
      cy.add(nodeElements);

      [...missingNodeIds].forEach((nodeId) => {
        const targetIndex = Math.max(0, targetNodeIds.indexOf(nodeId));
        const verticalOffset =
          targetIndex - (Math.max(targetNodeIds.length, 1) - 1) / 2;
        cy.getElementById(nodeId).position({
          x: endpointPosition.x + 230,
          y: endpointPosition.y + verticalOffset * 135,
        });
      });
    }

    if (missingEdges.length > 0) {
      cy.add(
        buildElements(graph, new Set<string>(), missingEdges, true)
      );
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

    const requestedStateId = selectedStateId ?? searchText.trim();
    const startStateId = graph.nodes.some((node) => node.id === requestedStateId)
      ? requestedStateId
      : null;

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
      const document = createGraphJsonDocument(graph, {
        title: sourceName,
      });
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
      const document = createSelectedPathJsonDocument(graph, path, {
        title: `Selected path ${resolved.startNodeId} to ${resolved.endNodeId}`,
      });
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

  function showNeighborhood(
    stateId: string,
    hops: number,
    layout: OverviewLayout = overviewLayout
  ) {
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

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setStatus(`Loading ${file.name}...`);
    setFileName(file.name);
    setInspectorInfo(null);
    setPinnedInspector(null);
    pinnedInspectorRef.current = null;
    updateSelectedPath(null);
    updatePathMode("idle");

    try {
      const isJsonFile = file.name.toLowerCase().endsWith(".json");
      let graph: GraphData;
      let importedPath: SelectedPath | null = null;

      if (isJsonFile) {
        const parsed = parseGraphJsonText(await file.text());
        graph = parsed.graph;
        importedPath = parsed.selectedPath;
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const response = await axios.post<GraphData>(API_URL, formData);
        graph = response.data;
      }

      graphRef.current = graph;
      setGraphLoaded(true);
      setShowTransitionLabels(graph.nodes.length <= 300);

      if (graph.nodes.length === 0) {
        setGraphLoaded(false);
        setStatus("The selected file contains no graph nodes");
        return;
      }

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

      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;

        if (typeof detail === "string") {
          setStatus(detail);
        } else if (!error.response) {
          setStatus("Could not contact FastAPI. Start the backend and try again.");
        } else {
          setStatus(`Could not load ${file.name}`);
        }
      } else if (error instanceof Error) {
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
            "curve-style": "bezier",
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
            accept=".puml,.plantuml,.txt,.json"
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

      <section className="workspace">
        <div className="graph-panel">
          {!graphLoaded && (
            <div className="empty-overlay">
              <h2>No graph loaded</h2>
              <p>Open a .puml, .plantuml, or .txt PlantUML file to begin.</p>
            </div>
          )}
          <div ref={graphContainer} className="graph-container" />
        </div>

        <aside className="inspector">
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
        </aside>
      </section>
    </main>
  );
}

export default App;
