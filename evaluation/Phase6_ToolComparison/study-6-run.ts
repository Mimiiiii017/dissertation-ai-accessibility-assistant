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

interface SupplementaryToolOutputs {
  axeLinter: ToolFinding[] | null;
  eslintJsxA11y: ToolFinding[] | null;
  webhint: ToolFinding[] | null;
  stylelintA11y: ToolFinding[] | null;
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
 * Run Axe Accessibility Linter (axe CLI).
 * Note: this tool is URL/DOM oriented and not applicable to raw CSS-only source.
 */
async function runAxeLinter(url: string): Promise<ToolFinding[] | null> {
  console.log(`[Axe Linter] Running axe CLI on ${url}...`);

  try {
    const chromedriverPath = `${process.env.HOME}/.browser-driver-manager/chromedriver/linux-148.0.7778.167/chromedriver-linux64/chromedriver`;
    const chromePath = `${process.env.HOME}/.browser-driver-manager/chrome/linux-148.0.7778.167/chrome-linux64/chrome`;
    const cmd = `npx --yes @axe-core/cli ${url} -j --chromedriver-path "${chromedriverPath}" --chrome-path "${chromePath}"`;

    let stdout = '';
    try {
      ({ stdout } = await execAsync(cmd, { timeout: 90000, maxBuffer: 10 * 1024 * 1024 }));
    } catch (err: any) {
      // axe CLI can exit non-zero when violations exist; parse its stdout anyway.
      stdout = err?.stdout || '';
      if (!stdout) {
        throw err;
      }
    }

    // axe CLI -j outputs JSON array: [{violations:[...], passes:[...], ...}, ...]
    const jsonStart = stdout.indexOf('[');
    const jsonEnd = stdout.lastIndexOf(']');
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
      ? stdout.slice(jsonStart, jsonEnd + 1)
      : '[]';
    const parsed = JSON.parse(jsonText);

    const findings: ToolFinding[] = [];
    // Flatten violations across all page results in the array
    const violations = Array.isArray(parsed)
      ? parsed.flatMap((r: any) => Array.isArray(r?.violations) ? r.violations : [])
      : Array.isArray(parsed?.violations) ? parsed.violations : [];
    for (const violation of violations) {
      const nodes = Array.isArray(violation?.nodes) ? violation.nodes : [];
      if (nodes.length === 0) {
        findings.push({
          wcag: (violation?.tags || []).find((t: string) => /^wcag/i.test(t)) || 'unknown',
          issueType: violation?.id || 'axe-linter-issue',
          severity: violation?.impact === 'critical' ? 'error' : 'warning',
          description: violation?.description || violation?.help || 'Issue reported by Axe Accessibility Linter.',
          toolSource: 'axeLinter',
        });
        continue;
      }

      for (const node of nodes) {
        findings.push({
          wcag: (violation?.tags || []).find((t: string) => /^wcag/i.test(t)) || 'unknown',
          issueType: violation?.id || 'axe-linter-issue',
          severity: violation?.impact === 'critical' ? 'error' : 'warning',
          description: violation?.description || violation?.help || 'Issue reported by Axe Accessibility Linter.',
          element: (node?.target && node.target[0]) || node?.html,
          toolSource: 'axeLinter',
        });
      }
    }

    console.log(`[Axe Linter] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.warn(`[Axe Linter] Failed: ${err}`);
    return null;
  }
}

/**
 * Run ESLint + jsx-a11y on JS/TSX source.
 */
async function runEslintJsxA11y(sourceContent: string, fixture: Study6Fixture, outputDir: string): Promise<ToolFinding[] | null> {
  if (fixture.sourceType !== 'tsx') {
    console.log('[ESLint jsx-a11y] Not applicable (requires TSX), skipping.');
    return null;
  }

  console.log(`[ESLint jsx-a11y] Running on ${fixture.name}...`);

  try {
    const tempDir = path.join(outputDir, 'tmp-lint');
    fs.mkdirSync(tempDir, { recursive: true });
    const ext = fixture.sourceType === 'tsx' ? '.tsx' : '.js';
    const filePath = path.join(tempDir, `${fixture.name}${ext}`);
    fs.writeFileSync(filePath, sourceContent, 'utf-8');

    const { ESLint } = require('eslint');
    const tsParser = require('@typescript-eslint/parser');

    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfig: {
        parser: fixture.sourceType === 'tsx' ? '@typescript-eslint/parser' : undefined,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
        },
        plugins: ['jsx-a11y'],
        extends: ['plugin:jsx-a11y/recommended'],
        rules: {
          // Text alternatives
          'jsx-a11y/alt-text': 'error',
          // ARIA role rules
          'jsx-a11y/aria-role': 'error',
          'jsx-a11y/aria-props': 'error',
          'jsx-a11y/aria-unsupported-elements': 'warn',
          'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
          // Heading rules
          'jsx-a11y/heading-has-content': 'warn',
          // Link rules
          'jsx-a11y/anchor-is-valid': 'warn',
          // Form rules
          'jsx-a11y/label-has-associated-control': 'warn',
          // Interactive element rules
          'jsx-a11y/no-static-element-interactions': 'error',
          'jsx-a11y/click-events-have-key-events': 'error',
          'jsx-a11y/interactive-supports-focus': 'error',
          'jsx-a11y/no-noninteractive-element-interactions': 'error',
          'jsx-a11y/no-noninteractive-tabindex': 'error',
          // Keyboard event rules
          'jsx-a11y/mouse-events-have-key-events': 'error',
          // Scope attribute rules
          'jsx-a11y/scope': 'warn',
          // Image role rules
          'jsx-a11y/img-redundant-alt': 'warn',
        },
      },
    });

    // Make sure parser package is loaded when TSX is used.
    void tsParser;

    const results = await eslint.lintFiles([filePath]);

    // If the file cannot be parsed, this tool did not run meaningfully.
    // Return null so downstream reporting shows N/A rather than a misleading 0.
    const fatalResult = results.find((r: any) => (r.fatalErrorCount || 0) > 0);
    if (fatalResult) {
      const fatalMessage = (fatalResult.messages || []).find((m: any) => m.fatal)?.message || 'Unknown parsing/config error';
      console.warn(`[ESLint jsx-a11y] Fatal parse/config error: ${fatalMessage}`);
      return null;
    }

    const findings: ToolFinding[] = [];
    for (const result of results) {
      for (const message of result.messages || []) {
        if (!message.ruleId || !message.ruleId.startsWith('jsx-a11y/')) {
          continue;
        }
        findings.push({
          wcag: 'unknown',
          issueType: message.ruleId,
          severity: message.severity === 2 ? 'error' : 'warning',
          description: message.message,
          element: message.line ? `Line ${message.line}` : undefined,
          toolSource: 'eslintJsxA11y',
        });
      }
    }

    console.log(`[ESLint jsx-a11y] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.warn(`[ESLint jsx-a11y] Failed: ${err}`);
    return null;
  }
}

/**
 * Run webhint against the rendered harness URL.
 */
async function runWebhint(url: string): Promise<ToolFinding[] | null> {
  console.log(`[Webhint] Running on ${url}...`);

  try {
    // Use webhint built-in configuration to avoid interactive missing-package/config errors.
    const cmd = `npx --yes hint ${url} -f json`;

    let stdout = '';
    try {
      ({ stdout } = await execAsync(cmd, { timeout: 90000, maxBuffer: 10 * 1024 * 1024 }));
    } catch (err: any) {
      // webhint can return non-zero if hints are found; parse formatter output anyway.
      stdout = err?.stdout || '';
      if (!stdout) {
        throw err;
      }
    }

    const jsonStart = stdout.indexOf('[');
    const jsonEnd = stdout.lastIndexOf(']');
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
      ? stdout.slice(jsonStart, jsonEnd + 1)
      : '[]';
    const parsed = JSON.parse(jsonText);

    const findings: ToolFinding[] = [];
    const items = Array.isArray(parsed) ? parsed : [];

    for (const item of items) {
      // webhint severity is typically numeric: 1..4 (>= 4 is error)
      const numericSeverity = Number(item?.severity);
      const hintId = item?.hintId || item?.ruleId || 'webhint';
      const location = item?.location;

      findings.push({
        wcag: 'unknown',
        issueType: hintId,
        severity: Number.isFinite(numericSeverity) && numericSeverity >= 4 ? 'error' : 'warning',
        description: item?.message || 'Issue reported by webhint.',
        element: location ? `${item?.resource || ''}:${location?.line || ''}` : item?.resource,
        toolSource: 'webhint',
      });
    }

    console.log(`[Webhint] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.warn(`[Webhint] Failed: ${err}`);
    return null;
  }
}

/**
 * Run stylelint with stylelint-a11y rules on CSS source.
 */
async function runStylelintA11y(sourceContent: string, fixture: Study6Fixture): Promise<ToolFinding[] | null> {
  if (fixture.sourceType !== 'css') {
    console.log('[stylelint-a11y] Not applicable to this fixture type, skipping.');
    return null;
  }

  console.log(`[stylelint-a11y] Running on ${fixture.name}...`);

  try {
    const stylelint = require('stylelint');
    const result = await stylelint.lint({
      code: sourceContent,
      codeFilename: path.basename(fixture.filePath),
      config: {
        plugins: ['@double-great/stylelint-a11y'],
        rules: {
          'a11y/media-prefers-reduced-motion': true,
          'a11y/no-display-none': true,
          'a11y/no-obsolete-attribute': true,
        },
      },
    });

    const findings: ToolFinding[] = [];
    const warnings = result?.results?.[0]?.warnings || [];
    for (const warning of warnings) {
      findings.push({
        wcag: 'unknown',
        issueType: warning.rule || 'stylelint-a11y',
        severity: warning.severity === 'error' ? 'error' : 'warning',
        description: warning.text || 'Issue reported by stylelint-a11y.',
        element: warning.line ? `Line ${warning.line}` : undefined,
        toolSource: 'stylelintA11y',
      });
    }

    console.log(`[stylelint-a11y] Found ${findings.length} issues`);
    return findings;
  } catch (err) {
    console.warn(`[stylelint-a11y] Failed: ${err}`);
    return null;
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
  const supplementary: SupplementaryToolOutputs = {
    axeLinter: null,
    eslintJsxA11y: null,
    webhint: null,
    stylelintA11y: null,
  };

  // Always start server for URL-based tools (axeLinter, webhint, Lighthouse, axe-core)
  const harness = buildBrowserHarness(fixture, sourceContent);
  const server = await startLocalServer(harness.html, fixture, opts.serverPort!, harness.virtualFiles);
  const url = `http://localhost:${opts.serverPort}`;

  if (fixture.runBrowserAudits) {
    // 2. Lighthouse (rendered DOM)
    const lighthouseOutputPath = path.join(opts.outputDir!, `lighthouse-${fixture.name}.json`);
    lighthouseFindings = await runLighthouse(url, lighthouseOutputPath);

    // 3. axe-core (rendered DOM)
    const browser = await puppeteer.launch({ headless: opts.headless });
    axeCoreFindings = await runAxeCore(browser, url);
    await browser.close();
  } else {
    console.log(`[Browser Audits] Skipped for ${fixture.sourceType.toUpperCase()} fixture (fairness setting)`);
  }

  // 4. Supplementary URL-capable tools (work regardless of runBrowserAudits)
  supplementary.axeLinter = await runAxeLinter(url);
  supplementary.webhint = await runWebhint(url);

  // 5. Stop server
  server.close();

  // 6. Supplementary source linters.
  supplementary.eslintJsxA11y = await runEslintJsxA11y(sourceContent, fixture, opts.outputDir!);
  supplementary.stylelintA11y = await runStylelintA11y(sourceContent, fixture);
  
  // 8. Generate comparison report
  const report = createComparisonReport(
    fixture.name,
    fixture.errorCount,
    opts.aiModel!,
    aiFindings,
    lighthouseFindings,
    axeCoreFindings,
    supplementary,
  );
  
  // 9. Save and print results
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
║ Core: AI + Lighthouse + axe-core | Extra: axe-linter, jsx-a11y, webhint   ║
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
