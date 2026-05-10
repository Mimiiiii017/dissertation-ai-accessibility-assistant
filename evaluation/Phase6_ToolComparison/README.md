# Phase 6: Supplementary Tool Comparison

Study 6 compares the AI Accessibility Assistant against Google Lighthouse and Deque axe-core to assess tool alignment, identify high-confidence violations, and quantify potential recall gaps.

## Quick Start

```bash
# Install dependencies
npm install

# Run comparison on default fixture (html-medium)
npm run study6:compare

# Run on all fixtures
npm run study6:compare:all

# Run on specific fixture
npm run study6:compare:medium
npm run study6:compare:high
```

## Fixtures

Two HTML fixtures with realistic sizes and empirically-justified error counts:

| Fixture | Errors | HTML | CSS | JS | Justification |
|---------|--------|------|-----|----|----|
| html-medium | 30 | 32.5 kB | 70 kB | 485 kB | Median (Martins & Duarte 2016) |
| html-high | 50 | 33.2 kB | 71 kB | 495 kB | Healthcare homepages (Fernandes et al. 2019) |

## Files

- **study-6-run.ts** — Orchestrator; integrates AI Assistant, Lighthouse, axe-core
- **study-6-compare.ts** — Alignment analysis; finds shared/unique findings, calculates statistics
- **study-6-fixtures.ts** — Fixture definitions with literature justification
- **IMPLEMENTATION_SUMMARY.md** — Full methodology & rationale
- **package.json** — Dependencies & scripts
- **tsconfig.json** — TypeScript config

## Output

Results are saved in `./results/study-6/`:

```
{fixture}-comparison.json  — Full alignment matrix & statistics
lighthouse-{fixture}.json  — Raw Lighthouse report
```

## Key Metrics

- **Shared findings** — 2+ tools agree (high confidence)
- **AI-only findings** — AI detects semantic issues not evident in rendered DOM
- **Lighthouse/axe-only** — Potential AI recall gaps
- **Agreement rate** — Percentage of issues detected by multiple tools

## References

[1] HTTP Archive Web Almanac 2024: Page sizes (32–33 kB HTML, 68–72 kB CSS, 461–509 kB JS)
[2] Martins & Duarte (2016): 30 = median errors per page (2.88M pages analyzed)
[3] Fernandes et al. (2019): 51 = median healthcare homepage errors (high-barrier baseline)
