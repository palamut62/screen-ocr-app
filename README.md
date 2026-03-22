# Screen OCR

AI-powered screen text extraction and image annotation tool for Windows.

## Screenshots

### Main Interface (Dark Theme)
![Main Interface](screenshots/main-dark.png)

### Editor with Floating Toolbar
![Editor Toolbar](screenshots/editor-toolbar.png)

## Features

### OCR & Text Extraction
- **Select Area** — Capture any screen region and extract text using AI vision models
- **Clipboard Scan** — Extract text directly from images in your clipboard
- **AI Text Correction** — Automatically fix OCR character errors using a secondary AI model
- **Focus Capture** — Capture focused window content

### Image Editor
- **Floating Toolbar** — Clean pill-shaped toolbar at the bottom of the canvas
- **Freehand Drawing** — Smooth pen strokes with adjustable width
- **Highlighter** — Semi-transparent marker for emphasis
- **Shapes** — Rectangle, oval, arrow, and line tools
- **Text Tool** — Multi-line text with bold, italic, and background options
- **Eraser** — Remove annotations precisely
- **Color Picker** — Quick color selection with 6 preset colors
- **Width Presets** — 4 line width options shown as visual dots
- **Undo/Redo** — Full history support (Ctrl+Z / Ctrl+Y)
- **Copy & Save** — Export annotated images to clipboard or file

### Multi-Region Blur
- **Selective Blur** — Select multiple areas to keep sharp, blur everything else
- **Privacy Protection** — Quickly redact sensitive content in screenshots

### General
- **Multi-language UI** — Turkish and English with one click
- **Light / Dark Theme** — Toggle between themes instantly
- **Global Hotkey** — Press `Ctrl+Shift+X` anywhere to start a capture
- **System Tray** — Runs quietly in the background
- **Auto-launch** — Optionally start with Windows

## Download

Download the latest installer from the [Releases](https://github.com/palamut62/screen-ocr-app/releases) page.

## Getting Started

1. Install and launch Screen OCR
2. Open **Settings** and enter your [OpenRouter](https://openrouter.ai/) API key
3. Click **Fetch Models** and select an OCR vision model (free models available)
4. Optionally enable AI text correction and select a correction model
5. Click **Select Area** or press `Ctrl+Shift+X` to capture and extract text

## Editor Tools

| Tool | Shortcut | Description |
|------|----------|-------------|
| Draw | — | Freehand pen drawing |
| Highlighter | — | Semi-transparent marker |
| Arrow | — | Double-ended arrow |
| Line | — | Straight line |
| Rectangle | — | Rectangle outline |
| Oval | — | Ellipse outline |
| Text | — | Multi-line text editor |
| Eraser | — | Erase annotations |
| Undo | Ctrl+Z | Undo last action |
| Redo | Ctrl+Y | Redo undone action |

## Tech Stack

- **Electron** — Desktop application framework
- **React + TypeScript** — UI components
- **Vite** — Fast build tooling
- **Sharp** — Image processing and cropping
- **OpenRouter API** — AI vision and text model access

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create installer
npm run dist
```

## Build Requirements

- Node.js 18+
- Windows 10/11 (x64)

## License

MIT
