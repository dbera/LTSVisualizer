# Contributing to LTSVisualizer

Thank you for considering a contribution to LTSVisualizer.

Contributions may include bug fixes, parser improvements, visualization features, documentation, tests, performance improvements, and example reachability graphs that can be shared publicly.

## Before contributing

Please check the existing GitHub issues before opening a new issue or starting a substantial change. For larger features or changes to the input format, open an issue first so the proposed design can be discussed before implementation begins.

Do not include confidential models, proprietary state spaces, access tokens, passwords, personal information, or other restricted data in issues, pull requests, test files, screenshots, or commits.

## Ways to contribute

You can contribute by:

- Reporting reproducible bugs.
- Suggesting focused enhancements.
- Improving PlantUML parsing compatibility.
- Adding parser and API tests.
- Improving graph layout and interaction behavior.
- Improving accessibility and usability.
- Improving documentation.
- Adding small, publicly shareable sample graphs.
- Investigating performance with large state spaces.

## Reporting a bug

A useful bug report should contain:

1. A clear and descriptive title.
2. The LTSVisualizer version or commit hash.
3. Your operating system and browser.
4. Your Python and Node.js versions.
5. Exact steps to reproduce the problem.
6. The expected behavior.
7. The actual behavior.
8. Relevant backend or browser-console errors.
9. A minimal, non-confidential PlantUML example when possible.

Please reduce large input files to the smallest example that still demonstrates the problem.

## Suggesting an enhancement

Feature requests should explain:

- The problem being addressed.
- The intended user workflow.
- Why the existing behavior is insufficient.
- A small example or mock-up when useful.
- Any expected effect on large-graph performance.

## Development setup

### Prerequisites

Install:

- Git
- Python 3.11 or newer
- Node.js 22 LTS or newer
- npm

### Fork and clone

Fork the repository on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR-USERNAME/LTSVisualizer.git
cd LTSVisualizer
```

Add the original repository as the upstream remote:

```bash
git remote add upstream https://github.com/dbera/LTSVisualizer.git
git fetch upstream
```

### Backend setup

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements-dev.txt
```

On Linux or macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements-dev.txt
```

Run the backend:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend is normally available at `http://localhost:5173`.

## Branch workflow

Start from an up-to-date `main` branch:

```bash
git checkout main
git pull upstream main
```

Create a focused branch:

```bash
git checkout -b type/short-description
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
feature/shortest-path-search
fix-terminal-state-marking
docs/parser-format
```

## Coding guidelines

### General

- Keep each pull request focused on one problem.
- Prefer small, readable functions over large multi-purpose functions.
- Use descriptive names and avoid unexplained abbreviations.
- Remove debugging output before submitting a pull request.
- Do not commit generated dependencies or local environment files.
- Preserve backward compatibility with existing supported PlantUML inputs where practical.

### Python

- Use four spaces for indentation.
- Add type annotations to new public functions where practical.
- Use `pathlib.Path` for filesystem paths.
- Raise or return clear errors for invalid input.
- Keep parsing logic separate from HTTP endpoint logic.
- Add tests for parser behavior and edge cases.

### TypeScript and React

- Use TypeScript interfaces or types for API data.
- Avoid `any` unless no safer representation is practical.
- Keep API communication, graph transformation, and UI interaction logically separated.
- Clean up Cytoscape event handlers and instances when React components unmount.
- Consider responsiveness and large-graph performance for visualization changes.
- Preserve keyboard-accessible controls and meaningful labels.

### PlantUML parser changes

Parser contributions should consider:

- Plain arrows such as `-->`.
- Colored arrows such as `-[#darkorange]->`.
- HTML-escaped arrows such as `--&gt;`.
- Optional transition-input comments.
- Optional marking comments.
- Terminal-state markings after the final edge.
- Nested JSON objects and arrays.
- Delimiters inside quoted JSON strings.
- Files without semantic comments.
- Duplicate or parallel transitions.
- Clear behavior for malformed lines.

## Tests and checks

Before submitting a pull request, run the relevant checks.

### Backend

From the repository root:

```bash
python -m pytest backend/tests
```

### Frontend

From the `frontend` directory:

```bash
npm run lint
npm run build
```

Also perform a manual smoke test:

1. Start the backend and frontend.
2. Open a small sample graph.
3. Verify state and transition counts.
4. Inspect a marking and transition input.
5. Search for a state.
6. Test one-, two-, and three-hop neighborhoods.
7. Test hierarchical and grid layouts.
8. Toggle transition labels.
9. Open a larger graph and verify that interaction remains responsive.

## Test data

Test data committed to the repository must be:

- Publicly shareable.
- Minimal enough to review.
- Free of personal or confidential information.
- Accompanied by a short explanation when the purpose is not obvious.

Large generated graphs should normally not be committed. Prefer a reduced regression example that captures the relevant parser or visualization behavior.

## Commit messages

Write concise, imperative commit messages.

Good examples:

```text
Add terminal-state marking test
Fix parsing of HTML-escaped arrows
Document neighborhood exploration
```

Avoid vague messages such as:

```text
Changes
Update stuff
Fix
```

## Pull requests

A pull request should:

- Explain what changed and why.
- Link to the related issue when applicable.
- Describe how the change was tested.
- Include screenshots for visible UI changes.
- Mention compatibility or performance implications.
- Avoid unrelated formatting or refactoring.
- Pass the automated checks.

Maintainers may request changes before merging. Please keep discussion technical, respectful, and focused on improving the project.

## Documentation

Update documentation when changing:

- Installation steps.
- Required dependencies.
- Supported PlantUML syntax.
- API behavior.
- User-visible controls.
- File formats.
- Known limitations.

## Security issues

Do not report suspected vulnerabilities in a public issue. Follow the private reporting instructions in [`SECURITY.md`](SECURITY.md).

## License

By submitting a contribution, you agree that your contribution will be licensed under the repository's MIT License.

## Questions

If the contribution process is unclear, open a GitHub Discussion or a focused issue describing the question.
