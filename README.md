# AI Accessibility Assistant

AI Accessibility Assistant is a VS Code extension that combines:

- Fast baseline accessibility checks
- Local LLM analysis through Ollama
- RAG retrieval from your local accessibility and NASA-TLX knowledge bases

It runs as a sidebar panel in VS Code and writes issues to the Problems tab.

## Features

- **Accessibility analysis (code-focused):**
	- Baseline checks (no LLM required):
		- Missing/empty `alt` text on `<img>` elements
		- `<input>` fields without associated labels
		- Potential missing focus styles in CSS
	- AI analysis using local Ollama + RAG context from WCAG/accessibility docs
	- Issues are streamed live into the panel and converted to VS Code diagnostics

- **NASA-TLX cognitive workload analysis:**
	- Per-dimension scores for:
		- Mental Demand
		- Physical Demand
		- Temporal Demand
		- Performance
		- Effort
		- Frustration
	- Confidence scores and overall cognitive load summary card

- **Analysis profile presets:**
	- Uses fixed model: `qwen3-coder-next:cloud`
	- Lets you select and persist an analysis preset (`balanced`, `strict`, `thorough`, `quick`)
	- Warms the fixed model for faster first response

## Requirements

- VS Code `^1.108.0`
- An Ollama server that can run `qwen3-coder-next:cloud`
- Python 3.10+ for the local RAG service
- Knowledge base files in this repository (`knowledge-base/Accessibility-Analysis` and `knowledge-base/NASA-TLX`)

## Setup

### 1) Start Ollama

```bash
ollama serve
```

In another terminal, verify the fixed model is available:

```bash
ollama run qwen3-coder-next:cloud
```

### 2) Start the RAG service

From the repository root:

```bash
cd services/rag
python -m venv .venv
source .venv/bin/activate
pip install fastapi "uvicorn[standard]" chromadb sentence-transformers
uvicorn app:app --host 127.0.0.1 --port 8000
```

In a new terminal, index both knowledge bases:

```bash
curl -X POST "http://127.0.0.1:8000/index?kb_type=accessibility"
curl -X POST "http://127.0.0.1:8000/index?kb_type=tlx"
```

Re-run indexing whenever knowledge-base files change.

### 3) Run the extension in development

```bash
cd extension/ai-accessibility-assistant
npm install
npm run compile
```

Then press `F5` in VS Code to launch an Extension Development Host window.

## Usage

1. Open any code file in VS Code.
2. Open the **Accessibility Assistant** view from the Activity Bar.
3. Select an analysis profile preset from the dropdown.
4. Click **Analyse File** for accessibility diagnostics.
5. Click **TLX Analysis** for cognitive workload analysis.
6. Review diagnostics in the **Problems** panel.

## Commands

- `Accessibility: Analyse Current File` (`ai-accessibility-assistant.analyseFile`)
- `Accessibility: NASA TLX Analysis` (`ai-accessibility-assistant.tlxAnalysis`)
- `Accessibility: Select Analysis Profile` (`ai-accessibility-assistant.selectModel`)

## Extension Settings

- `aiAccessibilityAssistant.ollamaHost` (default: `http://localhost:11434`)
	- Base URL for Ollama
- Fixed model used for analysis: `qwen3-coder-next:cloud`
- `aiAccessibilityAssistant.analysisPreset` (default: `balanced`)
	- Selected analysis profile preset (`balanced`, `strict`, `thorough`, `quick`)
- `aiAccessibilityAssistant.ragEndpoint` (default: `http://127.0.0.1:8000`)
	- Base URL for the local RAG service

## Development Scripts

- `npm run compile` — Type-check, lint, and build
- `npm run watch` — Watch mode for TypeScript and esbuild
- `npm run lint` — Run ESLint on `src`
- `npm run check-types` — Run TypeScript checks
- `npm run test` — Run extension tests

## Troubleshooting

- **No presets shown in dropdown**
	- Reload the extension host and reopen the panel.
	- Confirm the extension compiled cleanly (`npm run compile`).

- **RAG returns no context**
	- Confirm RAG service is running at `aiAccessibilityAssistant.ragEndpoint`.
	- Confirm both indexes were built (`/index?kb_type=accessibility` and `/index?kb_type=tlx`).

- **Analysis fails or times out**
	- Try the `quick` analysis profile preset.
	- Verify local machine resources (RAM/CPU) are sufficient.

## Release Notes

See [CHANGELOG.md](./CHANGELOG.md).
