# Article Summarizer - Chrome Extension

<div align="center">

**⚡ AI-Powered Article Summarization with Lightning-Fast Speed**

Get concise, intelligent summaries of any article with one click. Powered by Groq and Gemini AI.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ Features

- 🚀 **Ultra-Fast Summaries** - Powered by Groq AI (1-2 second response time)
- 🤖 **Smart Fallback** - Automatic fallback to Gemini AI for reliability
- 🌐 **Multi-Language Support** - Translate summaries to Hindi (more languages coming)
- 💾 **Smart Caching** - Instant summary recall without API calls
- 🎨 **Beautiful UI** - Modern, responsive design with smooth animations
- 📱 **Mobile-Friendly** - Works on all screen sizes
- 🔒 **Privacy-First** - API keys stored locally, no third-party tracking

---

## 🚀 Installation

### From Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/article-summarizer.git
   cd article-summarizer
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the extension directory

3. **Configure API Keys** (See Setup section below)

---

## ⚙️ Setup

The extension requires at least one AI API key to function. We recommend configuring both for best results.

### Option 1: Groq (Recommended for Speed) 🚀

1. Visit [Groq Console](https://console.groq.com/keys)
2. Sign up for a free account
3. Create an API key
4. Open extension options (click extension icon → Options)
5. Paste key in "Groq API Key" field
6. Click "Save Settings"

**Result**: Ultra-fast summaries (1-2 seconds)

### Option 2: Gemini (Reliable Fallback) 🤖

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create an API key
4. Open extension options
5. Paste key in "Gemini API Key" field
6. Click "Save Settings"

**Result**: Reliable, high-quality summaries

### Option 3: Both (Best Setup) ⚡

Configure both API keys for optimal experience:
- **Groq** for speed (primary)
- **Gemini** for reliability (fallback)

---

## 📚 Usage

1. **Navigate to any article** on the web
2. **Click the "Summarize" button** that appears in the bottom-right corner
3. **View your summary** in the beautiful side panel
4. **Translate** (optional) - Click "🌐 Hindi" to translate
5. **Close and reopen** - Cached summaries load instantly!

### Keyboard Shortcut

Press `Ctrl/Cmd + Shift + S` to toggle the summary panel.

---

## 🛠️ Technical Details

### Architecture

- **Core**: Vanilla JavaScript for maximum performance
- **AI Providers**: 
  - Primary: Groq (llama-3.3-70b-versatile model)
  - Fallback: Google Gemini 2.5 Flash
- **Translation**: Google Translate GTX (free, no API key needed)
- **Caching**: URL-based client-side caching

### File Structure

```
article-summarizer/
├── manifest.json           # Extension configuration
├── content.js             # Main content script
├── ai-summarizer.js       # AI provider integration
├── article-extractor.js   # Article extraction logic
├── Readability.js         # Mozilla Readability library
├── styles.css             # UI styling
├── options.html/js        # Settings page
├── popup.html/js          # Extension popup
└── icons/                 # Extension icons
```

### Performance

- **Groq**: 1-2 seconds average
- **Gemini**: 2-4 seconds average  
- **Cached**: Instant (< 100ms)

---

## 🔐 Privacy & Security

- ✅ API keys stored locally using Chrome's sync storage
- ✅ No third-party tracking or analytics
- ✅ Article content only sent to chosen AI provider
- ✅ Translation uses Google's free public API
- ✅ Open source - audit the code yourself

---

## 🗺️ Roadmap

- [ ] More translation languages
- [ ] Custom summary length options
- [ ] Export summaries (PDF, Markdown)
- [ ] Keyboard shortcuts customization
- [ ] Dark mode toggle
- [ ] Chrome Web Store publication

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Mozilla Readability](https://github.com/mozilla/readability) for article extraction
- [Groq](https://groq.com) for lightning-fast AI inference
- [Google Gemini](https://ai.google.dev/) for reliable AI summarization
- Google Translate for free translation services

---

## 💬 Support

Found a bug or have a feature request? [Open an issue](https://github.com/yourusername/article-summarizer/issues)

---

<div align="center">

Made with ❤️ for faster reading

**Star ⭐ this repo if you find it useful!**

</div>
