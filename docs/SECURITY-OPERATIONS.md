# Security operations and threat model

## System boundary

Novel Phoenix publishes static files through GitHub Pages. There is no application server, login, database, writable public endpoint, or secret in the browser. The only owner write path is an authenticated Git commit to `data/library.json`.

## Assets to protect

- repository write access and the GitHub Pages deployment environment;
- the integrity of the public reading snapshot;
- private CSV filenames and any data not intentionally published;
- visitors from script injection, malicious redirects, deceptive framing, and unsafe downloads; and
- availability of the static site.

## Trust boundaries

1. NovelFire produces an untrusted CSV export.
2. Browser code parses that CSV into a local draft.
3. The owner reviews and intentionally publishes sanitized JSON through Git.
4. GitHub Actions validates and builds an immutable artifact.
5. GitHub Pages serves the public artifact over HTTPS.

## Threats and mitigations

| Threat | Mitigation |
| --- | --- |
| Script or HTML injection from imported text | Values are normalized, length-limited, escaped before HTML insertion, and constrained by CSP. |
| Unsafe links | Only HTTP and HTTPS URLs survive normalization; new tabs use `noopener noreferrer` and no-referrer. |
| Oversized or abusive imports | Browser imports are limited to 5 MB and 5,000 novels; public JSON is bounded before parsing. |
| Accidental private filename publication | Public snapshot generation removes filenames and replaces them with a generic label. |
| Credential exposure | No deployment token or API key exists in runtime files; publication uses the owner's Git credential outside the site. |
| Supply-chain compromise in CI | Third-party Actions are pinned to reviewed full commit SHAs and updated through Dependabot. |
| Over-privileged automation | Verification is read-only; Pages and identity permissions are scoped only to packaging/deployment jobs. |
| Clickjacking or missing server headers | The static CSP blocks child frames but `frame-ancestors` cannot be enforced from a meta policy. GitHub Pages does not expose arbitrary response-header configuration. This is a documented residual risk. |
| Hosting-layer attack or denial of service | GitHub operates TLS and the hosting perimeter. There is no exposed origin service. |

## Firewall position

No custom WAF is active because the site currently uses a `github.io` project domain and has no origin server. Do not claim otherwise. If a custom domain is added, place it behind a managed proxy/WAF, verify the domain in GitHub, enforce HTTPS, allow only required methods, enable managed rules and rate limiting, and keep DNS records aligned with GitHub Pages. A WAF is defense in depth; it does not replace source controls or safe deployment.

## Release checklist

1. Confirm the intended reading snapshot is safe for public release.
2. Run `npm ci --ignore-scripts` and `npm run check`.
3. Review changes to runtime scripts, CSP, legal pages, workflows, and `data/library.json`.
4. Merge only after verification and CodeQL succeed.
5. Confirm Pages reports HTTPS and the live HTML/data match the merged commit.
6. Test the public library, an outbound link, privacy/security pages, the 404 page, and a mobile viewport.
7. Review Dependabot and CodeQL alerts at least monthly.

## Incident response

For a credible vulnerability: preserve evidence, privately acknowledge the report, assess impact, remove exposed secrets or data if any, patch on a private branch when needed, test, deploy, verify the live fix, and publish a concise advisory when disclosure is safe. Rotate any affected GitHub credentials through GitHub rather than placing replacements in the repository.
