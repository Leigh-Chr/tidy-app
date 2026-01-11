# Tidy App

**Intelligent file organization tool with metadata extraction, smart renaming, and optional AI-powered analysis.**

Tidy App helps you organize, rename, and move files intelligently using metadata (EXIF, PDF properties, Office document info), customizable naming templates, and rule-based automation. Available as both a CLI tool and a desktop GUI application.

## Features

- **Smart File Scanning** - Recursively scan directories with progress reporting and cancellation support
- **Rich Metadata Extraction** - Extract EXIF from images, properties from PDFs, and metadata from Office documents
- **Flexible Naming Templates** - Create dynamic filenames using date, metadata, and file placeholders
- **Rule-Based Organization** - Define rules based on metadata patterns or filename globs to auto-apply templates
- **Folder Structure Definition** - Organize files into folders based on patterns (by year, month, category, etc.)
- **AI-Powered Folder Suggestions** - Let the AI analyze file content and suggest optimal folder organization
- **Preview Before Execute** - Always see what will happen before any files are modified
- **Conflict Detection** - Automatically detect and handle naming conflicts and duplicates
- **Operation History & Undo** - Track all operations and undo mistakes with full restoration
- **LLM Integration** - AI-powered content analysis with Ollama (local/offline) or OpenAI (cloud)
- **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Prerequisites

- Node.js 20 LTS or later
- pnpm 9.x or later

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/tidy-app.git
cd tidy-app

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Link CLI globally (optional)
cd packages/cli
pnpm link --global
```

### Desktop Application

To build the desktop GUI application, you also need:
- Rust toolchain (rustc, cargo)
- Tauri CLI prerequisites for your platform

```bash
# Build the desktop app
pnpm tauri:build
```

## Usage

### CLI

```bash
# Scan a folder and see file statistics
tidy scan /path/to/folder

# Show current configuration
tidy config show

# Reset configuration to defaults
tidy config reset

# View operation history
tidy history list

# Undo the last operation
tidy undo

# Restore a file to its original name
tidy restore /path/to/renamed-file.jpg

# Show app info and LLM status
tidy info
```

### GUI

Launch the desktop application and:
1. Drag & drop a folder or click to browse
2. Configure scan options (file types, recursion depth)
3. Select or create naming templates
4. Preview the proposed changes
5. Review and confirm the rename/move operation

## Project Structure

```
tidy-app/
├── packages/
│   ├── core/          # @tidy/core - Core business logic library
│   ├── cli/           # @tidy/cli - Command-line interface
│   └── config/        # @tidy/config - Shared TypeScript/ESLint configs
├── apps/
│   └── gui/           # Desktop application (Tauri + React)
├── turbo.json         # Turborepo configuration
└── pnpm-workspace.yaml
```

## Template Syntax

Templates use placeholders enclosed in curly braces:

```
{date:YYYY-MM-DD}_{name}.{ext}
```

### Available Placeholders

| Category | Placeholder | Description |
|----------|-------------|-------------|
| **Date** | `{date:FORMAT}` | Current date (e.g., `{date:YYYY-MM-DD}`) |
| **File** | `{name}` | Original filename without extension |
| | `{ext}` | File extension |
| | `{size}` | File size in bytes |
| **Image** | `{image.width}` | Image width in pixels |
| | `{image.height}` | Image height in pixels |
| | `{image.camera}` | Camera make/model |
| | `{image.dateTaken}` | Date photo was taken |
| **PDF** | `{pdf.pages}` | Number of pages |
| | `{pdf.author}` | Document author |
| | `{pdf.title}` | Document title |
| **Office** | `{doc.author}` | Document author |
| | `{doc.title}` | Document title |
| | `{doc.modified}` | Last modified date |

## Configuration

Configuration is stored in your platform's config directory:
- **Linux**: `~/.config/tidy-app/config.yaml`
- **macOS**: `~/Library/Application Support/tidy-app/config.yaml`
- **Windows**: `%APPDATA%\tidy-app\config.yaml`

### LLM Configuration (Optional)

To enable AI-powered file analysis and folder suggestions, configure either Ollama (local) or OpenAI (cloud):

**Using Ollama (local, works offline):**

```yaml
ollama:
  enabled: true
  provider: ollama
  baseUrl: http://localhost:11434
  models:
    inference: llama3.2
    vision: llava
  offlineMode: auto  # auto | enabled | disabled
```

**Using OpenAI (cloud):**

```yaml
ollama:
  enabled: true
  provider: openai
  openai:
    apiKey: sk-your-api-key
    model: gpt-4o-mini
    visionModel: gpt-4o
```

The AI can suggest both **filenames** and **folder organization** based on content analysis.

## Development

```bash
# Install dependencies
pnpm install

# Start development mode (all packages)
pnpm dev

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Build all packages
pnpm build
```

### Running the GUI in Development

```bash
# Start Tauri dev mode
pnpm tauri:dev
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.x (strict mode) |
| Runtime | Node.js 20 LTS |
| Desktop | Tauri 2.0 (Rust backend) |
| Frontend | React 19, Vite 7 |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI, shadcn/ui |
| State | Zustand 5 |
| Validation | Zod 4 |
| CLI | Commander.js |
| Monorepo | Turborepo, pnpm workspaces |
| Testing | Vitest, Playwright |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Tauri](https://tauri.app/) for the excellent desktop app framework
- [Ollama](https://ollama.ai/) for local LLM capabilities
- [ExifReader](https://github.com/nicolo-ribaudo/exif-reader) for EXIF extraction
- All contributors and the open source community
