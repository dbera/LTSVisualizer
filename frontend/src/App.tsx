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
  content: string;
}

const API_URL = "http://127.0.0.1:8000/graph/upload";

function App() {
  const graphContainer = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const graphRef = useRef<GraphData | null>(null);
  const pinnedInspectorRef = useRef<InspectorInfo | null>(null);

  const [status, setStatus] = useState("Select a PlantUML file to begin");
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

  function makeNodeInspector(node: cytoscape.NodeSingular): InspectorInfo {
    const marking = node.data("marking");

    return {
      type: "node",
      title: `State ${node.id()}`,
      subtitle: "Marking",
      content: marking
        ? JSON.stringify(marking, null, 2)
        : "No marking data available",
    };
  }

  function makeEdgeInspector(edge: cytoscape.EdgeSingular): InspectorInfo {
    const inputs = edge.data("inputs");

    return {
      type: "edge",
      title: edge.data("transition") ?? "Transition",
      subtitle: `${edge.source().id()} -> ${edge.target().id()}`,
      content: inputs
        ? JSON.stringify(inputs, null, 2)
        : "No transition input data available",
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
      })),
      ...visibleEdges.map((edge) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: showLabels ? edge.transition : "",
          transition: edge.transition,
          inputs: edge.inputs,
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post<GraphData>(API_URL, formData);
      const graph = response.data;

      graphRef.current = graph;
      setGraphLoaded(true);
      setShowTransitionLabels(graph.nodes.length <= 300);

      if (graph.nodes.length === 0) {
        setStatus("The selected file contains no graph nodes");
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
      wheelSensitivity: 0.2,
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
            width: "34px",
            height: "34px",
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

      setSelectedStateId(stateId);
      setSearchText(stateId);
      pinnedInspectorRef.current = info;
      setPinnedInspector(info);
      setInspectorInfo(info);
    });

    cy.on("tap", "edge", (event) => {
      const info = makeEdgeInspector(event.target);
      pinnedInspectorRef.current = info;
      setPinnedInspector(info);
      setInspectorInfo(info);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  const visibleInspector = pinnedInspector ?? inspectorInfo;
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
            accept=".puml,.plantuml,.txt"
            className="file-input"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            className="primary-button"
            onClick={() => fileInput.current?.click()}
          >
            Open PlantUML file
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
            disabled={!graphLoaded}
          />
          <button type="submit" disabled={!graphLoaded}>
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
              disabled={!graphLoaded}
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
            disabled={!graphLoaded}
          >
            Hierarchical
          </button>
          <button
            type="button"
            className={overviewLayout === "grid" ? "active" : ""}
            onClick={() => changeOverviewLayout("grid")}
            disabled={!graphLoaded}
          >
            Grid
          </button>
        </div>

        <button
          type="button"
          className={showTransitionLabels ? "active" : ""}
          onClick={toggleTransitionLabels}
          disabled={!graphLoaded}
        >
          {showTransitionLabels ? "Hide labels" : "Show labels"}
        </button>

        <button
          type="button"
          className={showingAll ? "active" : ""}
          onClick={() => showAll()}
          disabled={!graphLoaded}
        >
          Show all
        </button>
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
                  : "TRANSITION INPUTS"}
              </div>
              {visibleInspector.subtitle && (
                <p className="inspector-subtitle">{visibleInspector.subtitle}</p>
              )}
              <pre>{visibleInspector.content}</pre>
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
