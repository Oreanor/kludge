# AIR - AI React Extension for VS Code

A VS Code extension that adds an intelligent chat interface in the Explorer sidebar for seamless AI interactions within your editor.

## Features

- 💬 Interactive chat panel in VS Code sidebar
- 🎨 React-based UI with modern interface
- 🔌 Easy extensibility for multiple AI providers
- 🔒 Secure content handling with CSP
- ⚡ Real-time message exchange

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/air.git
   cd air
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Open in VS Code and press `F5` to run in debug mode, or package for release.

## Usage

1. Open VS Code with the extension loaded
2. Look for the **AIR Chat** panel in the Explorer sidebar (left panel)
3. Type your message and press Enter to send
4. Responses will appear in the chat history

## Development

### Available Commands

- `npm run build` - Build extension and webview
- `npm run watch` - Watch for changes and rebuild
- `npm run compile` - Compile extension only
- `npm run build:webview` - Build webview only
- `npm run lint` - Lint source code
- `npm run test` - Run tests

### Project Structure

```
src/              - Extension code (TypeScript)
webview/          - React UI code
dist/             - Built files (auto-generated)
```

### Making Changes

- **Extension logic**: Edit files in `src/`
- **Chat UI**: Edit files in `webview/src/`
- Run `npm run watch` to automatically rebuild on changes
- Press `Ctrl+R` in debug window to reload extension

### Add a New AI Provider

Edit `src/chatProvider.ts` in the `_handleMessage` method to integrate your AI service.

## Debugging

1. Press `F5` to open a new VS Code window with the extension
2. Open the chat panel to test
3. Use `Ctrl+Shift+I` for webview DevTools
4. Use VS Code's debug console for extension logs

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT

---

For Russian documentation, see [README.ru.md](README.ru.md)
