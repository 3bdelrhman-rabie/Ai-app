# Implementation Plan: Dynamic API-Aware Model Filtering & Capabilities Routing

## 1. Overview & Objective
Currently, several models that require paid or external API keys (such as OpenAI DALL-E 3, Claude, SDXL, and Pro Studio) are pre-populated in the selector lists even when the user has not provided an API key for them. This creates clutter and leads to API key errors when selected.

The goal of this update is to:
1. **Show only Zero-Key models by default**:
   - **Text Mode**: Only the built-in Google Gemini (`gemini-3.8-flash`) that works automatically within the environment without entering an API key.
   - **Image Mode**: Only `Nano Banana (Free · No API Key)` that works out of the box with zero configuration.
2. **Strictly gate all other models behind user-provided API keys**:
   - Models requiring API keys will **never** appear in the selector unless the user has added and enabled a valid API key for that provider.
3. **Automated Multi-Modal Capability Routing**:
   - When the user adds and saves an API key for any model:
     - If the model generates **text** -> automatically add it to the **Text Mode** selector.
     - If the model generates **images** -> automatically add it to the **Image Mode** selector.
     - If the model supports **both** (multimodal) -> automatically display it in **both** selectors.
     - Pure image models are strictly excluded from Text Mode, and pure text models are strictly excluded from Image Mode.

---

## 2. Proposed Changes

### A. Model List Filtering in `services/aiService.ts`
- **Clean up `getImageModelOptions`**:
  - Remove all pre-populated placeholder image models that require unentered API keys (e.g., static DALL-E 3, DALL-E 2, Flux, SDXL, Pro Image entries when no matching keys exist).
  - Retain `Nano Banana (Free · No API Key)` as the permanent zero-key image engine.
  - Dynamically check the `keys` parameter:
    - Only iterate through keys that are `isEnabled` **and** have a non-empty `apiKey` (or custom endpoint).
    - For OpenAI: add DALL-E models only if the OpenAI key is saved and has an `apiKey`.
    - For OpenRouter: add Flux/SDXL only if the OpenRouter key is saved and has an `apiKey`.
    - For Gemini: add Flash Lite Image or Pro Image only if a valid Gemini key is present.

### B. Dynamic Model Routing in `components/ModelSelectorBar.tsx`
- Refactor the selectable options logic:
  - **In Text / Problem-Solving Mode (`AppMode.SOLVE`, `AppMode.MAP`, `AppMode.PROMPT`)**:
    - Include the built-in default Gemini model.
    - Inspect user keys that are enabled **and** possess an active `apiKey`.
    - Evaluate model capabilities with `detectModelCapabilities(provider, model)`.
    - Include only models whose capabilities include `text`, `reasoning`, or `code`.
    - Strictly exclude pure image generators (like DALL-E, Nano Banana, Flux).
  - **In Image Mode (`AppMode.MEDIA`)**:
    - Always include `Nano Banana (Free · No API Key)`.
    - Inspect enabled keys with non-empty `apiKey`s.
    - Evaluate model capabilities with `detectModelCapabilities(provider, model)`.
    - Include models whose capabilities include `image`.
    - Strictly exclude pure text models (like Claude, DeepSeek, LLaMA).
  - **Multimodal Models**:
    - Models supporting both text and image generation (e.g. models tagged with both `text` and `image` in their capabilities) will naturally qualify for both conditions and appear in both modes seamlessly.

### C. Fallback & Active Selection Guard in `App.tsx`
- Ensure that the initial default state and fallback handlers only point to:
  - `activeModel`: Built-in Gemini Flash (`gemini-3.8-flash`).
  - `activeImageModel`: `Nano Banana (Free · No API Key)`.
- When switching modes or editing keys, prevent fallback to unkeyed models.
- If a user deletes or disables an API key, the active selection immediately resets to the zero-key default for that mode.

---

## 3. Verification & Validation Plan
1. **Initial Load Test (Zero Keys)**:
   - Verify Text Mode selector displays **only** Built-in Gemini Flash.
   - Verify Image Mode selector displays **only** Nano Banana Free.
   - Verify no DALL-E, Claude, OpenRouter, or DeepSeek models appear before entering keys.
2. **Add Text API Key (e.g., DeepSeek or Claude)**:
   - Add a key in API Settings.
   - Verify the new model appears in the Text Mode selector.
   - Verify it does **not** appear in the Image Mode selector.
3. **Add Image API Key (e.g., OpenAI with DALL-E 3)**:
   - Add an OpenAI key in API Settings.
   - Verify DALL-E appears in the Image Mode selector.
   - Verify DALL-E does **not** appear in the Text Mode selector.
4. **Build & Lint Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
