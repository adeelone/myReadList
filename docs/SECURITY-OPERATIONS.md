# Security operations and threat model

## System boundary

Novel Phoenix publishes static files through Vercel, with GitHub Pages retained as a fallback. There is no application server, login, database, writable public endpoint, or secret in the browser. The only owner write path is an authenticated Git commit to `data/library.json`.

## Assets to protect

- repository write access and the Vercel and GitHub Pages deployment environments;
- the integrity of the public reading snapshot;
- private CSV filenames and any data not intentionally published;
- visitors from script injection, malicious redirects, deceptive framing, and unsafe downloads; and
- availability of the static site.

## Trust boundaries

1. NovelFire or NovelPhoenix.com produces an untrusted CSV export.
2. Browser code parses that CSV into a local draft.
3. The owner reviews and intentionally publishes sanitized JSON through Git.
4. GitHub Actions validates and builds an immutable artifact.
5. Vercel serves the production artifact over HTTPS; GitHub Pages can serve the fallback artifact.

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
| Clickjacking or missing server headers | Vercel applies the response-header CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, COOP, CORP, and `nosniff`; the HTML meta policy provides an additional browser fallback. |
| Hosting-layer attack or denial of service | Vercel operates TLS, CDN, and its platform security perimeter. There is no exposed application origin service. GitHub operates the fallback Pages perimeter. |

## Firewall position

Vercel's platform perimeter and automatic DDoS protections apply to the production deployment. The repository configures browser and response headers, but it does not claim custom paid WAF rules or application-specific rate limits that have not been enabled in the Vercel account. There is no exposed application origin. If risk changes, enable appropriate Vercel Firewall rules and verify them in the dashboard. A WAF is defense in depth; it does not replace source controls or safe deployment.

## Release checklist

1. Confirm the intended reading snapshot is safe for public release.
2. Run `npm ci --ignore-scripts` and `npm run check`.
3. Review changes to runtime scripts, CSP, legal pages, workflows, and `data/library.json`.
4. Merge only after verification and CodeQL succeed.
5. Confirm Vercel reports a successful production deployment, HTTPS and headers are active, and the live HTML/data match the merged commit; check the fallback Pages workflow too.
6. Test the public library, an outbound link, privacy/security pages, the 404 page, and a mobile viewport.
7. Review Dependabot and CodeQL alerts at least monthly.

## Incident response

For a credible vulnerability: preserve evidence, privately acknowledge the report, assess impact, remove exposed secrets or data if any, patch on a private branch when needed, test, deploy, verify the live fix, and publish a concise advisory when disclosure is safe. Rotate any affected GitHub credentials through GitHub rather than placing replacements in the repository.
