# Security Policy

## Supported versions

LTSVisualizer is currently under active development and has not yet reached a stable major release.

Security fixes are applied to the latest version of the `main` branch. Older commits, forks, and unofficial builds are not actively supported.

| Version | Supported |
| --- | --- |
| Latest `main` branch | Yes |
| Older commits or releases | No |
| Third-party forks | No |

## Reporting a vulnerability

Please do not report suspected security vulnerabilities through public GitHub issues, discussions, pull requests, or social-media posts.

Use GitHub's private vulnerability-reporting feature for this repository when available:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Provide the information requested below.

Repository:

<https://github.com/dbera/LTSVisualizer>

If private vulnerability reporting is not available, contact the repository owner through the contact method listed on the GitHub profile. Do not include sensitive exploit details in a public message.

## Information to include

A useful vulnerability report should include:

- A clear description of the vulnerability.
- The affected LTSVisualizer version or commit hash.
- The affected component, such as the PlantUML parser, upload endpoint, FastAPI backend, or React frontend.
- The operating system and browser used during testing.
- Exact steps required to reproduce the issue.
- A minimal proof of concept, when safe to provide.
- The potential security impact.
- Any known mitigations or suggested fixes.
- Whether the issue has been disclosed to anyone else.

Please remove confidential, proprietary, personal, or unrelated data from all reports and examples.

## Expected response process

The project maintainer will make a reasonable effort to:

1. Acknowledge receipt of the report.
2. Confirm whether the reported behavior can be reproduced.
3. Assess severity and affected versions.
4. Develop and test a correction when required.
5. Coordinate disclosure after a fix or mitigation is available.

Response and resolution times depend on the complexity and severity of the issue. This project is maintained on a best-effort basis, so no guaranteed service-level response time is currently offered.

## Disclosure guidelines

Please allow reasonable time for investigation and remediation before publicly disclosing a vulnerability.

Do not:

- Access, modify, or delete data that does not belong to you.
- Degrade or disrupt systems or services.
- Perform denial-of-service testing.
- Use social engineering, phishing, or physical attacks.
- Test against installations without the owner's authorization.
- Publish exploit details before coordinated disclosure.

Only test with files, systems, and environments that you own or are explicitly authorized to use.

## Security considerations

LTSVisualizer processes user-selected PlantUML text files and renders parsed graph content in a browser. Security-sensitive areas include:

- File-upload validation.
- Input-size and resource limits.
- Parsing of untrusted text and nested JSON values.
- Browser rendering of transition labels and token data.
- Dependency vulnerabilities in Python and npm packages.
- Local-network exposure of the development server.

The current application is intended primarily for trusted local development use. When running the application:

- Bind the backend to localhost unless remote access is intentionally required.
- Do not expose the development server directly to the public internet.
- Review PlantUML files from untrusted sources before processing them.
- Avoid uploading files containing confidential information to deployments you do not control.
- Keep Python and npm dependencies up to date.
- Run the application with a non-administrator account where practical.

## Uploaded files and privacy

The upload endpoint is intended to parse graph files in memory. Contributors should avoid adding persistent storage or logging of uploaded file contents unless that behavior is clearly documented and justified.

PlantUML reachability graphs may contain domain data, token values, identifiers, or other sensitive information. Users are responsible for confirming that files are appropriate to process and share.

## Dependency vulnerabilities

Potential vulnerabilities in third-party dependencies can be reported privately through the process above. Reports should identify:

- The affected package and version.
- The relevant advisory or CVE, when available.
- Whether the vulnerability is reachable in LTSVisualizer.
- The recommended safe version.

Automated dependency-update pull requests are welcome when they include successful backend tests and frontend build checks.

## Security updates

Confirmed vulnerabilities may be addressed through:

- A commit to the `main` branch.
- A GitHub Security Advisory.
- A tagged release.
- Updated installation or mitigation guidance.

Public acknowledgements may be offered to reporters who request attribution, provided coordinated disclosure has been followed.
