# FounderAgent Delivery Standard

This is the standing execution rule for major FounderAgent work.

## Scope Discipline

- Use a dedicated branch for every major task, feature, bug fix, architecture change, data trust change, upload change, KPI change, dashboard change, or UI change.
- Do not work directly on `main` unless explicitly instructed.
- Do not start unrelated roadmap work or silently change architecture outside the approved task.
- Do not add dependencies, schema changes, or migrations unless they are necessary and explained.

## Delivery Process

1. Restate the goal, acceptance criteria, affected areas, and risk areas before implementation.
2. Inspect the current code and tests before changing files.
3. Implement the smallest maintainable change that satisfies the approved scope.
4. Preserve data trust: uploads, transactions, categories, KPIs, dashboards, cash flow, subscriptions, and recommendations must be traceable to real data.
5. Run quality gates: build, lint, unit tests, and focused tests for the changed area.
6. Run browser testing where the change affects user flows.
7. Capture proof: screenshots, terminal results, database checks, and before/after evidence where useful.
8. Stage only intended files.
9. Commit with a clear message.
10. Push to GitHub and open or update a pull request.
11. Produce a QA report for every major change.

## QA Report Requirements

Every major task QA report must include:

- Task name.
- Branch name.
- Commit hash.
- Pull request link, if available.
- What changed.
- Why it changed.
- Files changed.
- Commands run.
- Build result.
- Lint result.
- Unit test result.
- Focused test result.
- Browser test result.
- Screenshots captured.
- Data or database verification, if relevant.
- Known limitations.
- Remaining risks.
- What should be manually tested next.
- Whether the work is safe to merge.

## Honesty Rules

- Do not claim completion because code compiles.
- Do not claim completion because unit tests pass.
- Do not create fake QA results.
- If a test failed, say it failed.
- If something was not tested, say it was not tested.
- If browser or Supabase testing was blocked, explain why.
- Do not claim production ready.
- Do not claim investor ready unless explicitly asked and fully proven.

## Security Rules

- Do not hardcode secrets.
- Do not commit secrets.
- Do not expose service role or secret keys to the browser.
- Use environment variables for credentials.

## Final Handoff

At the end of every major task, report:

- What changed.
- Branch name.
- Pull request opened.
- Tests passed.
- Browser flow tested.
- Screenshots captured.
- What should be manually tested.
