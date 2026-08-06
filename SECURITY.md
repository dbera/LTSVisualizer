# Security Policy

## Supported versions

LTSVisualizer is under active development and has not yet reached a stable major release.

Security fixes are applied to the latest version of the `main` branch. Older commits, older releases, forks, and unofficial builds are not actively supported.

| Version | Supported |
|---|---|
| Latest `main` branch | Yes |
| Latest official release | Yes |
| Older commits or releases | No |
| Third-party forks or unofficial builds | No |

## Reporting a vulnerability

Do not report suspected security vulnerabilities through:

- Public GitHub issues
- GitHub Discussions
- Pull requests
- Social-media posts
- Public chat messages

Use GitHub's private vulnerability-reporting feature for this repository when available:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Provide the information requested below.

Repository:

```text
https://github.com/dbera/LTSVisualizer
```

If private vulnerability reporting is unavailable, contact the repository owner through the contact method listed on the GitHub profile. Do not include sensitive exploit details in a public message.

## Information to include

A useful vulnerability report should include:

- A clear description of the vulnerability
- The affected LTSVisualizer version, release, or commit hash
- Whether the online application or offline `LTSVisualizer.html` is affected
- The affected component, such as JSON validation, Cytoscape rendering, export generation, the offline build, or a GitHub Actions workflow
- The operating system and browser used during testing
- Exact reproduction steps
- A minimal proof of concept, when safe to provide
- The potential security impact
- Any known mitigations or suggested corrections
- Whether the issue has been disclosed to anyone else

Remove confidential, proprietary, personal, or unrelated information from all reports and examples.

Do not attach a confidential graph file. Create a reduced synthetic example that demonstrates the issue safely.

## Expected response process

The project maintainer will make a reasonable effort to:

- Acknowledge receipt of the report
- Confirm whether the behavior can be reproduced
- Assess severity and affected versions
- Identify any affected online or offline distribution
- Develop and test a correction when required
- Coordinate disclosure after a fix or mitigation is available

Response and resolution times depend on the complexity and severity of the issue.

LTSVisualizer is maintained on a best-effort basis. No guaranteed service-level response time is currently offered.

## Disclosure guidelines

Allow reasonable time for investigation and remediation before publicly disclosing a vulnerability.

Do not:

- Access, modify, or delete data that does not belong to you
- Degrade or disrupt systems or services
- Perform denial-of-service testing
- Use social engineering, phishing, or physical attacks
- Test systems or repositories without authorization
- Publish exploit details before coordinated disclosure
- Include confidential graph data in a report
- Upload malicious demonstrations to public issues or pull requests

Only test with files, repositories, systems, and environments that you own or are explicitly authorized to use.

## Application architecture

LTSVisualizer is a static browser application.

It has:

- No application backend
- No graph-upload API
- No database
- No persistent server-side graph storage
- No Python runtime requirement
- No executable installer

Users can run LTSVisualizer:

- As a statically hosted web application
- As a self-contained `LTSVisualizer.html` file opened through `file:///`

Graph files selected through the application are parsed and processed locally in the user's browser.

## Security considerations

Security-sensitive areas include:

- Parsing and validation of untrusted JSON documents
- Processing very large or deeply nested graph documents
- Rendering graph-provided labels and semantic values
- Handling state markings and transition input and output data
- Unique node and edge identifier validation
- Source and target reference validation
- Selected-path validation
- Generation of JSON and PlantUML downloads
- Browser behavior under `file:///`
- npm dependency vulnerabilities
- GitHub Actions workflow dependencies
- Static GitHub Pages deployment
- Integrity of downloadable offline release files

### Untrusted JSON input

JSON files may contain malformed, misleading, excessively large, or deeply nested content.

Users should:

- Open files only from trusted sources where practical
- Avoid 
