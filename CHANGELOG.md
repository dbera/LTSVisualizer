# Changelog

All notable changes to LTSVisualizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project intends to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) after the first public release.

## [Unreleased]

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
5. Create an annotated Git tag.
6. Publish a GitHub Release containing installation and upgrade notes.

Example:

```text
## [0.1.0] - 2026-08-05
```

## Versioning guidance

Until the project reaches version `1.0.0`:

- Increment the patch version for compatible fixes and documentation updates.
- Increment the minor version for new features or meaningful parser and UI changes.
- Clearly document breaking changes, even during the `0.x` development period.

After version `1.0.0`, use Semantic Versioning:

- **MAJOR** for incompatible changes.
- **MINOR** for backward-compatible functionality.
- **PATCH** for backward-compatible fixes.

[Unreleased]: https://github.com/dbera/LTSVisualizer/compare/main...HEAD
