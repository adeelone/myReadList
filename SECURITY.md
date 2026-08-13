# Security policy

## Supported version

The deployed `main` branch is the only supported version. Security fixes are released to the live GitHub Pages site after review and automated checks.

## Report privately

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/adeelone/myReadList/security/advisories/new). Do not open a public issue for an unpatched vulnerability.

Include:

- the affected URL, file, or commit;
- the security impact and who could be affected;
- clear reproduction steps;
- a minimal, non-destructive proof of concept; and
- any suggested mitigation.

Do not include real credentials, session cookies, private reading exports, or unrelated personal data. You should receive an acknowledgement within seven days. Resolution timing depends on severity and reproducibility.

## Safe-harbor expectations

Good-faith research is welcome when it avoids privacy violations, service disruption, social engineering, automated traffic that burdens GitHub or NovelFire, persistence, and destruction or alteration of data. Stop testing and report immediately if you encounter non-public information.

## Architecture and boundaries

Novel Phoenix is a static, read-only site. It has no account system, origin API, database, payment flow, server secret, or browser-side deployment credential. Public data is read from `data/library.json`; imported CSV files remain in the browser until the owner intentionally publishes a sanitized snapshot through Git.

Browser protections include strict source restrictions, output escaping, safe-link filtering, input limits, local-only imports, and referrer suppression. CI uses pinned third-party action commits, least-privilege permissions, tests, CodeQL, and Dependabot. See [docs/SECURITY-OPERATIONS.md](docs/SECURITY-OPERATIONS.md) for the threat model and operational checklist.
