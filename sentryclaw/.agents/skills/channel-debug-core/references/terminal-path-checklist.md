# Terminal Path Checklist

For webhook route changes, enumerate every terminal branch.

Must log:

- accepted webhook
- invalid signature / missing credentials
- invalid JSON
- dedup skip
- bot/self-message skip
- fast-path skipped with structured reason
- fast-path success
- fast-path non-2xx
- fast-path fetch exception / timeout
- boot message sent/failed
- workflow started
- workflow start requested with channel, requestId, deliveryId/platform event ID, sandbox status, and workflowRunId if available
- workflow start failed
- workflow start failed with structured reason
- workflow run/step correlation available through workflowRunId or fallback log evidence
- app admin SSH/exec fallback probe started/completed, if used, with probe name and exit code only
- unexpected failure

Must update `lastForward` for delivery attempts:

- fast-path success
- fast-path non-2xx
- fast-path fetch exception / timeout
- workflow native forward success/failure via shared workflow
- workflow forward attempts must preserve requestId/deliveryId/workflowRunId when available

Must classify:

- `sandbox-not-listening`
- `proxy-error`
- `handler-not-ready`
- `handler-error`
- `fetch-exception`
- `accepted`
- `exhausted`

Must refresh stale port URL:

- `sandbox-not-listening`, exactly once per request.

Must not log or save:

- admin secrets
- Deployment Protection bypass secrets
- bot tokens
- webhook secrets
- platform access tokens
- full raw channel payloads when they include secrets or user-private content beyond the incident need
- decrypted Workflow fields unless redacted first
