# Changelog

All notable changes to LTSVisualizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added **Export graph JSON** to export every node and transition in the complete loaded graph, independently of the currently visible neighborhood or selected path.
- Added graph-level JSON metadata containing the source title, state count, and transition count.
- Added safe filenames derived from the opened source filename for complete-graph JSON downloads.
- Added unit-test coverage for complete-graph JSON round trips, parallel transitions, state markings, transition inputs, raw semantic values, and transition colors.
- Added documentation for complete-graph JSON export and the backend-independent PlantUML-to-JSON workflow.

### Changed

- Updated complete graph JSON serialization to include `stateCount` and `transitionCount` metadata automatically.
- Updated the frontend toolbar with a graph-level JSON export action separate from selected-path export.
- Updated the README architecture, verification checklist, limitations, and roadmap after completing full-graph JSON export.

## [0.3.0] - 2026-08-05

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
- Extended the file picker to accept `.json`, `.puml`, `.plantuml`, and compatible `.txt` files.
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
- Fixed path visualization relayouts that caused selected graphs to jump or grow in unexpected directions.
- Fixed stale unselected branches remaining visible after choosing a path continuation.
- Fixed TypeScript null narrowing around selected-path candidate generation.
- Fixed JSON parser handling of lightweight selected-path documents that specify `type` without `format` and `version`.
- Fixed a build failure caused by an unused test import.
- Fixed reopened selected-path JSON files being locked in active path-selection mode with exploration controls disabled.

## [0.2.0] - 2026-08-05

### Added

- Added a reusable `JsonViewer` React component for structured state-marking and transition-input data.
- Added syntax-colored JSON rendering for keys, strings, numbers, booleans, null values, and punctuation.
- Added individual expand-and-collapse controls for nested objects and arrays.
- Added global **Expand all** and **Collapse all** controls.
- Added collection-size summaries for collapsed arrays and objects.
- Added clear indicators for empty arrays and objects.
- Added a **Copy JSON** action with temporary success and failure feedback.
- Added responsive JSON-viewer controls for narrow browser windows.
- Added dedicated JSON-viewer styling in `frontend/src/components/JsonViewer.css`.

### Changed

- Updated `frontend/src/App.tsx` to retain structured marking and transition-input values instead of converting them to preformatted JSON strings.
- Updated the inspector to render state and transition data through the new `JsonViewer` component.
- Preserved hover inspection and click-to-pin behavior while integrating the structured-data viewer.
- Reset JSON-viewer expansion state when a different state or transition is selected.
- Limited the initial expansion depth so large nested values remain manageable.
- Improved the readability and navigation of deeply nested state markings and transition inputs.
- Updated `frontend/src/App.css` to remove obsolete styling for the previous plain `<pre>` inspector representation.
- Kept the frontend upload endpoint relative as `/graph/upload` so development proxy mode, combined production mode, and packaged Windows mode use the same frontend bundle.

### Fixed

- Fixed the combined production frontend after an obsolete hardcoded `http://127.0.0.1:8000/graph/upload` endpoint was detected in the generated JavaScript bundle.
- Fixed production graph uploads by restoring the relative `/graph/upload` endpoint and rebuilding the frontend assets.
- Fixed inspector styling conflicts left by the previous plain-text JSON representation.

## [0.1.1] - 2026-08-05

### Added

- Added a combined production mode in which FastAPI serves both the built React frontend and the graph API.
- Added `backend/launcher.py` to start the local application server, select an available port, and open the dashboard in the default browser.
- Added `LTSVisualizer.spec` for reproducible Windows packaging with PyInstaller.
- Added an automated Windows release workflow using GitHub Actions.
- Added automatic creation of `LTSVisualizer-Windows-x64.zip` and `SHA256SUMS.txt` for tagged releases.
- Added directly testable Windows workflow artifacts for manually triggered release builds.
- Added Windows binary download, checksum verification, ZIP unblocking, and SmartScreen guidance to the README.
- Added developer documentation for development mode, combined production mode, local Windows packaging, and automated GitHub Releases.

### Changed

- Changed the frontend upload endpoint to the relative path `/graph/upload`.
- Added a Vite development proxy that forwards `/graph` requests to the FastAPI backend on port `8000`.
- Changed the production architecture so the React frontend and API are served from one local FastAPI and Uvicorn process.
- Updated application resource handling to locate bundled frontend assets and sample data inside a PyInstaller package.
- Updated the Windows release workflow so manual test artifacts extract directly to `LTSVisualizer.exe` and `_internal` without an additional application ZIP layer.
- Updated the project structure, API, testing, packaging, and release documentation.
- Moved the health endpoint to `GET /api/health`.

### Fixed

- Fixed frontend and sample-data paths when running from a PyInstaller bundle.
- Fixed Uvicorn startup in the packaged executable by passing the FastAPI application object directly to Uvicorn.
- Fixed confusing nested packaging in manually downloaded GitHub Actions artifacts.
- Fixed outdated README instructions that only described the separate Vite and FastAPI development servers.
- Fixed malformed changelog comparison links.

### Security

- Added SHA-256 checksum generation for Windows release ZIP files.
- Documented checksum verification before running downloaded binaries.
- Documented the Windows `Unblock-File` procedure for ZIP files downloaded from the official GitHub Release.
- Documented that the current Windows executable is unsigned and may trigger Microsoft Defender SmartScreen.

## [0.1.0] - 2026-08-05

### Added

- FastAPI backend for parsing and serving reachability-graph data.
- Browser-based upload of `.puml`, `.plantuml`, and compatible `.txt` files.
- PlantUML parser for directed state-transition graphs.
- Support for plain and colored PlantUML arrows.
- Support for HTML-escaped PlantUML arrow characters.
- Extraction of state IDs, transition names, source states, target states, and edge colors.
- Parsing of structured `Transition Inputs` comments.
- Parsing of structured `Marking (State)` comments.
- Support for terminal-state markings placed after the final transition.
- React and TypeScript frontend built with Vite.
- Interactive graph rendering with Cytoscape.js.
- State search by node ID.
- One-, two-, and three-hop neighborhood exploration.
- Full-graph overview mode.
- Hierarchical and grid layout options for all graph views.
- Transition-label visibility toggle.
- Mouse-based pan, zoom, selection, and direct node repositioning.
- Hover inspection for state markings and transition inputs.
- Click-to-pin inspector behavior.
- Responsive graph and inspector layout.
- Fast rendering fallback for state spaces containing thousands of nodes.
- Sample PlantUML data for local development.
- Backend runtime and development dependency files.
- Project README with installation, usage, architecture, and input-format documentation.
- Contribution and security policies.

### Changed

- Large graphs now open in a local neighborhood instead of attempting an expensive global force-directed layout.
- Transition labels are hidden by default for large graphs to improve rendering performance.
- Graph layouts use a natural canvas scale so users can pan and zoom instead of forcing every graph to fill the viewport.
- The selected neighborhood state is retained when switching to the full-graph overview.
- Layout selection now applies to both neighborhood and full-graph views.

### Fixed

- Fixed terminal-state marking assignment when the final state has no outgoing transition.
- Fixed transition labels being rotated vertically on directed graph edges.
- Fixed excessive spacing between transition labels and edges.
- Fixed full-graph rendering of small linear state spaces as an oversized grid.
- Fixed one-, two-, and three-hop controls becoming disabled after selecting the full-graph view.
- Fixed direct node dragging requiring a prior selection.
- Fixed automatic loading of a development graph before the user selects a file.
- Fixed browser freezing caused by applying a force-directed layout to very large graphs.

### Security

- Uploaded graph files are validated by extension and basic PlantUML content.
- Uploaded content is decoded as UTF-8 and rejected when decoding fails.
- Uploaded files are parsed in memory rather than intentionally persisted by the application.

## Release process

When preparing a release:

1. Move completed entries from `Unreleased` into a versioned section.
2. Add the release date in `YYYY-MM-DD` format.
3. Update version references in project metadata when applicable.
4. Run backend tests and frontend checks.
5. Verify the Windows package locally or through a manually triggered release workflow.
6. Create and push an annotated Git tag.
7. Confirm that the tag-triggered workflow publishes the GitHub Release and its binary assets.

Example:

```text
## [0.3.1] - 2026-08-05
```

## Versioning guidance

Until the project reaches version `1.0.0`:

- Increment the patch version for compatible fixes, packaging changes, and documentation updates.
- Increment the minor version for new features or meaningful parser and UI changes.
- Clearly document breaking changes, even during the `0.x` development period.

After version `1.0.0`, use Semantic Versioning:

- **MAJOR** for incompatible changes.
- **MINOR** for backward-compatible functionality.
- **PATCH** for backward-compatible fixes.

[Unreleased]: https://github.com/dbera/LTSVisualizer/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/dbera/LTSVisualizer/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dbera/LTSVisualizer/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/dbera/LTSVisualizer/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/dbera/LTSVisualizer/releases/tag/v0.1.0
