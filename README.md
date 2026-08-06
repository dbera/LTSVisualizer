# LTSVisualizer

LTSVisualizer is a browser-based application for exploring large labelled transition systems and reachability graphs stored as JSON.

It was created primarily for reachability graphs generated from Colored Petri Nets, where:

- **Nodes** represent markings or states.
- **Edges** represent fired transitions.
- **Transition inputs** describe data consumed by a transition.
- **Transition outputs** describe tokens produced by a transition, grouped by output place.
- **State markings** describe the distribution of tokens across Petri-net places.

The application is implemented with React, TypeScript, Vite, and Cytoscape.js. Graph files are parsed and validated locally in the browser. LTSVisualizer has no backend, sends no graph data to a server, and requires no Python installation.

LTSVisualizer supports small linear graphs and large cyclic state spaces containing thousands of states and transitions.

## Ways to use LTSVisualizer

### Online

The repository contains a GitHub Pages deployment workflow for the static application. When the deployment is available, the application is served at:

<https://dbera.github.io/LTSVisualizer/>

### Offline

Download `LTSVisualizer.html` from a GitHub Release or from the artifact of a manually triggered **Build offline HTML release** workflow.

The file is self-contained and can be opened directly in a modern browser:

1. Download `LTSVisualizer.html` and `SHA256SUMS.txt`.
2. Optionally verify the checksum as described below.
3. Double-click `LTSVisualizer.html`, or use **Open with** and select a modern browser.
4. Open a local JSON graph from the application.

No installation, local server, Node.js, or Python runtime is required.

## Verify an offline release

On Windows PowerShell:

```powershell
Get-FileHash .\LTSVisualizer.html -Algorithm SHA256
Get-Content .\SHA256SUMS.txt
```

The calculated hash must match the hash recorded for `LTSVisualizer.html`.

## Features

### JSON graph input

- Open `.json` LTS graph files directly in the browser.
- Validate document structure, node IDs, edge IDs, source and target references, semantic fields, and saved paths.
- Accept complete LTSVisualizer graph documents and lightweight documents containing `nodes` and `edges`.
- Reopen selected-path JSON exports as regular graphs.
- Preserve transition labels and colors such as `darkorange` or `#darkorange`.
- Preserve structured and raw state markings.
- Preserve structured and raw transition inputs and outputs.
- Distinguish parallel transitions using unique edge IDs.

LTSVisualizer does not import PlantUML files. PlantUML remains available only as an export format for selected paths.

### Graph exploration

- Search for a state by ID.
- Explore one-, two-, or three-hop neighborhoods around a focused state.
- Display the complete graph with **Show all**.
- Switch between hierarchical and grid layouts.
- Show or hide transition labels.
- Pan, zoom, select, and manually reposition states.
- Use a lightweight full-graph overview for large state spaces.

### Inspection

- Inspect state markings by hovering over or selecting states.
- Inspect consumed inputs and produced outputs by hovering over or selecting transitions.
- Inspect structured and raw semantic data through an expandable JSON viewer.
- Expand or collapse nested data and copy inspector data as JSON.
- Pin inspector content while continuing to explore the graph.
- Clear pinned inspector content without clearing a selected path.

### Graph analysis

- Open the **Analysis** tab without affecting the Inspector.
- Run analysis explicitly with **Run analysis**. Analysis is never started automatically when a graph is loaded.
- Detect terminal states, defined as states with no outgoing transitions.
- Compute strongly connected components using an iterative graph traversal that avoids recursive call-stack limits.
- Classify an SCC as cyclic when it contains more than one state or when a singleton state has a self-loop.
- Run graph analysis in an inline Web Worker so the browser interface remains responsive.
- Cancel an analysis while it is running.
- Ignore stale worker results after cancellation, reruns, or loading another graph.
- Filter terminal states by state ID and browse large result sets in pages of 100.
- Select a terminal state to open its current neighborhood view.
- Filter cyclic components by minimum component size and browse results in pages of 100.
- Select one cyclic component to display only its member states and internal transitions.
- Clear a component-only view and return to normal neighborhood exploration.
- Use the same analysis functionality in the hosted application and the offline `file:///` build.

A terminal state is not automatically an error. Whether a terminal state represents successful completion or an unintended deadlock depends on the model. LTSVisualizer reports terminal states and does not attempt to classify their business meaning.

Analysis results are held in browser memory for the currently loaded graph. They are reset when another graph is opened and are not added to graph or selected-path exports.

### Manual path selection

- Start a path from the currently focused state.
- Extend a path by selecting a highlighted successor state.
- Select an exact edge through **Choose next transition**.
- Distinguish parallel and identically named transitions by edge ID.
- Support loops, repeated states, and repeated edge traversals.
- Undo the most recent transition.
- Restart or clear the selected path.
- Preserve graph zoom, pan, and manually adjusted state positions while constructing a path.

### Export

- Export the complete loaded graph as JSON, independently of the visible neighborhood or selected path.
- Export a selected path as a self-contained JSON document.
- Export a selected path as PlantUML.
- Preserve exact transition order, loops, repeated traversals, and parallel-edge identity.
- Preserve state markings, transition inputs, transition outputs, raw semantic values, labels, and colors.

## Sample data

The repository includes:

- `sample-data/example.json`: a small graph for quick checks.
- `sample-data/rg_imaging.json`: a larger, realistic reachability graph.
- `sample-data/synthetic.json`: a synthetic graph for terminal-state and strongly connected component analysis.

The expected analysis for `synthetic.json` is:

```text
States:                         32
Transitions:                    41
Terminal states:                 4
Cyclic components:               5
States in cyclic components:    19
Largest cyclic component:        8
Cyclic component sizes: 8, 5, 3, 2, 1
```

## JSON input format

A complete LTSVisualizer graph document has explicit nodes and edges:

```json
{
  "format": "ltsvisualizer",
  "version": 1,
  "type": "graph",
  "metadata": {
    "title": "Example reachability graph"
  },
  "nodes": [
    {
      "id": "0",
      "marking_raw": null,
      "marking": {
        "input": [
          { "id": 42 }
        ]
      }
    },
    {
      "id": "1",
      "marking_raw": null,
      "marking": {
        "processing": [
          { "id": 42 }
        ]
      }
    }
  ],
  "edges": [
    {
      "id": "edge-17",
      "source": "0",
      "target": "1",
      "transition": "StartProcessing",
      "color": "darkorange",
      "inputs_raw": null,
      "inputs": {
        "request": { "id": 42 }
      },
      "outputs_raw": null,
      "outputs": {
        "processing": [
          { "id": 42 }
        ]
      }
    }
  ]
}
```

### Node fields

Each node contains:

- `id`: unique state identifier.
- `marking`: optional structured state marking.
- `marking_raw`: optional original marking text.

Example:

```json
{
  "id": "42",
  "marking_raw": null,
  "marking": {
    "requests": [
      { "id": 100 }
    ]
  }
}
```

### Edge fields

Each edge contains:

- `id`: unique edge identifier.
- `source`: source node ID.
- `target`: target node ID.
- `transition`: transition name.
- `color`: optional transition color.
- `inputs`: optional structured transition-input bindings.
- `inputs_raw`: optional original transition-input text.
- `outputs`: optional structured transition-output flow. Each key is an output place and each value is an array of produced tokens.
- `outputs_raw`: optional original transition-output text.

Example:

```json
{
  "id": "edge-42",
  "source": "10",
  "target": "11",
  "transition": "ProcessRequest",
  "color": null,
  "inputs_raw": null,
  "inputs": {
    "request": { "id": 100 }
  },
  "outputs_raw": "{completed={'{\"id\": 100}'}}",
  "outputs": {
    "completed": [
      { "id": 100 }
    ]
  }
}
```

The edge ID identifies the exact edge. Connectivity is represented separately by `source` and `target`, allowing parallel edges even when source, target, and transition name are identical.

`outputs` represents the tokens produced by the transition firing, not the complete target-state marking. Token order and duplicate occurrences are preserved.

Missing and explicitly empty output data have different meanings:

- `"outputs": null` means output information was not supplied.
- `"outputs": {}` means the supplied output flow is known to be empty.
- The same distinction applies to `outputs_raw`: `null` means unavailable, while `"{}"` represents a known empty raw output flow.

Older JSON files that omit `outputs` and `outputs_raw` remain supported. Missing optional semantic fields are normalized to `null`.

### Lightweight graph documents

The format envelope is optional when importing JSON:

```json
{
  "nodes": [
    { "id": "0" },
    { "id": "1" }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "0",
      "target": "1",
      "transition": "Continue"
    }
  ]
}
```

## Selected-path JSON format

A selected-path export contains a self-contained graph subset and an ordered path:

```json
{
  "format": "ltsvisualizer",
  "version": 1,
  "type": "selected-path",
  "metadata": {
    "title": "Selected path 0 to 3",
    "startStateId": "0",
    "endStateId": "3",
    "stateCount": 4,
    "transitionCount": 3
  },
  "nodes": [
    {
      "id": "0",
      "marking_raw": null,
      "marking": null
    },
    {
      "id": "1",
      "marking_raw": null,
      "marking": null
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "0",
      "target": "1",
      "transition": "Start",
      "color": null,
      "inputs_raw": null,
      "inputs": null,
      "outputs_raw": null,
      "outputs": null
    }
  ],
  "path": {
    "startNodeId": "0",
    "edgeIds": ["edge-1"]
  }
}
```

The `nodes` and `edges` arrays describe unique graph elements. The ordered `path.edgeIds` array describes the exact traversal and preserves:

- Transition order
- Parallel-edge identity
- Repeated transitions
- Loops
- Repeated state occurrences

For example, the traversal `0 -> 1 -> 0 -> 1` contains four state occurrences and three transition steps, even if its graph subset contains only two unique states and two unique edges.

When a selected-path JSON file is reopened, LTSVisualizer loads its graph subset as a regular graph. Search, neighborhoods, layouts, labels, and **Show all** remain available.

## Using the dashboard

### Open a graph

1. Open the online application or `LTSVisualizer.html`.
2. Select **Open LTS Graph File**.
3. Choose a `.json` graph file.
4. Wait for validation and rendering to complete.

Graph data remains in the browser and is not uploaded to a server.

### Explore a graph

1. Enter a state ID to focus on that state.
2. Use **1 hop**, **2 hops**, or **3 hops** to control neighborhood depth.
3. Use **Show all** to display the complete graph.
4. Switch between **Hierarchical** and **Grid** layouts.
5. Toggle transition labels for readability and performance.
6. Hover over a graph element to inspect its semantic data.
7. Select a state or transition to pin its inspector data.
8. Drag states to adjust positions.
9. Drag the background to pan.
10. Use the mouse wheel to zoom.

For very large graphs, neighborhood exploration is recommended instead of displaying every state and transition simultaneously.

### Analyze a graph

1. Open the **Analysis** tab in the right-hand panel.
2. Select **Run analysis**. Loading a graph or opening the tab does not start computation.
3. Select **Cancel** if the analysis should be stopped.
4. Review the terminal-state and cyclic-component summary.
5. Expand **Terminal states** to filter and select a terminal state.
6. Expand **Cyclic components** to filter by minimum size and select a component.
7. Select **Clear component view** to return to normal neighborhood exploration.
8. Select **Run again** to recompute the results for the current graph.

For large graphs, worker execution prevents the analysis algorithm from blocking the main browser interface. Preparing and transferring graph topology still consumes browser memory, so analysis remains an explicit user action.

### Select a path

1. Search for or focus the desired starting state.
2. Select **Select path**.
3. Extend the path by selecting a highlighted successor state or an exact edge under **Choose next transition**.

Path colors are:

- **Green**: path start
- **Blue**: selected path
- **Orange**: current endpoint
- **Cyan**: available next states and transitions

Use **Choose next transition** when multiple or parallel transitions lead to the same state, when transitions have identical names, or when an edge is difficult to select directly.

Selecting a transition back to an earlier state creates a loop. It does not rewind the traversal.

- **Undo** removes the most recently selected transition.
- **Restart path** discards the current traversal and starts a new selection.
- **Clear path** exits path-selection mode.
- The Inspector's clear action only unpins inspector content.

## Export behavior

### Export a selected path as JSON

The JSON path export preserves:

- Unique graph nodes and edges
- Exact ordered edge IDs
- Loops and repeated traversals
- Parallel-edge identity
- State markings
- Transition inputs and outputs
- Raw markings, inputs, and outputs
- Transition labels and colors

Exported selected-path JSON files can be reopened as regular graphs.

### Export a selected path as PlantUML

The PlantUML export preserves selected states and transitions, transition order, labels, colors, state markings, transition inputs, and transition outputs.

When output information is available, the export includes a machine-readable comment:

```plantuml
'Transition Outputs: {completed={'{"id": 100}'}}
```

A known empty output flow is exported as:

```plantuml
'Transition Outputs: {}
```

The output comment is omitted when output information is unavailable.

PlantUML files exported by LTSVisualizer are intended for PlantUML-compatible tools. LTSVisualizer itself does not import PlantUML files.

### Export the complete graph as JSON

Select **Export graph JSON** to export every state and transition in the loaded graph. The export is independent of:

- The visible neighborhood
- The focused state
- Whether **Show all** is active
- The selected path

The export preserves all unique states and transitions, parallel edges, semantic data, labels, colors, and graph counts. Its filename is derived safely from the opened JSON filename.

A complete graph export has document type `graph` and includes counts in its metadata:

```json
{
  "format": "ltsvisualizer",
  "version": 1,
  "type": "graph",
  "metadata": {
    "title": "Example graph",
    "stateCount": 1000,
    "transitionCount": 2500
  },
  "nodes": [],
  "edges": []
}
```

The document contains the complete graph held in memory, not only the elements currently rendered by Cytoscape.js.

## Architecture

```text
Local JSON graph file
        |
        v
React and TypeScript application
        |
        |-- JSON parsing and validation
        |-- Cytoscape.js visualization
        |-- Search and neighborhood exploration
        |-- Structured semantic-data inspection
        |-- On-demand terminal-state and SCC analysis
        |   `-- Inline Web Worker with cancellation
        |-- Manual path selection
        |-- Complete-graph JSON export
        |-- Selected-path JSON export
        `-- Selected-path PlantUML export
```

All graph processing occurs in the browser. There is no application backend or API.

Two production build targets are maintained:

- The standard Vite build in `frontend/dist` for static web hosting and GitHub Pages.
- The single-file build in `frontend/dist-offline` for a double-clickable offline `LTSVisualizer.html` release.

## Technology stack

- React
- TypeScript
- Vite
- Cytoscape.js
- Vitest
- Oxlint
- vite-plugin-singlefile
- GitHub Actions
- GitHub Pages

## Project structure

```text
LTSVisualizer/
|-- .github/
|   |-- dependabot.yml
|   |-- ISSUE_TEMPLATE/
|   |-- pull_request_template.md
|   `-- workflows/
|       |-- ci.yml
|       |-- pages.yml
|       `-- release.yml
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- components/
|   |   |-- graph/
|   |   |-- workers/
|   |   |-- App.css
|   |   |-- App.tsx
|   |   |-- index.css
|   |   `-- main.tsx
|   |-- index.html
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.ts
|   `-- vite.offline.config.ts
|-- sample-data/
|   |-- example.json
|   |-- rg_imaging.json
|   `-- synthetic.json
|-- CHANGELOG.md
|-- CONTRIBUTING.md
|-- LICENSE
|-- README.md
`-- SECURITY.md
```

Generated directories are intentionally ignored by Git:

```text
frontend/dist/
frontend/dist-offline/
```

## Developer prerequisites

- Node.js 22 or newer
- npm
- Git

## Set up the project

```bash
git clone https://github.com/dbera/LTSVisualizer.git
cd LTSVisualizer/frontend
npm install
```

For deterministic CI and release builds, use `npm ci` when `node_modules` is absent and `package-lock.json` is current.

## Run in development mode

From `frontend`:

```bash
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Development checks

From `frontend`:

```bash
npm test
npm run lint
npm run build
npm run build:offline
```

The current test suite covers JSON validation and round trips, graph serialization, complete-graph export, path selection, loops, repeated states, parallel edges, selected-path export, semantic data, PlantUML path export, terminal-state detection, iterative SCC computation, large synthetic graph topologies, and worker-controller lifecycle behavior.

## Build targets

### Static web build

From `frontend`:

```bash
npm run build
```

Output:

```text
frontend/dist/
```

This build uses the `/LTSVisualizer/` base path for GitHub Pages.

### Offline single-file build

From `frontend`:

```bash
npm run build:offline
```

Output:

```text
frontend/dist-offline/index.html
```

For release distribution, the workflow renames the file to `LTSVisualizer.html` and generates `SHA256SUMS.txt`.

The offline configuration disables copying `frontend/public` and removes the external favicon reference so the release contains no required external assets.

## GitHub Actions

### Continuous integration

`.github/workflows/ci.yml` runs frontend checks on pushes and pull requests. It installs dependencies, runs tests, runs linting, and builds the standard frontend.

### GitHub Pages

`.github/workflows/pages.yml` builds `frontend/dist`, uploads the Pages artifact, and deploys the static site from `main`.

### Offline HTML release

`.github/workflows/release.yml` runs manually or when a tag matching `v*` is pushed. It:

1. Installs frontend dependencies.
2. Runs tests and linting.
3. Builds the offline single-file application.
4. Renames the output to `LTSVisualizer.html`.
5. Generates `SHA256SUMS.txt`.
6. Uploads both files as a workflow artifact.
7. Publishes both files to a GitHub Release for tag-triggered runs.

## Publish a release

1. Update `CHANGELOG.md` and user-facing documentation.
2. Run all frontend checks.
3. Manually run **Build offline HTML release** and verify the downloaded file through a `file:///` URL.
4. Commit and push release changes to `main`.
5. Wait for continuous integration to pass.
6. Synchronize the local branch:

```powershell
git switch main
git pull origin main
git status
```

7. Create and push an annotated version tag:

```powershell
git tag -a v0.4.0 -m "LTSVisualizer 0.4.0"
git push origin v0.4.0
```

The tag triggers the offline HTML release workflow and publishes `LTSVisualizer.html` and `SHA256SUMS.txt` to the corresponding GitHub Release.

## Current limitations

- Only JSON graph input is supported.
- PlantUML is an export-only format.
- Extremely large full-graph views can be visually dense even when rendering remains responsive.
- Global force-directed layouts are intentionally avoided because they can be computationally expensive in the browser.
- Terminal states are reported topologically and are not classified as successful completions or definite deadlocks.
- Graph analysis uses a worker and is user-triggered, but very large graphs still require additional browser memory for topology transfer and analysis results.
- The offline release depends on browser support for local `file:///` applications and file selection.
- GitHub Pages availability depends on successful processing by GitHub's deployment service.

## Roadmap

Planned priority:

1. Experiment with constrained graph search.

The constrained graph-search experiment may support:

- Start and optional target states
- Required transitions in order
- Forbidden transitions
- Maximum path length
- Shortest matching paths
- Loops and parallel transitions
- Reuse of the existing path visualization and export functionality

Additional potential improvements include:

- State-to-state marking differences
- Token-journey visualization
- Transition-frequency analytics

## Contributing

Contributions, bug reports, and feature suggestions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development and pull-request guidelines.

## Security

Do not disclose security vulnerabilities through public GitHub issues. See [`SECURITY.md`](SECURITY.md) for the reporting process.

## License

This project is licensed under the MIT License. See [`LICENSE`](LICENSE) for details.

## Author

Debjyoti Bera

Project repository: <https://github.com/dbera/LTSVisualizer>
