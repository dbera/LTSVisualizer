## Summary

<!-- Briefly describe what this pull request changes and why. -->

## Related issue

<!-- Link the related issue, for example: Closes #123. -->

Closes #

## Type of change

Select all that apply:

- [ ] Bug fix
- [ ] New feature
- [ ] Parser or input-format change
- [ ] Graph visualization or interaction change
- [ ] Performance improvement
- [ ] Refactoring with no intended behavior change
- [ ] Test improvement
- [ ] Documentation update
- [ ] Dependency or maintenance update
- [ ] Breaking change

## Changes made

<!-- List the important implementation changes. -->

-
-
-

## Motivation and context

<!-- Explain the problem this change solves and why the chosen approach is appropriate. -->

## Testing performed

Describe the automated and manual checks completed for this change.

### Backend

- [ ] `python -m pytest backend/tests`
- [ ] FastAPI starts without errors
- [ ] Relevant API endpoint tested through `/docs` or an HTTP client
- [ ] Not applicable

### Frontend

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Vite development server starts without errors
- [ ] Tested in a supported browser
- [ ] Not applicable

### Manual graph checks

Select the checks that apply:

- [ ] Opened a small linear graph
- [ ] Opened a graph containing branches or cycles
- [ ] Opened a large graph
- [ ] Verified parsed state and transition counts
- [ ] Verified state marking inspection
- [ ] Verified transition-input inspection
- [ ] Verified state search
- [ ] Verified one-, two-, and three-hop neighborhoods
- [ ] Verified hierarchical layout
- [ ] Verified grid layout
- [ ] Verified transition-label toggle
- [ ] Verified node dragging, panning, and zooming
- [ ] Not applicable

## Test data

<!-- Describe the test files used. Do not attach confidential or proprietary state spaces. -->

- [ ] Any committed or attached test data is publicly shareable.
- [ ] Test data contains no confidential, proprietary, personal, or security-sensitive information.
- [ ] Large regression data has been reduced to a minimal example where practical.
- [ ] No test data is included.

## Screenshots or recordings

<!-- For visible user-interface changes, add before-and-after screenshots or a short recording. Remove sensitive information first. -->

## Parser compatibility

Complete this section when changing parsing behavior.

- [ ] Plain arrows such as `-->` remain supported.
- [ ] Colored arrows such as `-[#darkorange]->` remain supported.
- [ ] HTML-escaped arrows such as `--&gt;` remain supported.
- [ ] Optional transition-input comments remain supported.
- [ ] Optional marking comments remain supported.
- [ ] Terminal-state markings remain supported.
- [ ] Nested JSON values remain supported.
- [ ] Files without semantic comments remain supported.
- [ ] Duplicate or parallel transitions were considered.
- [ ] Not applicable

## Performance impact

<!-- Describe any expected effect on parsing time, browser rendering, memory use, layout time, or interaction with large graphs. -->

- [ ] No meaningful performance impact is expected.
- [ ] Performance was measured or manually evaluated.
- [ ] The change may affect large graphs and the impact is explained below.

Details:

## Compatibility and migration

- [ ] This change is backward compatible.
- [ ] This change modifies an API response.
- [ ] This change modifies supported PlantUML syntax.
- [ ] This change modifies a user workflow.
- [ ] This change requires migration steps documented below.

Migration or compatibility notes:

## Documentation

- [ ] README updated when needed
- [ ] CHANGELOG updated when needed
- [ ] CONTRIBUTING updated when needed
- [ ] API or input-format documentation updated when needed
- [ ] No documentation change is needed

## Security and privacy

- [ ] This pull request does not expose credentials, tokens, private paths, or confidential data.
- [ ] Uploaded-file handling remains appropriately validated.
- [ ] User-supplied content is not rendered as unsafe HTML.
- [ ] New or updated dependencies were reviewed.
- [ ] Security implications are described below, or no security impact is expected.

Security notes:

## Contributor checklist

- [ ] I have read `CONTRIBUTING.md`.
- [ ] The change is focused and does not include unrelated modifications.
- [ ] The code is understandable and contains no unnecessary debugging output.
- [ ] New behavior includes tests where practical.
- [ ] Existing checks pass locally.
- [ ] I have reviewed my own changes.
- [ ] I agree that this contribution will be licensed under the MIT License.

## Additional notes

<!-- Add anything else reviewers should know. -->
