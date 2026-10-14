# Exhaustive Web Intelligence Pipeline & Top Header Optimization

An advanced two-stage neural synthesis architecture that unleashes full-token real-time web harvesting via a dedicated search model, feeding an exhaustive dossier into the user's selected primary reasoning model, alongside a streamlined top header layout.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following architectural and interface requirements:
> 1. **Complete Online Data Transfer via Search Harvester**: The time check was a test case for whether the user's model receives complete live online data. The search model will be configured with maximum output tokens, exhaustive depth, and deep thinking enabled to collect all relevant articles, technical details, dates, and live facts without premature summarization.
> 2. **Verified Source Citations**: Verified source links collected by the search engine will continue to be displayed neatly under the final message for user reference.
> 3. **Top Header Decluttering**: Remove the application title ("MechEng Omni-Bot") from the top bar to free up critical horizontal space, centering the model selector and active API badge with balanced side action buttons.

---

## 1. Overview & Core Concept

### What It Does
When the user submits a message with Web Search enabled:
1. **Stage 1 (Headless Web Harvester)**: The query is first dispatched to the user-selected Search Engine (e.g., `gemini-flash-latest` or `gemini-3.8-flash`) configured with **maximum tokens** and **deep thinking**. It executes live Google Search grounding and compiles an exhaustive, uncompressed factual intelligence dossier containing all primary documentation, article content, dates, and live facts.
2. **Stage 2 (Primary Model Synthesis & Reasoning)**: The user's chosen primary model (e.g., `GPT-4o`, `Claude 3.7`, `DeepSeek R1`, or `Groq`) receives an AI-optimized prompt containing the original question and the complete web dossier. It performs deep reasoning and delivers the authoritative final answer.
3. **Stage 3 (Streamlined Header UI)**: The top navigation bar removes the static app brand text, giving full prominence to the model selector and active API badge centered smoothly across viewports.

### Target Audience & Persona
Engineers, researchers, and power users who need the specific reasoning strengths of OpenAI, Claude, or DeepSeek models backed by Google's real-time web crawler with zero information loss.

---

## 2. User Experience & Visual Design

### Top Header Redesign
- **Left Wing**: Sidebar toggle button with clean icon styling.
- **Center Wing**: Prominently centered Model Selector dropdown alongside the clickable Active API Key badge and status indicators.
- **Right Wing**: Global action buttons (Search Engine Quick Toggle, API Settings, New Chat, Session Controls) with balanced spacing and no cramped wrapping on mobile or desktop.

### Two-Stage Progress Indicator
- When a search-grounded prompt is submitted, the chat display shows an informative status pill:
  - *Phase 1*: `"🌐 Harvesting exhaustive online intelligence & documentation..."`
  - *Phase 2*: `"🧠 Analyzing intelligence dossier with [Selected Model]..."`
- Once complete, the final message is rendered with verified clickable web source pills directly beneath the response text.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Maximum Token Allocation for Search Harvester
- **Chosen Approach**: Configure the background search harvester call with `maxOutputTokens: 64000` (or model ceiling) and deep thinking enabled. The search prompt explicitly directs the harvester to embed article excerpts, tables, and specifications rather than short summaries.
- **Why**: Non-Gemini models cannot access URLs directly; passing full textual data ensures the secondary model has complete ground truth.

### Decision 2: Optimized Two-Stage Prompts
- **Stage 1 Prompt (Search Harvester)**: Formatted with precise XML tags (`<user_inquiry>`, `<harvesting_directives>`, `<live_temporal_context>`) instructing the model to harvest all facts, data points, and context objectively without conversational filler.
- **Stage 2 Prompt (Primary Model)**: Formatted with clean context demarcation (`<ground_truth_dossier>` and `<synthesis_instruction>`), directing the target model to reason through all provided data and deliver a comprehensive response.

---

## 4. Technical Architecture & Data Strategy

### Two-Stage Pipeline Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Submits Prompt                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         [Search Grounding Enabled]
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Stage 1: Dedicated Search Engine Harvester                 │
│  - Model: User's Search Model (gemini-flash-latest / gemini-3.8-flash) │
│  - Configuration: Max Output Tokens (64k) + Deep Thinking Enabled      │
│  - Grounding: Google Search Tool with live temporal context            │
│  - Output: Exhaustive, uncompressed web intelligence dossier           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Complete Factual Dossier + Sources
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Stage 2: Target Model Synthesis & Deep Reasoning           │
│  - Model: User's Chosen Model (e.g. GPT-4o, Claude 3.7, DeepSeek)      │
│  - Configuration: Active reasoning effort & token length controls      │
│  - Input: System persona + Optimized multi-context prompt              │
│  - Output: Authoritative, definitive answer based on live intelligence │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Chat UI Render with Verified Source Badges              │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & File Mapping

1. `services/aiService.ts`:
   - Upgrade `executeDeepWebResearch` to configure maximum output tokens (`64000`), deep thinking budget, and current temporal context.
   - Refactor `researchPrompt` into an AI-optimized directive prompting exhaustive data extraction without truncation.
   - Refactor the Stage 2 prompt inside `generateUniversalResponse` to feed the uncompressed dossier with clear analytical instructions.
2. `App.tsx`:
   - Update `renderHeader` to remove the static `"MechEng Omni-Bot"` logo text.
   - Restructure the top bar layout using `justify-between` with a centered container for the model selector and active API badge.
   - Ensure responsive spacing so controls remain comfortable on mobile and desktop.
