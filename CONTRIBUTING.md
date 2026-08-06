# Contributing to LTSVisualizer

Thank you for considering a contribution to LTSVisualizer.

LTSVisualizer is a static, browser-based application for exploring labelled transition systems and reachability graphs stored as JSON. All graph loading, validation, visualization, inspection, path selection, and export processing occurs locally in the browser.

Contributions may include bug fixes, visualization features, JSON validation improvements, documentation, tests, accessibility improvements, performance improvements, and publicly shareable example graphs.

## Before contributing

Check the existing GitHub issues before opening a new issue or starting a substantial change.

For larger features, changes to the JSON format, or changes affecting exported documents, open an issue first so the design and compatibility implications can be discussed.

Do not include confidential models, proprietary state spaces, access tokens, passwords, personal information, or other restricted data in:

- Issues
- Discussions
- Pull requests
- Test files
- Sample files
- Screenshots
- Commits
- Workflow artifacts

## Ways to contribute

Contributions may include:

- Reporting reproducible bugs
- Suggesting focused enhancements
- Improving JSON parsing and validation
- Improving graph layout and interaction behavior
- Improving state and transition inspection
- Improving manual path selection
- Improving JSON or PlantUML export
- Adding unit and regression tests
- Improving accessibility and usability
- Improving documentation
- Adding small, publicly shareable JSON graphs
- Investigating performance with large state spaces
- Improving the static web or offline HTML builds

PlantUML is supported as a selected-path export format. PlantUML file import is not supported.

## Reporting a bug

A useful bug report should include:

- A clear and descriptive title
- The LTSVisualizer version, release, or commit hash
- Whether the online application or offline `LTSVisualizer.html` was used
- The operating system and browser
- Exact steps to reproduce the problem
- The expected behavior
- The actual behavior
- Relevant browser-console errors
- A minimal, non-confidential JSON example when possible
- Whether the issue occurs with `sample-data/example.json`
- Whether the issue occurs through both HTTP and a local `file:///` URL, when relevant

Reduce large input files to the smallest publicly shareable example that still demonstrates the problem.

Do not attach confidential or proprietary graph files. Replace domain-specific values with safe example data where necessary.

## Suggesting an enhancement

A feature request should explain:

- The problem being addressed
- The intended user workflow
- Why the existing behavior is insufficient
- A small example or mock-up when useful
- Any expected effect on large-graph performance
- Any effect on the JSON input format
- Any effect on complete-graph or selected-path exports
- Whether the feature must work in the offline `file:///` build

## Development setup

### Prerequisites

Install:

- Git
- Node.js 22 or newer
- npm

Python and a backend server are not required.

### Fork and clone

Fork the repository on GitHub, then clone the fork:

```bash
git clone https://github.com/YOUR-USERNAME/LTSVisualizer.git
cd LTSVisualizer
```

Add the original repository as the upstream remote:

```bash
git remote add upstream https://github.com/dbera/LTSVisualizer.git
git fetch upstream
```

### Install frontend dependencies

From the repository root:

```bash
cd frontend
npm install
```

For deterministic builds with an existing lockfile, use:

```bash
npm ci
```

Do not use `npm ci` when intentionally changing dependencies, because dependency changes must update `package-lock.json`.

### Start the development server

From `frontend`:

```bash
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

No separate backend process is required.

## Branch workflow

Start from an up-to-date `main` branch:

```bash
git switch main
git pull upstream main
```

Create a focused branch:

```bash
git switch -c type/short-description
```

Recommended branch prefixes:

- `feature/` for new functionality
- `fix/` for bug fixes
- `docs/` for documentation
- `test/` for tests
- `refactor/` for behavior-preserving code changes
- `chore/` for maintenance

Examples:

```text
feature/constrained-graph-search
fix-parallel-edge-selection
docs/json-input-format
test-empty-transition-outputs
refactor/graph-loading
```

## Coding guidelines

### General

- Keep each pull request focused on one problem.
- Prefer small, readable functions over large multi-purpose functions.
- Use descriptive names and avoid unexplained abbreviations.
- Remove debugging output before submitting a pull request.
- Do not commit generated dependencies or local environment files.
- Do not commit `node_modules`.
- Do not commit `frontend/dist` or `frontend/dist-offline`.
- Preserve compatibility with supported JSON documents where practical.
- Clearly document intentional breaking changes.
- Consider both normal web hosting and local `file:///` execution.
- Consider responsiveness and large-graph performance.
- Avoid introducing a server dependency for functionality that can run locally in the browser.

### TypeScript and React

- Use explicit TypeScript interfaces or types for graph and UI data.
- Avoid `any` unless no safer representation is practical.
- Keep graph parsing, validation, transformation, visualization, and UI interaction logically separated.
- Keep reusable graph rules outside React components where practical.
- Clean up Cytoscape event handlers and instances when components unmount.
- Preserve keyboard-accessible controls and meaningful labels.
- Provide clear error messages for invalid JSON.
- Avoid HTML injection when rendering graph-provided labels or semantic values.
- Preserve the distinction between omitted, `null`, and explicitly empty semantic data where required by the JSON model.

### JSON format changes

Changes to the JSON input or export format should consider:

- Backward compatibility
- Complete graph documents
- Lightweight graph documents without the optional format envelope
- Selected-path documents
- Unique node IDs
- Unique edge IDs
- Source and target references
- Parallel edges
- Loops
- Repeated state occurrences
- Repeated edge traversals
- Structured and raw state markings
- Structured and raw transition inputs
- Structured and raw transition outputs
- Missing, `null`, and explicitly empty values
- Token order and duplicate token occurrences
- Transition labels and colors
- Clear validation errors for malformed documents
- Round-trip behavior through import and export

Any format change should include tests and corresponding documentation updates.

### PlantUML export changes

PlantUML is an export-only format.

Changes to PlantUML export should consider:

- Transition order
- Parallel-edge identity
- Loops and repeated traversals
- Transition labels
- Transition colors
- State markings
- Transition inputs
- Transition outputs
- Raw semantic values
- Known empty output flows
- Unavailable output information
- Escaping of values that could affect PlantUML syntax

LTSVisualizer does not reopen or parse exported PlantUML files. Use a PlantUML-compatible tool to validate changes to this export format.

### Offline build changes

The offline build must remain usable as a self-contained file opened through a URL beginning with:

```text
file:///
```

Changes affecting the offline build should verify that:

- `npm run build:offline` succeeds
- The release contains no required external JavaScript or CSS files
- The application renders without Vite or another local server
- JSON file selection works
- Graph exploration works
- Inspector behavior works
- Path selection and Undo work
- JSON exports download correctly
- PlantUML path export downloads correctly
- There are no significant browser-console errors

Do not treat a test through an IDE preview server or `localhost` as proof that the `file:///` release works.

## Tests and checks

Before submitting a pull request, run all frontend checks from the `frontend` directory:

```bash
npm test
npm run lint
npm run build
npm run build:offline
```

### Automated test expectations

Add or update tests when changing:

- JSON parsing
- JSON validation
- JSON normalization
- Complete-graph serialization
- Selected-path serialization
- Manual path selection
- Candidate transition generation
- Undo behavior
- Loops
- Repeated states or edges
- Parallel transitions
- State markings
- Transition inputs or outputs
- Raw semantic values
- Transition colors
- PlantUML path export

### Manual smoke test

For user-visible or graph-processing changes:

1. Start the Vite development server.
2. Open `sample-data/example.json`.
3. Open `sample-data/rg_imaging.json` when large-graph behavior is relevant.
4. Verify state and transition counts.
5. Search for a state.
6. Test one-, two-, and three-hop neighborhoods.
7. Test **Show all**.
8. Test hierarchical and grid layouts.
9. Toggle transition labels.
10. Inspect state markings.
11. Inspect transition inputs and outputs.
12. Pin and clear inspector content.
13. Select a path.
14. Test loops or parallel transitions when relevant.
15. Test **Undo**, **Restart path**, and **Clear path**.
16. Export the complete graph as JSON.
17. Export a selected path as JSON.
18. Export a selected path as PlantUML.
19. Reopen exported JSON documents.
20. Confirm there are no significant browser-console errors.

For changes affecting distribution, also build the offline version and open it directly through `file:///`.

## Test and sample data

Test and sample data committed to the repository must be:

- Publicly shareable
- Free of personal or confidential information
- Free of proprietary model details
- Small enough to review, unless a larger graph is needed for a documented performance or scale scenario
- Accompanied by a short explanation when its purpose is not obvious

Prefer a reduced regression example that captures the relevant behavior.

A large graph may be included when the size itself is necessary to test rendering, navigation, or performance. Explain why the larger file is needed.

Current sample graphs are:

- `sample-data/example.json`
- `sample-data/rg_imaging.json`

## Commit messages

Write concise, imperative commit messages.

Good examples:

```text
Add transition output validation
Fix parallel edge path selection
Document offline HTML verification
Improve large graph overview rendering
```

Avoid vague messages such as:

```text
Changes
Update stuff
Fix
Miscellaneous improvements
```

## Pull requests

A pull request should:

- Explain what changed and why
- Link to the related issue when applicable
- Describe how the change was tested
- Include screenshots for visible UI changes
- Mention JSON compatibility implications
- Mention export-format implications
- Mention offline `file:///` implications when relevant
- Mention performance implications for large graphs
- Avoid unrelated formatting or refactoring
- Pass all automated checks

Maintainers may request changes before merging. Keep discussions technical, respectful, and focused on improving the project.

## Documentation

Update documentation when changing:

- Developer prerequisites
- Development commands
- User-visible controls
- JSON input structure
- Validation behavior
- Export formats
- Build behavior
- GitHub Pages deployment
- Offline HTML distribution
- Release workflow
- Supported browsers or operating environments
- Known limitations

Update `CHANGELOG.md` for notable user-facing, architectural, format, testing, or release changes.

## Dependency changes

When adding or updating a dependency:

- Explain why the dependency is needed.
- Prefer actively maintained packages.
- Avoid large dependencies for small tasks.
- Update `package-lock.json`.
- Run the complete test, lint, standard-build, and offline-build checks.
- Verify whether the dependency works in the offline `file:///` build.
- Review browser and build-system compatibility.

Dependabot monitors frontend npm dependencies and GitHub Actions.

## Security issues

Do not report suspected vulnerabilities through a public issue, discussion, or pull request.

Follow the private reporting instructions in SECURITY.md.

## License

By submitting a contribution, you agree that the contribution will be licensed under the repository's MIT License.

## Questions

If the contribution process is unclear, open a GitHub Discussion or a focused issue describing the question. Do not include confidential graph data or vulnerability details.
