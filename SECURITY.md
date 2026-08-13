# Security

Novel Phoenix is a static site. It does not accept passwords, API keys, or GitHub tokens in the browser. Public data is read from `data/library.json`; browser imports remain local until the owner intentionally publishes a sanitized snapshot through Git.

Please report a vulnerability privately through GitHub's security-advisory interface for this repository. Do not include credentials, session cookies, or private reading exports in a public issue.
