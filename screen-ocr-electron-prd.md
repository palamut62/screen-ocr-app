# Screen OCR Electron App --- Product Requirements Document (PRD)

## 1. Product Overview

A lightweight Electron desktop application that allows users to select
any visible region on their screen and extract text from it instantly
using AI-based OCR via the OpenRouter API.

The application supports: - Printed text - Handwritten text -
Multilingual text - Text inside images, UI interfaces, videos, and PDFs

The extracted text can be copied directly to the clipboard or exported
as structured data.

Primary goal: **Fast, accurate screen text extraction from any visible
area on the user's computer.**

------------------------------------------------------------------------

# 2. Core Features

## 2.1 Screen Region Selection

Users can capture text from any area of the screen.

### Behavior

-   User presses global hotkey
-   Screen overlay appears
-   User selects region using mouse drag
-   Screenshot is captured
-   OCR processing begins

### Requirements

-   Transparent fullscreen overlay
-   Smooth drag selection
-   ESC cancels selection
-   ENTER confirms selection

------------------------------------------------------------------------

# 3. OCR Processing Pipeline

The system uses a multi-stage OCR approach.

### Step 1 --- Image Capture

Capture selected screen region.

### Step 2 --- Image Preprocessing

Improve OCR accuracy using:

-   grayscale conversion
-   contrast enhancement
-   sharpening
-   optional upscaling
-   noise reduction

Library: - Sharp (Node.js)

### Step 3 --- AI OCR (OpenRouter)

Images are sent to OpenRouter Vision models.

Model routing strategy:

  Priority   Model                                 Purpose
  ---------- ------------------------------------- ---------------------
  1          nvidia/nemotron-nano-12b-v2-vl:free   Free fast OCR
  2          qwen/qwen3-vl-8b-instruct             Main production OCR
  3          qwen/qwen2.5-vl-32b-instruct          Hard cases fallback

Fallback occurs when: - confidence score is low - result length is
suspiciously short - handwriting is detected

------------------------------------------------------------------------

# 4. Output Format

OCR results must return structured JSON.

Example:

    {
      "fullText": "...",
      "language": "auto",
      "confidence": 0.87,
      "containsHandwriting": false,
      "lines": [
        {
          "text": "Example text",
          "bbox": [x, y, w, h],
          "confidence": 0.92
        }
      ]
    }

------------------------------------------------------------------------

# 5. User Interface

## 5.1 Main Window

Size: 360x160 px

Elements:

-   Select Area
-   Scan Clipboard Image
-   Last Result
-   Settings

## 5.2 Overlay Capture Mode

Fullscreen transparent overlay.

Features: - drag selection box - highlight selected region - ESC
cancel - ENTER confirm

## 5.3 Result Popup

Small popup window displaying extracted text.

Buttons:

-   Copy
-   Rescan
-   Show JSON
-   Save

------------------------------------------------------------------------

# 6. Settings Panel

User configurable options:

-   OpenRouter API Key
-   OCR model priority
-   Free-first toggle
-   Image preprocessing options
-   Default output language
-   Global hotkey
-   Auto copy result

------------------------------------------------------------------------

# 7. Application Architecture

### Desktop Framework

Electron + React + TypeScript

### OCR Engine

OpenRouter API

### Image Processing

Sharp

### Storage

electron-store

### Networking

Axios

### Clipboard

Electron clipboard API

------------------------------------------------------------------------

# 8. Folder Structure

    screen-ocr-app/

    electron/
      main.ts
      preload.ts
      overlay-window.ts
      capture.ts

    renderer/
      app.tsx
      result-panel.tsx
      settings.tsx
      styles.css

    core/
      ocr/
        openrouter-client.ts
        model-router.ts
        prompts.ts

      image/
        preprocess.ts

    storage/
      settings-store.ts

    package.json

------------------------------------------------------------------------

# 9. Performance Targets

Target latency:

  Stage            Target
  ---------------- ---------
  Capture          \<100ms
  Preprocess       \<300ms
  OCR Fast Model   1-3 sec
  OCR Fallback     3-8 sec

Total expected time: **1-5 seconds typical.**

------------------------------------------------------------------------

# 10. Security

-   API key stored locally encrypted
-   No image history saved unless user enables history
-   No telemetry by default

------------------------------------------------------------------------

# 11. MVP Scope

Version 1 features:

-   screen region selection
-   OCR extraction
-   copy to clipboard
-   OpenRouter integration
-   settings page
-   free model routing
-   fallback OCR

------------------------------------------------------------------------

# 12. Future Roadmap

### Version 1.1

-   line bounding boxes
-   OCR history
-   handwriting detection

### Version 2

-   live screen text detection
-   hover text capture
-   table extraction
-   instant translation mode
-   screen text highlight overlay

------------------------------------------------------------------------

# 13. Prompt Template

Vision model prompt:

You are an OCR engine specialized in multilingual screen text
extraction.

Extract every visible text exactly as written.

Rules: - support printed and handwritten text - preserve line breaks -
do not summarize - do not translate - keep punctuation exactly - return
strict JSON output

------------------------------------------------------------------------

# 14. Use Cases

Common scenarios:

-   Copy text from images
-   Extract subtitles from video
-   Capture text from PDFs
-   Capture UI text from applications
-   Extract handwritten notes
-   Copy text from protected viewers

------------------------------------------------------------------------

# 15. Success Metrics

Product success measured by:

-   OCR accuracy
-   capture speed
-   user interaction simplicity
-   cost efficiency via model routing

Target: **95%+ readable OCR accuracy for standard screen text.**
