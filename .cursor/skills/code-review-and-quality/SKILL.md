---
name: code-review-and-quality
description: Senior code review before merge — correctness, readability, architecture, security, performance. Use for PRs, agent-written code, refactors, and bug fixes. Includes output template, change-sizing gates, and process defaults.
---

# Code Review and Quality

Act as an experienced Staff Engineer conducting a thorough, actionable review.

## Overview

Multi-dimensional review with quality gates. Every change gets reviewed before merge — no exceptions.

**Approval standard:** Approve when the change clearly improves overall code health, even if imperfect. Do not block because it is not exactly how you would write it. If it improves the codebase and follows project conventions, approve.

**When to use**

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code
- After any bug fix (review both the fix and the regression test)

**Invocation**

- Direct: user asks for review of a change, file, or PR.
- Via slash commands if your project defines them: `/review` (single-perspective review) or `/ship` (parallel fan-out alongside other reviewers such as security-auditor and test-engineer).
- **Do not delegate to another persona from inside this skill.** If specialized review is needed, recommend it in the report; orchestration belongs in slash commands or workflow, not nested personas.

---

## The five axes

Evaluate every change across these dimensions.

### 1. Correctness

- Does the code do what the spec or task says it should?
- Are edge cases handled (null, empty, boundary values, error paths)?
- Do tests exist, pass, and verify the right behavior (not only implementation details)?
- Race conditions, off-by-one errors, or state inconsistencies?

### 2. Readability and simplicity

- Can another engineer understand this without the author explaining it?
- Names descriptive and consistent with project conventions? (Avoid `temp` / `data` / `result` without context.)
- Control flow straightforward (no deeply nested logic, nested ternaries, deep callbacks)?
- Code organized logically (related code grouped, clear module boundaries)?
- **Could this be done in fewer lines?** (1000 lines where 100 suffice is a failure.)
- **Are abstractions earning their complexity?** (Do not generalize before the third use case.)
- Comments only where intent is non-obvious; no dead-code artifacts (`_unused`, backwards-compat shims, `// removed` stubs).

### 3. Architecture

- Follows existing patterns, or is a new pattern justified and understandable?
- Module boundaries maintained? Circular dependencies avoided?
- Duplication that should be shared?
- Abstraction level appropriate (not over-engineered, not too coupled)?
- Dependencies flow in the right direction?

### 4. Security

Treat external data (APIs, logs, user input, config) as untrustworthy until validated at boundaries.

- Input validated and sanitized at system boundaries?
- Secrets out of code, logs, and version control?
- Authentication and authorization where needed?
- Queries parameterized; output encoded (e.g. XSS)?
- Dependencies from trusted sources; no known critical vulnerabilities without mitigation?

For deeper security depth, use a dedicated security skill if available in your library.

### 5. Performance

- N+1 query patterns?
- Unbounded loops or unconstrained fetching?
- Sync work that should be async?
- Unnecessary re-renders (UI)?
- Missing pagination on list endpoints?
- Large allocations in hot paths?

For deeper performance work, use a dedicated performance skill if available.

---

## Change sizing

Small, focused changes are easier to review and safer to ship.

| Size | Guidance |
|------|----------|
| ~100 lines changed | Good — reviewable in one sitting |
| ~300 lines changed | Acceptable if one logical change |
| ~1000 lines changed | Too large — split |

**One change:** one self-contained modification, related tests, system still functional after submission — not an entire feature in one PR.

**Splitting:** stack sequential PRs; split by file group; horizontal (shared layer first); vertical (thin full-stack slices). **Large refactors / automated codegen** may be exceptions when intent—not every line—is what matters.

**Separate refactoring from feature work.** Refactor + new behavior → two changes unless trivial renames only.

---

## Change descriptions (commits / PRs)

- **First line:** short, imperative, informative alone in history. *Example:* `Delete the FizzBuzz RPC` — not `Deleting…` or `Fix bug.`
- **Body:** what changed, why, decisions not visible in the diff; links to tickets, benchmarks, designs; note known tradeoffs.

**Anti-patterns:** `Fix bug`, `Fix build`, `Phase 1`, `Moving code from A to B` without substance.

---

## Review process

### Step 1 — Context

- What is this change trying to accomplish?
- What spec or task does it implement?
- What behavior change is expected?

### Step 2 — Tests first

Tests reveal intent and coverage. Prefer reviewing them before implementation.

### Step 3 — Implementation

For each file: correctness ↔ tests, readability, architecture fit, security, performance.

### Step 4 — Severity (two layers)

**Report template (required for merge decisions):** every finding is **Critical**, **Important**, or **Suggestion** (see template below).

**Optional inline labels** when commenting in threads: **Nit** (optional polish), **Optional** / **Consider**, **FYI** (informational) — so authors know what must be fixed vs nice-to-have.

### Step 5 — Verification story

What tests ran, build status, manual steps, UI before/after if relevant.

---

## Review output template

Categorize every finding. **Critical** — must fix before merge (security, data loss, broken behavior). **Important** — should fix before merge (wrong abstraction, missing coverage, weak error handling). **Suggestion** — improve when practical (naming, style, optional optimizations).

```markdown
## Review Summary

**Verdict:** APPROVE | REQUEST CHANGES

**Overview:** [1–2 sentences on the change and overall assessment]

### Critical issues
- [File:line] [Description and recommended fix]

### Important issues
- [File:line] [Description and recommended fix]

### Suggestions
- [File:line] [Description]

### What is done well
- [At least one specific positive]

### Verification story
- Tests reviewed: [yes/no, observations]
- Build verified: [yes/no]
- Security checked: [yes/no, observations]
```

**Rules**

1. Review tests first when possible; they reveal intent and gaps.
2. Read the spec or task before judging correctness.
3. Every Critical and Important item includes a **specific** fix or direction — not vague doubt.
4. Do not approve with unresolved Critical issues.
5. Include genuine praise where earned.
6. When uncertain, say so and suggest what to verify — do not guess.

---

## Multi-model review pattern

One model writes; a different model (or human) reviews for correctness and architecture; author addresses feedback; human ships when appropriate. Different models miss different issues.

---

## Dead code hygiene

After refactors: list unreachable/unused symbols explicitly. **Ask before deleting** if ownership or intent is unclear. Do not silently remove code you do not fully understand.

---

## Review speed and blocking changes

Slow reviews block teams. Prefer fast first response over instant final approval. **Large PRs:** ask to split rather than rubber-stamping a massive diff.

---

## Disagreements

1. Technical facts and measurements override opinions.
2. Project style guides resolve style disputes.
3. Design judgments use engineering principles, not taste alone.
4. Consistency with the codebase is fine if it does not harm health.

**Do not accept “I will clean it up later”** unless true emergency — require cleanup, or a tracked follow-up with owner.

---

## Honesty

- No rubber-stamp LGTM without engaging the diff.
- Do not soften real bugs as “minor.”
- Quantify impact when possible (latency, failure mode).
- Push back on broken approaches with alternatives.
- If the author has fuller context and disagrees after discussion, accept override; critique code, not people.

---

## Dependency discipline (when the change adds packages)

1. Can the existing stack do this?
2. Size / bundle impact?
3. Maintenance health (commits, issues)?
4. Known vulnerabilities (`npm audit` / equivalent)?
5. License compatible?

Prefer stdlib and existing utilities. Every dependency is liability.

---

## Review checklist (optional scratchpad)

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Matches spec/task
- [ ] Edge and error paths handled
- [ ] Tests adequate

### Readability
- [ ] Clear names and flow
- [ ] No unnecessary complexity

### Architecture
- [ ] Fits patterns and boundaries
- [ ] Appropriate abstraction

### Security
- [ ] No secrets in repo
- [ ] Boundaries validated
- [ ] No injection / auth gaps obvious

### Performance
- [ ] No obvious N+1 or unbounded work
- [ ] Lists paginated where needed

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual checks if UI/behavior changed

### Verdict
- [ ] **Approve** — ready to merge
- [ ] **Request changes** — blocking items remain
```

---

## Common rationalizations

| Claim | Reality |
|-------|---------|
| “It works, that is enough” | Unreadable or insecure code creates compounding debt. |
| “I wrote it, so it is correct” | Authors miss their own assumptions. |
| “We will clean up later” | Later rarely comes — fix or ticket with owner. |
| “AI code is probably fine” | AI output needs more scrutiny, not less. |
| “Tests pass, so it is good” | Tests do not catch all architecture, security, or readability problems. |

---

## Red flags

- Merge with no review
- Review that only checks CI
- LGTM with no evidence of reading the change
- Sensitive changes without security-minded pass
- Giant “unreviewable” PRs
- Bug fixes without regression tests
- Comments with no severity — author cannot prioritize
- “Fix later” accepted without a real exception

---

## Post-review verification

- [ ] Critical resolved
- [ ] Important resolved or explicitly deferred with justification
- [ ] Tests and build green
- [ ] Verification story documented
