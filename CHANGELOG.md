# Changelog

All notable changes to LTSVisualizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased](https://github.com/dbera/LTSVisualizer/compare/v0.4.0...HEAD)

### Added

- Added an on-demand **Analysis** tab alongside the Inspector.
- Added terminal-state detection for states without outgoing transitions.
- Added iterative strongly connected component computation without recursive graph traversal.
- Added cyclic-component classification for multi-state SCCs and singleton states with self-loops.
- Added inline Web Worker execution so graph analysis does not block the main browser interface.
- Added analysis cancellation, stale-result protection, worker error handling, rerun support, and automatic reset when another graph is loaded.
- Added terminal-state filtering, pagination with at most 100 results per page, and state navigation using the current neighborhood depth.
- Added cyclic-component minimum-size filtering, pagination with at most 100 results per page, and component-only graph views.
- Added user-facing sequential cyclic-component numbering independent of internal SCC identifiers.
- Added large synthetic tests for long acyclic graphs and large strongly connected components.
- Added worker-controller tests for success, failure, cancellation, reruns, stale responses, malformed responses, reset, and disposal.
- Added `sample-data/synthetic.json` with known terminal-state and SCC results for manual verification.

### Changed

- Kept graph analysis explicitly user-triggered instead of running automatically when a graph is loaded or when the Analysis tab is opened.
- Limited worker input to node IDs and edge topology instead of transferring markings, labels, inputs, outputs, or other semantic data.
- Kept terminal-state terminology separate from deadlock classification because successful completion and unintended deadlock cannot be distinguished from topology alone.
- Updated path selection to leave a component-only graph view before path construction begins.
- Preserved analysis results while switching between Inspector and Analysis tabs or navigating individual results.

### Fixed

- Fixed selected SCC views retaining states and transitions from the previously visible graph.
- Fixed cyclic components being displayed with confusing internal SCC IDs instead of sequential user-facing numbers.
- Fixed stale worker responses being able to affect a newer analysis request.
- Fixed worker cleanup during cancellation, reset, rerun, and component unmounting.

## [0.4.0](https://github.com/dbera/LTSVisualizer/compare/v0.3.0...v0.4.0) - 2026-08-06

### Added

- Added **Export graph JSON** to export every node and transition in the complete loaded graph independently of the visible neighborhood or selected path.
- Added graph-level JSON metadata containing the source title, state count, and transition count.
- Added safe filenames derived from the opened JSON filename for complete-graph exports.
- Added `outputs` and `outputs_raw` fields to graph edges for structured and original transition-output flows.
- Added validation requiring structured transition outputs to be objects whose output-place values are token arrays.
- Added backward-compatible normalization of omitted transition-output fields to `null`.
- Added transition Inspector support for structured and raw inputs and outputs.
- Added selected-path PlantUML comments for available transition outputs.
- Added a single-file offline build that packages the application into a double-clickable `LTSVisualizer.html` file.
- Added an offline HTML release workflow that runs frontend checks, builds `LTSVisualizer.html`, generates `SHA256SUMS.txt`, uploads manual workflow artifacts, and publishes tagged GitHub Releases.
- Added a GitHub Pages workflow for the standard static Vite build.
- Added frontend-only continuous integration for tests, linting, and production builds.
- Added `sample-data/example.json` as a small example graph.
- Added `sample-data/rg_imaging.json` as a larger, realistic reachability-graph example.
- Added unit-test coverage for complete-graph JSON round trips, parallel transitions, state markings, transition inputs and outputs, raw semantic values, colors, duplicate tokens, known empty outputs, unavailable outputs, and PlantUML path export.

### Changed

- Converted LTSVisualizer to a fully static, browser-only application.
- Changed graph input to JSON only. PlantUML remains available as a selected-path export format but is no longer accepted as input.
- Changed all graph parsing, validation, visualization, path selection, inspection, and export processing to run locally in the browser.
- Removed Axios and all frontend requests to a graph API.
- Removed the Vite backend proxy.
- Updated complete-graph and selected-path JSON serialization to retain `outputs` and `outputs_raw` on every edge.
- Updated complete-graph serialization to include `stateCount` and `transitionCount` metadata automatically.
- Updated Cytoscape edge data so transition outputs remain available during hover and pinned inspection.
- Renamed the transition Inspector category from **TRANSITION INPUTS** to **TRANSITION DATA**.
- Updated selected-path PlantUML export to prefer `outputs_raw`, fall back to structured `outputs`, preserve known empty output flows as `{}`, and omit output comments when output data is unavailable.
- Updated the toolbar with a graph-level JSON export action separate from selected-path export.
- Replaced the Windows executable release process with a cross-platform, self-contained HTML release.
- Updated Dependabot to monitor only frontend npm dependencies and GitHub Actions.
- Updated project documentation for the static architecture, JSON-only input, offline HTML distribution, static web deployment, and frontend-only development workflow.

### Removed

- Removed the Python and FastAPI backend.
- Removed PlantUML file import and backend PlantUML parsing.
- Removed the `/api/health`, `/graph`, and `/graph/upload` endpoints.
- Removed backend tests and Python dependency files.
- Removed the combined FastAPI production server and local launcher.
- Removed PyInstaller configuration and Windows executable packaging.
- Removed the Windows ZIP release workflow and unsigned executable distribution.
- Removed the obsolete PlantUML sample file.

### Fixed

- Fixed offline distribution by inlining the application JavaScript and CSS into a single HTML file.
- Fixed offline `file:///` startup by using a relative build base, disabling copied public assets, and removing the external favicon reference from the offline build.
- Fixed obsolete Dependabot jobs that continued checking Python packages in the deleted `/backend` directory.

## [0.3.0](https://github.com/dbera/LTSVisualizer/compare/v0.2.0...v0.3.0) - 2026-08-05

### Added

- Added manual path selection starting from the currently focused state.
- Added path extension through highlighted successor states and explicit **Choose next transition** controls.
- Added exact edge selection by unique edge ID for parallel and identically named transitions.
- Added support for loops, repeated states, and repeated transition traversals.
- Added **Undo**, **Restart path**, and **Clear path** controls.
- Added selected-path highlighting with distinct start, path, endpoint, and candidate colors.
- Added PlantUML export for selected paths.
- Added JSON import for complete LTS graphs directly in the browser.
- Added JSON export for selected paths as self-contained graph subsets.
- Added a versioned LTSVisualizer JSON document format for full graphs and selected paths.
- Added JSON graph validation for document structure, node IDs, edge IDs, source and target references, semantic fields, and selected-path connectivity.
- Added support for lightweight JSON graph documents without the optional LTSVisualizer format envelope.
- Added preservation of state markings, raw markings, transition inputs, raw inputs, transition colors, labels, and exact edge identities in JSON workflows.
- Added frontend-only JSON operation without requiring the FastAPI backend.
- Added unit tests for manual path selection, loops, repeated states, candidate transitions, parallel edges, path validation, JSON parsing, JSON validation, serialization, and round trips.

### Changed

- Renamed the file-open action from **Open PlantUML file** to **Open LTS Graph File**.
- Extended the file picker to accept JSON and PlantUML-family files.
- Changed JSON loading to parse and validate files locally in the frontend instead of sending them to FastAPI.
- Kept PlantUML loading through the FastAPI backend for compatibility with the existing parser.
- Changed reopened selected-path JSON files to load as regular graphs so search, neighborhood, layout, label, and **Show all** controls remain available.
- Distinguished unique graph nodes and edges from repeated state occurrences and transition steps in saved traversals.
- Extracted manual path-selection rules into a reusable, independently tested TypeScript module.
- Updated path candidate generation, endpoint resolution, extension, undo, and validation to use the shared path-selection module.
- Kept transition labels visible during path construction.
- Preserved node dragging, canvas panning, zooming, inspection, and manually adjusted positions during path selection.

### Fixed

- Fixed Cytoscape pointer and hit-detection offsets after the path controls changed the graph container position.
- Fixed node dragging becoming unavailable during path-selection mode.
- Fixed path visualization relayouts that caused selected graphs to jump or grow unexpectedly.
- Fixed stale unselected branches remaining visible after choosing a path continuation.
- Fixed TypeScript null narrowing around selected-path candidate generation.
- Fixed JSON parser handling of lightweight selected-path documents that specify `type` without `format` and `version`.
- Fixed a build failure caused by an unused test import.
- Fixed reopened selected-path JSON files being locked in active path-selection mode with exploration controls disabled.

## [0.2.0](https://github.com/dbera/LTSVisualizer/compare/v0.1.1...v0.2.0) - 2026-08-05

### Added

- Added a reusable `JsonViewer` React component for structured state-marking and transition-input data.
- Added syntax-colored JSON rendering for keys, strings, numbers, booleans, null values, and punctuation.
- Added individual expand-and-collapse controls for nested objects and arrays.
- Added global **Expand all** and **Collapse all** controls.
- Added collection-size summaries for collapsed arrays and objects.
- Added clear indicators for empty arrays and objects.
- Added a **Copy JSON** action with temporary success and failure feedback.
- Added responsive JSON-viewer controls for narrow browser windows.
- Added dedicated JSON-viewer styling.

### Changed

- Updated the frontend to retain structured marking and transition-input values instead of converting them to preformatted JSON strings.
- Updated the inspector to render state and transition data through the `JsonViewer` component.
- Preserved hover inspection and click-to-pin behavior while integrating the structured-data viewer.
- Reset JSON-viewer expansion state when a different state or transition is selected.
- Limited initial expansion depth so large nested values remain manageable.
- Improved readability and navigation of deeply nested state markings and transition inputs.
- Removed obsolete styling for the previous plain `<pre>` inspector representation.
- Kept the frontend upload endpoint relative so development proxy mode, combined production mode, and packaged Windows mode used the same frontend bundle.

### Fixed

- Fixed the combined production frontend after an obsolete hardcoded backend upload URL was detected in generated JavaScript.
- Fixed production graph uploads by restoring the relative upload endpoint and rebuilding frontend assets.
- Fixed inspector styling conflicts left by the previous plain-text JSON representation.

## [0.1.1](https://github.com/dbera/LTSVisualizer/compare/v0.1.0...v0.1.1) - 2026-08-05

### Added

- Added a combined production mode in which FastAPI served the built React frontend and graph API.
- Added a local launcher for the combined application.
- Added reproducible Windows packaging with PyInstaller.
- Added an automated Windows release workflow and SHA-256 checksums.
- Added Windows binary installation, verification, and SmartScreen guidance.

### Changed

- Changed the frontend upload endpoint to a relative path.
- Added a Vite proxy for graph requests during development.
- Changed production architecture so the React frontend and API were served by one local FastAPI process.
- Updated resource handling for bundled assets and sample data.
- Updated the Windows workflow so manual artifacts extracted directly to the executable and its supporting directory.
- Moved the health endpoint to `/api/health`.

### Fixed

- Fixed frontend and sample-data paths in the PyInstaller bundle.
- Fixed Uvicorn startup in the packaged executable.
- Fixed confusing nested packaging in manually downloaded workflow artifacts.
- Fixed outdated development and production instructions.
- Fixed malformed changelog comparison links.

### Security

- Added SHA-256 checksum generation for Windows release ZIP files.
- Documented checksum verification, ZIP unblocking, and unsigned-executable SmartScreen behavior.

## [0.1.0](https://github.com/dbera/LTSVisualizer/releases/tag/v0.1.0) - 2026-08-05

### Added

- Added a FastAPI backend for parsing and serving reachability-graph data.
- Added browser-based upload of PlantUML graph files.
- Added parsing for directed state-transition graphs, colored arrows, semantic comments, state markings, transition inputs, and terminal states.
- Added a React and TypeScript frontend built with Vite.
- Added interactive graph rendering with Cytoscape.js.
- Added state search, neighborhood exploration, full-graph overview, hierarchical and grid layouts, label toggling, pan, zoom, selection, and node repositioning.
- Added hover and pinned inspection for state markings and transition inputs.
- Added responsive graph and inspector layouts.
- Added rendering safeguards for state spaces containing thousands of nodes.
- Added sample PlantUML data, backend dependency files, and project documentation.

### Changed

- Changed large graphs to open in a local neighborhood instead of an expensive global force-directed layout.
- Hid transition labels by default for large graphs.
- Used a natural canvas scale so users could pan and zoom instead of forcing the graph to fill the viewport.
- Retained the selected neighborhood state when switching to the full-graph overview.
- Applied layout selection to neighborhood and full-graph views.

### Fixed

- Fixed terminal-state marking assignment when the final state had no outgoing transition.
- Fixed transition-label rotation and spacing.
- Fixed full-graph rendering of small linear state spaces as an oversized grid.
- Fixed neighborhood controls becoming disabled after selecting full-graph view.
- Fixed direct node dragging requiring prior selection.
- Fixed automatic loading of a development graph.
- Fixed browser freezing caused by force-directed layout on very large graphs.

### Security

- Validated uploaded file extensions and basic PlantUML content.
- Rejected invalid UTF-8 uploads.
- Parsed uploaded files in memory rather than intentionally persisting them.

## Release process

When preparing a release:

1. Move completed entries from **Unreleased** into a versioned section.
2. Add the release date in `YYYY-MM-DD` format.
3. Update version references in project metadata when applicable.
4. Run frontend tests, linting, the standard build, and the offline build.
5. Manually run the offline HTML workflow and verify the downloaded `LTSVisualizer.html` through a `file:///` URL.
6. Create and push an annotated Git tag.
7. Confirm that the tag-triggered workflow publishes `LTSVisualizer.html` and `SHA256SUMS.txt` to the GitHub Release.

Example:

```markdown
## [0.5.0] - YYYY-MM-DD
```

## Versioning guidance

Until the project reaches version 1.0.0:

- Increment the patch version for compatible fixes, packaging changes, and documentation updates.
- Increment the minor version for new features, meaningful UI changes, or architecture changes.
- Clearly document breaking changes, even during the `0.x` development period.

After version 1.0.0, use Semantic Versioning:

- **MAJOR** for incompatible changes.
- **MINOR** for backward-compatible functionality.
- **PATCH** for backward-compatible fixes.
