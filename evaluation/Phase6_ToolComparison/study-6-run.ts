/**
 * study-6-run.ts — Study 6: Supplementary Tool Comparison Orchestrator
 *
 * Coordinates accessibility analysis across three tools for Study 6:
 *   1. AI Accessibility Assistant (source-level)
 *   2. Google Lighthouse (rendered DOM)
 *   3. Deque axe-core (rendered DOM)
 *
 * WORKFLOW
 * ────────
 *   For each fixture (html-medium, html-high):
 *     1. Query AI system for findings (reuse extension analysis pipeline)
 *     2. Spin up local server and render page for Lighthouse and axe-core
 *     3. Run Lighthouse audit via Chrome DevTools Protocol
 *     4. Run axe-core via puppeteer or axe-core Node API
 *     5. Collect all findings, normalize format, and store
 *     6. Generate alignment matrix and comparison report
 *
 * CLI USAGE
 * ─────────
 *   npm run study6:compare
 *   npm run study6:compare -- --fixture html-medium --ai-model ollama.mistral
 *   npm run study6:compare -- --all-fixtures --output ./results/study-6.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import puppeteer, { Browser } from 'puppeteer';
import * as esbuild from 'esbuild';
import { STUDY_6_FIXTURES, loadFixtureContent, Study6Fixture } from './study-6-fixtures';
import {
  createComparisonReport,
  printAlignmentMatrix,
  saveComparisonReport,
  ToolFinding,
} from './study-6-compare';

const execAsync = promisify(exec);

interface Study6Options {
  fixture?: string;
  allFixtures?: boolean;
  aiModel?: string;
  outputDir?: string;
  concurrency?: number;
  serverPort?: number;
  headless?: boolean;
}

interface AiIssueLike {
  title?: string;
  severity?: 'high' | 'med' | 'low';
  explanation?: string;
  fix?: string;
  lineHint?: number;
  lineHints?: number[];
}

interface VirtualFile {
  content: string;
  mimeType: string;
}

interface BrowserHarness {
  html: string;
  virtualFiles: Record<string, VirtualFile>;
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): Study6Options {
  const args = process.argv.slice(2);
  const opts: Study6Options = {
    allFixtures: false,
    aiModel: 'kimi-k2.5:cloud + qwen3.5:397b-cloud',
    outputDir: './results/study-6',
    concurrency: 1,
    serverPort: 3456,
    headless: true,
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fixture':
        opts.fixture = args[++i];
        break;
      case '--all-fixtures':
        opts.allFixtures = true;
        break;
      case '--ai-model':
        opts.aiModel = args[++i];
        break;
      case '--output':
        opts.outputDir = args[++i];
        break;
      case '--port':
        opts.serverPort = parseInt(args[++i], 10);
        break;
      case '--no-headless':
        opts.headless = false;
        break;
    }
  }
  
  return opts;
}

/**
 * Query the AI system for accessibility findings.
 * Reuses the extension's analysis pipeline.
 */
async function analyzeWithAI(sourceContent: string, sourceType: Study6Fixture['sourceType'], aiModel: string): Promise<ToolFinding[]> {
  console.log(`[AI Analysis] Analyzing ${sourceType.toUpperCase()} with ${aiModel}...`);

  const {
    FIXED_MODEL,
    SECONDARY_MODEL,
    ollamaGenerateStream,
  } = require('../../extension/ai-accessibility-assistant/src/utils/llm/ollama');
  const { SYSTEM_PROMPT, buildAiPrompt } = require('../../extension/ai-accessibility-assistant/src/utils/prompts/prompt');
  const { ragRetrieve, formatRagContext } = require('../../extension/ai-accessibility-assistant/src/utils/rag/rag');
  const { parseTextResponse, deduplicateIssues } = require('../../extension/ai-accessibility-assistant/src/utils/analysis/parser');

  const ragEndpoint = 'http://127.0.0.1:8000';
  const queries = [
    'link accessible name aria-label non-descriptive text "click here" "read more" nav landmark multiple label ARIA11',
    'button accessible name aria-expanded toggle disclosure',
    'form input label accessible name autocomplete personal data given-name email tel address SC 1.3.5',
    'image alt attribute missing non-text content table header scope heading level skip hierarchy WCAG 1.1.1 1.3.1',
    'aria-labelledby aria-describedby aria-controls broken reference id does not exist SC 4.1.2',
  ];

  let ragContext = '';
  for (const query of queries) {
    try {
      const response = await ragRetrieve(ragEndpoint, query, 3, 'accessibility', 0.5);
      const formatted = formatRagContext(response.chunks);
      ragContext += formatted + '\n';
    } catch (err) {
      console.log(`[AI Analysis] RAG query failed (non-fatal): ${err}`);
    }
  }

  const promptLanguage = sourceType === 'js' ? 'javascript' : sourceType === 'tsx' ? 'typescript' : sourceType;
  const prompt = buildAiPrompt(promptLanguage, sourceContent, ragContext || '(no context)');
  let kimiResponse = '';
  let qwenResponse = '';

  console.log(`[AI Analysis] Calling ${FIXED_MODEL} + ${SECONDARY_MODEL} with RAG-think...`);

  const qwenPromise = ollamaGenerateStream(
    'http://localhost:11434',
    SECONDARY_MODEL,
    prompt,
    (chunk: string) => { qwenResponse += chunk; },
    SYSTEM_PROMPT,
  ).catch((err: Error) => {
    console.warn(`[AI Analysis] ${SECONDARY_MODEL} error: ${err?.message ?? err}`);
  });

  await ollamaGenerateStream(
    'http://localhost:11434',
    FIXED_MODEL,
    prompt,
    (chunk: string) => { kimiResponse += chunk; },
    SYSTEM_PROMPT,
  );

  await qwenPromise;

  const kimiIssues: AiIssueLike[] = deduplicateIssues(parseTextResponse(kimiResponse));
  const qwenIssues: AiIssueLike[] = deduplicateIssues(parseTextResponse(qwenResponse));

  const normalizeIssueTitle = (title: string): Set<string> => {
    const stop = new Set(['a','an','the','is','are','was','were','has','have','had','be','been','with','for','on','at','by','from','in','of','to','and','or','not','no','this','that','it','its']);
    return new Set(
      title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 2 && !stop.has(word))
    );
  };

  const issueTitlesMatch = (left: AiIssueLike, right: AiIssueLike): boolean => {
    if (!left.title || !right.title) {
      return false;
    }
    const leftWords = normalizeIssueTitle(left.title);
    const rightWords = normalizeIssueTitle(right.title);
    if (leftWords.size === 0 || rightWords.size === 0) {
      return false;
    }
    const overlap = [...leftWords].filter(word => rightWords.has(word)).length;
    const union = new Set([...leftWords, ...rightWords]).size;
    return union > 0 && (overlap / union) >= 0.3;
  };

  const usedQwen = new Set<number>();
  const mergedIssues: AiIssueLike[] = [];

  for (const kimiIssue of kimiIssues) {
    let matched = false;
    for (let index = 0; index < qwenIssues.length; index++) {
      if (usedQwen.has(index)) {
        continue;
      }
      if (issueTitlesMatch(kimiIssue, qwenIssues[index])) {
        mergedIssues.push(kimiIssue);
        usedQwen.add(index);
        matched = true;
        break;
      }
    }
    if (!matched) {
      mergedIssues.push(kimiIssue);
    }
  }

  for (let index = 0; index < qwenIssues.length; index++) {
    if (!usedQwen.has(index)) {
      mergedIssues.push(qwenIssues[index]);
    }
  }

  const findings = mergedIssues.map((issue): ToolFinding => {
    const wcagMatch = `${issue.title || ''} ${issue.explanation || ''}`.match(/\b([1-4]\.\d\.\d)\b/);
    const lines = issue.lineHints && issue.lineHints.length > 0
      ? issue.lineHints.join(', ')
      : issue.lineHint
        ? String(issue.lineHint)
        : undefined;

    return {
      wcag: wcagMatch?.[1] || 'unknown',
      issueType: issue.title || 'Accessibility issue',
      severity: issue.severity === 'high' ? 'error' : issue.severity === 'low' ? 'notice' : 'warning',
      description: issue.explanation || issue.fix || issue.title || 'Accessibility issue detected by AI analysis.',
      element: lines ? `Lines ${lines}` : undefined,
      toolSource: 'ai',
    };
  });

  console.log(`[AI Analysis] ${FIXED_MODEL}: ${kimiIssues.length}, ${SECONDARY_MODEL}: ${qwenIssues.length}, merged: ${findings.length}`);
  return findings;
}

/**
 * Serve HTML locally and wait for server readiness.
 */
function startLocalServer(
  htmlContent: string,
  fixture: Study6Fixture,
  port: number,
  virtualFiles: Record<string, VirtualFile> = {},
): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const fixturesRoot = path.resolve(path.dirname(fixture.filePath));

    const server = http.createServer((req, res) => {
      const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);

      if (requestPath === '/' || requestPath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
        return;
      }

      if (virtualFiles[requestPath]) {
        res.writeHead(200, { 'Content-Type': virtualFiles[requestPath].mimeType });
        res.end(virtualFiles[requestPath].content);
        return;
      }

      const safePath = requestPath.replace(/^\/+/, '');
      const filePath = path.resolve(fixturesRoot, safePath);
      if (!filePath.startsWith(fixturesRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.css'
        ? 'text/css'
        : ext === '.js'
          ? 'application/javascript'
          : ext === '.svg'
            ? 'image/svg+xml'
            : ext === '.woff2'
              ? 'font/woff2'
              : ext === '.png'
                ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg'
                  ? 'image/jpeg'
                  : 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(fs.readFileSync(filePath));
    });
    
    server.listen(port, () => {
      console.log(`[Server] Started on http://localhost:${port}`);
      resolve(server);
    });
    
    server.on('error', reject);
  });
}

function buildBrowserHarness(fixture: Study6Fixture, sourceContent: string): BrowserHarness {
  const fileName = path.basename(fixture.filePath);

  if (fixture.sourceType === 'html') {
    return { html: sourceContent, virtualFiles: {} };
  }

  if (fixture.sourceType === 'css') {
    return {
      html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Study 6 CSS Harness</title>
  <link rel="stylesheet" href="/${fileName}" />
</head>
<body>
  <header><nav><a href="#">Click here</a><button>Menu</button></nav></header>
  <main>
    <h1>Harness</h1>
    <h3>Subheading</h3>
    <img src="logo.png" />
    <form><input type="email" placeholder="Your email" /><textarea placeholder="Message"></textarea><button type="submit">Send</button></form>
    <table><tr><td>Plan</td><td>Price</td></tr><tr><td>Basic</td><td>$29</td></tr></table>
  </main>
</body>
</html>`,
      virtualFiles: {},
    };
  }

  if (fixture.sourceType === 'js') {
    return {
      html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Study 6 JS Harness</title>
</head>
<body>
  <header>
    <nav>
      <button id="menu-button">Menu</button>
    </nav>
  </header>
  <main>
    <form id="contact-form">
      <input type="email" />
      <input type="text" />
      <input type="tel" />
      <select><option value="">Select</option></select>
      <textarea></textarea>
      <button type="submit">Send</button>
    </form>
    <div aria-live="polite"></div>
    <button class="open-modal-btn">Open Modal</button>
    <div class="modal" style="display:none"><button class="close-btn">Close</button></div>
  </main>
  <script src="/${fileName}"></script>
</body>
</html>`,
      virtualFiles: {},
    };
  }

  const tsxEntry = `${sourceContent}

import React from 'react';
import { createRoot } from 'react-dom/client';

const __root = document.getElementById('root');
if (__root && typeof App !== 'undefined') {
  createRoot(__root).render(React.createElement(App));
}`;

  const bundle = esbuild.buildSync({
    stdin: {
      contents: tsxEntry,
      resolveDir: path.dirname(fixture.filePath),
      sourcefile: 'study-6-tsx-harness-entry.tsx',
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    jsx: 'automatic',
  });

  const appJs = bundle.outputFiles?.[0]?.text || '';

  return {
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Study 6 TSX Harness</title>
</head>
<body>
  <div id="root"></div>
  <script src="/tsx-app.js"></script>
</body>
</html>`,
    virtualFiles: {
      '/tsx-app.js': { content: appJs, mimeType: 'application/javascript' },
    },
  };
}

/**
 * Run Lighthouse accessibility audit via CLI and extract failing audits.
 */
async function runLighthouse(url: string, outputPath: string): Promise<ToolFinding[]> {
  console.log(`[Lighthouse] Running audit on ${url}...`);

  try {
    const cmd = [
      'npx --yes lighthouse',
      url,
      '--output=json',
      `--output-path=${outputPath}`,
      '--only-categories=accessibility',
      '--quiet',
      '--chrome-flags="--headless=new --disable-gpu --no-sandbox"',
    ].join(' ');

    await execAsync(cmd, { timeout: 90000, maxBuffer: 10 * 1024 * 1024 });

    if (!fs.existsSync(outputPath)) {
      console.warn('[Lighthouse] No JSON report generated');
      return [];
    }

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    const findings: ToolFinding[] = [];

    const auditRefs = report?.categories?.accessibility?.auditRefs || [];
    for (const ref of auditRefs) {
      const auditId = ref?.id;
      if (!auditId) {
        continue;
      }

      const audit = report?.audits?.[auditId];
      if (!audit) {
        continue;
      }

      const isBinaryFailure = audit.scoreDisplayMode === 'binary' && audit.score !== 1;
      const isScoredFailure = typeof audit.score === 'number' && audit.score < 1 && audit.scoreDisplayMode !== 'notApplicable';
      if (!isBinaryFailure && !isScoredFailure) {
        continue;
      }

      const nodes = Array.isArray(audit?.details?.items) ? audit.details.items : [];
      if (nodes.length === 0) {
        findings.push({
          wcag: (audit.tags || []).find((t: string) => /^wcag\d+/i.test(t)) || 'unknown',
          issueType: audit.title || auditId,
          severity: 'warning',
          description: audit.description || audit.explanation || 'Accessibility issue found by Lighthouse',
          element: undefined,
          toolSource: 'lighthouse',
        });
        continue;
      }

      for (const item of nodes) {
        const snippet = item?.node?.snippet || item?.snippet || item?.selector || undefined;
        findings.push({
          wcag: (audit.tags || []).find((t: string) => /^wcag\d+/i.test(t)) || 'unknown',
          issueType: audit.title || auditId,
          severity: 'warning',
          description: audit.description || audit.explanation || 'Accessibility issue found by Lighthouse',
          element: snippet,
          toolSource: 'lighthouse',
        });
      }
    }

    console.log(`[Lighthouse] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.error(`[Lighthouse] Error: ${err}`);
    return [];
  }
}

/**
 * Run axe-core audit via puppeteer.
 */
async function runAxeCore(browser: Browser, url: string): Promise<ToolFinding[]> {
  console.log(`[axe-core] Running audit on ${url}...`);
  
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Inject and run axe-core
    await page.addScriptTag({ path: require.resolve('axe-core') });
    
    const results = await page.evaluate(() => {
      return new Promise((resolve) => {
        (globalThis as any).axe.run((err: any, results: any) => {
          resolve(results);
        });
      });
    });
    
    await page.close();
    
    const findings: ToolFinding[] = [];
    
    // Extract violations and incomplete issues
    if ((results as any).violations) {
      ((results as any).violations as any[]).forEach(violation => {
        violation.nodes?.forEach((node: any) => {
          findings.push({
            wcag: (violation.tags?.[0] || '').replace('wcag', '').replace('wcag2', '').trim() || 'unknown',
            issueType: violation.impact ? `${violation.id} (${violation.impact})` : violation.id,
            severity: violation.impact === 'critical' ? 'error' : 'warning',
            description: violation.description,
            element: node.target?.[0] || node.html?.substring(0, 50),
            toolSource: 'axeCore',
          });
        });
      });
    }
    
    console.log(`[axe-core] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.error(`[axe-core] Error: ${err}`);
    return [];
  }
}

/**
 * Run comparison analysis for a single fixture.
 */
async function analyzeFixture(
  fixture: Study6Fixture,
  opts: Study6Options,
): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`ANALYZING: ${fixture.name} (${fixture.errorCount} errors)`);
  console.log(`${'='.repeat(80)}\n`);
  
  const sourceContent = loadFixtureContent(fixture);
  
  // 1. AI Analysis (source-level)
  const aiFindings = await analyzeWithAI(sourceContent, fixture.sourceType, opts.aiModel!);

  let lighthouseFindings: ToolFinding[] = [];
  let axeCoreFindings: ToolFinding[] = [];

  if (fixture.runBrowserAudits) {
    const harness = buildBrowserHarness(fixture, sourceContent);

    // 2. Start local server and run browser-based tools
    const server = await startLocalServer(harness.html, fixture, opts.serverPort!, harness.virtualFiles);
    const url = `http://localhost:${opts.serverPort}`;

    // 3. Lighthouse (rendered DOM)
    const lighthouseOutputPath = path.join(opts.outputDir!, `lighthouse-${fixture.name}.json`);
    lighthouseFindings = await runLighthouse(url, lighthouseOutputPath);

    // 4. axe-core (rendered DOM)
    const browser = await puppeteer.launch({ headless: opts.headless });
    axeCoreFindings = await runAxeCore(browser, url);
    await browser.close();

    // 5. Stop server
    server.close();
  } else {
    console.log(`[Browser Audits] Skipped for ${fixture.sourceType.toUpperCase()} fixture (AI-only source analysis)`);
  }
  
  // 6. Generate comparison report
  const report = createComparisonReport(
    fixture.name,
    fixture.errorCount,
    opts.aiModel!,
    aiFindings,
    lighthouseFindings,
    axeCoreFindings,
  );
  
  // 7. Save and print results
  const reportPath = path.join(opts.outputDir!, `${fixture.name}-comparison.json`);
  saveComparisonReport(report, reportPath);
  printAlignmentMatrix(report);
}

/**
 * Main entry point.
 */
async function main() {
  const opts = parseArgs();
  
  // Ensure output directory exists
  if (!fs.existsSync(opts.outputDir!)) {
    fs.mkdirSync(opts.outputDir!, { recursive: true });
  }
  
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                  Study 6: Supplementary Tool Comparison                    ║
║ Comparing AI Accessibility Assistant vs Lighthouse vs axe-core             ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
  
  try {
    const fixturesToRun = opts.allFixtures
      ? STUDY_6_FIXTURES
      : [STUDY_6_FIXTURES.find(f => f.name === opts.fixture) || STUDY_6_FIXTURES[0]];
    
    for (const fixture of fixturesToRun) {
      await analyzeFixture(fixture, opts);
    }
    
    console.log(`\n✓ Study 6 analysis complete. Results saved to ${opts.outputDir}`);
  } catch (err) {
    console.error(`✗ Error during analysis: ${err}`);
    process.exit(1);
  }
}

main();
