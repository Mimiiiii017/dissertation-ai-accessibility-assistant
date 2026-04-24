/**
 * nasa-tlx-test-harness.ts
 *
 * Test framework for NASA-TLX cognitive load prediction based on accessibility issues.
 *
 * Purpose:
 *   - Map detected accessibility barriers → NASA-TLX dimensions
 *   - Predict Raw TLX workload scores (mean of 6 subscales)
 *   - Validate against mock developer ratings
 *   - Support dissertation Chapter 4 (correlation F1 ↔ TLX)
 *
 * NASA-TLX Dimensions:
 *   1. Mental Demand (MD): Thinking, problem-solving, concentration required
 *   2. Physical Demand (PD): Motor activity, hand/eye coordination
 *   3. Temporal Demand (TD): Time pressure, pacing
 *   4. Performance (Perf): Success rate, achievement (inverse: lower = higher workload)
 *   5. Effort (E): How hard had to work to achieve performance
 *   6. Frustration (F): Discouragement, irritation, stress
 *
 * Raw TLX Score = (MD + PD + TD + (100 - Perf) + E + F) / 6
 *   Range: 0–100 (0 = no workload, 100 = maximum workload)
 *
 * Run: npx ts-node src/nasa-tlx-test-harness.ts
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AccessibilityIssue {
  id: string;
  title: string;
  category: 'html' | 'css' | 'js' | 'aria' | 'focus' | 'contrast' | 'motor' | 'cognitive';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BarrierToDimensionMapping {
  barrier_type: string;
  affected_dimensions: {
    mental_demand?: number;      // 0–20 impact points per dimension
    physical_demand?: number;
    temporal_demand?: number;
    performance_impact?: number; // Negative = reduces perception of own performance
    effort?: number;
    frustration?: number;
  };
  reasoning: string;
}

export interface NasaTlxPrediction {
  fixture_name: string;
  issue_count: number;
  subscale_scores: {
    mental_demand: number;
    physical_demand: number;
    temporal_demand: number;
    performance: number;          // (100 - impact) where impact is from barriers
    effort: number;
    frustration: number;
  };
  raw_tlx: number;                // Overall workload (0–100)
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  explanation: string;
}

export interface DeveloperRating {
  participant_id: string;
  fixture_name: string;
  subscale_ratings: {
    mental_demand: number;        // 0–100 user-reported
    physical_demand: number;
    temporal_demand: number;
    performance: number;
    effort: number;
    frustration: number;
  };
  raw_tlx: number;
  notes?: string;
}

export interface ValidationResult {
  fixture_name: string;
  predicted_tlx: number;
  actual_tlx: number;
  error_margin: number;           // |predicted - actual|
  pearson_r?: number;             // Correlation if multiple data points
  decision: 'accurate' | 'overestimated' | 'underestimated';
}

// ─── Barrier-to-Dimension Mapping Database ──────────────────────────────────

const BARRIER_MAPPING: Record<string, BarrierToDimensionMapping> = {
  'missing-labels': {
    barrier_type: 'Missing or unclear labels',
    affected_dimensions: {
      mental_demand: 15,    // Developer must infer label purpose
      effort: 10,
      frustration: 8,
    },
    reasoning: 'Developer must cognitively map unlabeled elements to purpose; increases guesswork and error risk',
  },
  'keyboard-trap': {
    barrier_type: 'Keyboard trap or poor navigation',
    affected_dimensions: {
      physical_demand: 12,  // Requires mouse/alternative input
      effort: 18,           // Extra navigation steps
      frustration: 15,      // System behavior unexpected
      temporal_demand: 8,   // Takes longer
    },
    reasoning: 'Keyboard-only users must find workarounds; increases motor and temporal workload',
  },
  'poor-focus': {
    barrier_type: 'Poor focus visibility',
    affected_dimensions: {
      mental_demand: 12,    // Must visually hunt for focus
      frustration: 12,
      effort: 8,
    },
    reasoning: 'Developers cannot easily identify active element; increases visual search workload',
  },
  'low-contrast': {
    barrier_type: 'Inadequate color contrast',
    affected_dimensions: {
      mental_demand: 14,    // Strain to read text
      effort: 12,
      performance_impact: -8, // May miss issues or take longer
    },
    reasoning: 'Low-vision developers/testers must strain to read; impacts both mental and performance perception',
  },
  'unclear-error': {
    barrier_type: 'Unclear error messages',
    affected_dimensions: {
      frustration: 18,
      mental_demand: 10,    // Must interpret vague message
      effort: 12,
      performance_impact: -10,
    },
    reasoning: 'Ambiguous errors reduce confidence in fix; high frustration and perceived failure',
  },
  'cluttered-layout': {
    barrier_type: 'Dense or cluttered layout',
    affected_dimensions: {
      mental_demand: 16,
      effort: 10,
      frustration: 8,
    },
    reasoning: 'Complex layout requires more cognitive processing to navigate and understand',
  },
  'dynamic-updates': {
    barrier_type: 'Unexpected dynamic updates',
    affected_dimensions: {
      mental_demand: 14,
      temporal_demand: 12,
      frustration: 14,
      effort: 8,
    },
    reasoning: 'Unpredictable changes require constant re-evaluation; time pressure and cognitive overhead',
  },
  'aria-errors': {
    barrier_type: 'Incorrect ARIA attributes',
    affected_dimensions: {
      mental_demand: 16,    // Must understand ARIA semantics
      frustration: 12,      // Broken semantics = broken trust
      effort: 14,
      performance_impact: -8,
    },
    reasoning: 'ARIA misuse confuses screen reader users; developers must debug complex interactions',
  },
  'focus-trap-exit': {
    barrier_type: 'Focus trap (modal, dropdown)',
    affected_dimensions: {
      temporal_demand: 10,
      frustration: 14,
      effort: 8,
    },
    reasoning: 'Users/testers get stuck; time pressure increases',
  },
  'no-skip-links': {
    barrier_type: 'Missing skip links',
    affected_dimensions: {
      temporal_demand: 14,
      frustration: 10,
      effort: 12,
    },
    reasoning: 'Keyboard/screen reader users must navigate repetitive content; increases task time',
  },
};

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Map accessibility issues to barrier types (classification stage).
 * In production, would match againt ground-truth fixture issue categories.
 */
function classifyIssueBarrier(issue: AccessibilityIssue): string[] {
  const barriers: Set<string> = new Set();

  if (issue.title.toLowerCase().includes('label') || issue.title.includes('aria-label')) {
    barriers.add('missing-labels');
  }
  if (issue.title.toLowerCase().includes('keyboard') || issue.title.includes('trap')) {
    barriers.add('keyboard-trap');
  }
  if (issue.title.toLowerCase().includes('focus')) {
    barriers.add('poor-focus');
  }
  if (issue.title.toLowerCase().includes('contrast') || issue.title.includes('colour')) {
    barriers.add('low-contrast');
  }
  if (issue.title.toLowerCase().includes('error')) {
    barriers.add('unclear-error');
  }
  if (issue.title.toLowerCase().includes('clutter') || issue.title.includes('layout')) {
    barriers.add('cluttered-layout');
  }
  if (issue.title.toLowerCase().includes('dynamic') || issue.title.includes('update')) {
    barriers.add('dynamic-updates');
  }
  if (issue.title.toLowerCase().includes('aria')) {
    barriers.add('aria-errors');
  }
  if (issue.title.toLowerCase().includes('skip')) {
    barriers.add('no-skip-links');
  }

  return Array.from(barriers).length > 0 ? Array.from(barriers) : ['cluttered-layout']; // Default fallback
}

/**
 * Predict NASA-TLX scores based on accessibility issues detected in a fixture.
 */
export function predictTlxFromIssues(
  fixtureName: string,
  issues: AccessibilityIssue[]
): NasaTlxPrediction {
  const subscales = {
    mental_demand: 0,
    physical_demand: 0,
    temporal_demand: 0,
    performance: 100,       // Starts at 100, reduced by barriers
    effort: 0,
    frustration: 0,
  };

  const issueBarriers: Map<string, AccessibilityIssue[]> = new Map();

  // Classify each issue → barriers
  for (const issue of issues) {
    const barriers = classifyIssueBarrier(issue);
    for (const barrier of barriers) {
      if (!issueBarriers.has(barrier)) {
        issueBarriers.set(barrier, []);
      }
      issueBarriers.get(barrier)!.push(issue);
    }
  }

  // Aggregate dimension impacts
  const impactLog: string[] = [];
  for (const [barrier, barrierIssues] of issueBarriers) {
    const mapping = BARRIER_MAPPING[barrier];
    if (!mapping) continue;

    const impact = mapping.affected_dimensions;
    const count = barrierIssues.length;

    if (impact.mental_demand) {
      const adj = Math.min(impact.mental_demand * Math.log(count + 1), 40); // Cap at 40
      subscales.mental_demand += adj;
      impactLog.push(`${barrier} (×${count} issues) → MD +${adj.toFixed(1)}`);
    }
    if (impact.physical_demand) {
      const adj = Math.min(impact.physical_demand * Math.log(count + 1), 30);
      subscales.physical_demand += adj;
    }
    if (impact.temporal_demand) {
      const adj = Math.min(impact.temporal_demand * Math.log(count + 1), 35);
      subscales.temporal_demand += adj;
    }
    if (impact.effort) {
      const adj = Math.min(impact.effort * Math.log(count + 1), 40);
      subscales.effort += adj;
    }
    if (impact.frustration) {
      const adj = Math.min(impact.frustration * Math.log(count + 1), 45);
      subscales.frustration += adj;
    }
    if (impact.performance_impact) {
      subscales.performance = Math.max(0, subscales.performance + impact.performance_impact * count);
    }
  }

  // Clamp all at [0, 100]
  const clamped = {
    mental_demand: Math.min(100, subscales.mental_demand),
    physical_demand: Math.min(100, subscales.physical_demand),
    temporal_demand: Math.min(100, subscales.temporal_demand),
    performance: Math.max(0, Math.min(100, subscales.performance)),
    effort: Math.min(100, subscales.effort),
    frustration: Math.min(100, subscales.frustration),
  };

  // Raw TLX = mean of all 6 subscales
  const raw_tlx =
    (clamped.mental_demand +
      clamped.physical_demand +
      clamped.temporal_demand +
      (100 - clamped.performance) + // Inverse
      clamped.effort +
      clamped.frustration) /
    6;

  // Confidence based on issue count
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (issues.length < 5) confidence = 'low';
  if (issues.length >= 15 && issues.length <= 50) confidence = 'high';
  if (issues.length > 50) confidence = 'medium'; // Too many may be noise

  return {
    fixture_name: fixtureName,
    issue_count: issues.length,
    subscale_scores: clamped,
    raw_tlx: Math.round(raw_tlx),
    confidence,
    assumptions: [
      'Assumes developer familiarity with web accessibility standards',
      'Uses logarithmic scaling (multiple similar issues compound sublinearly)',
      'Barrier types inferred from issue titles (may not 100% match intent)',
      `Total issues: ${issues.length}; higher counts = higher confidence`,
    ],
    explanation: `Fixture "${fixtureName}" predicted TLX=${Math.round(raw_tlx)}/100. Issues mapped: ${Array.from(issueBarriers.keys()).join(', ')}. Top drivers: ${impactLog.slice(0, 3).join('; ')}`,
  };
}

/**
 * Compare predicted TLX vs developer-reported TLX (validation).
 */
export function validatePrediction(predicted: NasaTlxPrediction, actual: DeveloperRating): ValidationResult {
  const actual_tlx = (actual.subscale_ratings.mental_demand +
    actual.subscale_ratings.physical_demand +
    actual.subscale_ratings.temporal_demand +
    (100 - actual.subscale_ratings.performance) +
    actual.subscale_ratings.effort +
    actual.subscale_ratings.frustration) /
    6;

  const error = Math.abs(predicted.raw_tlx - actual_tlx);
  let decision: 'accurate' | 'overestimated' | 'underestimated';

  if (error < 15) {
    decision = 'accurate';
  } else if (predicted.raw_tlx > actual_tlx) {
    decision = 'overestimated';
  } else {
    decision = 'underestimated';
  }

  return {
    fixture_name: predicted.fixture_name,
    predicted_tlx: predicted.raw_tlx,
    actual_tlx: Math.round(actual_tlx),
    error_margin: error,
    decision,
  };
}

// ─── Example Test Data ────────────────────────────────────────────────────────

export const EXAMPLE_TEST_ISSUES: Record<string, AccessibilityIssue[]> = {
  'html-clean': [],
  'html-low': [
    { id: 'h1', title: 'Image missing alt text', category: 'html', severity: 'high' },
    { id: 'h2', title: 'Form input missing label', category: 'html', severity: 'high' },
  ],
  'html-medium': [
    { id: 'm1', title: 'Form input missing aria-label', category: 'aria', severity: 'medium' },
    { id: 'm2', title: 'Image alt text too short', category: 'html', severity: 'medium' },
    { id: 'm3', title: 'Table missing caption', category: 'html', severity: 'medium' },
    { id: 'm4', title: 'Link text is generic ("click here")', category: 'html', severity: 'medium' },
  ],
  'html-high': [
    { id: 'mh1', title: 'Multiple images missing alt text (10)', category: 'html', severity: 'critical' },
    { id: 'mh2', title: 'Form inputs lack labels or aria-labels (8)', category: 'aria', severity: 'critical' },
    { id: 'mh3', title: 'Skip links missing or broken', category: 'html', severity: 'high' },
    { id: 'mh4', title: 'Low color contrast on text (4 elements)', category: 'contrast', severity: 'high' },
    { id: 'mh5', title: 'Focus indicators removed without replacement (6)', category: 'focus', severity: 'critical' },
    { id: 'mh6', title: 'Keyboard only: Tab trap in modal', category: 'html', severity: 'critical' },
    { id: 'mh7', title: 'Unexpected dynamic updates (no announcements)', category: 'cognitive', severity: 'high' },
    { id: 'mh8', title: 'ARIA role misuse (button as link)', category: 'aria', severity: 'high' },
  ],
};

export const EXAMPLE_MOCK_DEVELOPER_RATING: DeveloperRating = {
  participant_id: 'dev-001',
  fixture_name: 'html-high',
  subscale_ratings: {
    mental_demand: 78,      // High: complex ARIA and focus issues
    physical_demand: 45,    // Moderate: some keyboard navigation
    temporal_demand: 68,    // High: takes time to understand all issues
    performance: 55,        // Low: many issues missed or confusing
    effort: 82,             // Very high: hard to identify all problems
    frustration: 76,        // High: confusing behavior, keyboard trap
  },
  raw_tlx: 67, // Actual TLX score participant provided
  notes: 'Focus issues and keyboard trap were very frustrating. Alt text missing was obvious but there was too much.',
};
