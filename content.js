// Content Script - Main extension logic

(function () {
    'use strict';

    // Initialize extractors
    const extractor = new ArticleExtractor();
    let summarizer = null; // Will be initialized with API key if available

    // Initialize AI summarizer
    initializeSummarizer();

    async function initializeSummarizer() {
        // Try to get API keys from storage
        try {
            const result = await chrome.storage.sync.get(['groqApiKey', 'geminiApiKey']);
            const groqKey = result.groqApiKey || null;
            const geminiKey = result.geminiApiKey || null;

            if ((groqKey || geminiKey) && typeof AISummarizer !== 'undefined') {
                summarizer = new AISummarizer(groqKey, geminiKey);
            } else {
                // No API key configured
                summarizer = null;
            }
        } catch (error) {
            console.error('Could not load API keys:', error);
            summarizer = null;
        }
    }

    // State
    let panelOpen = false;
    let floatButton = null;
    let summaryPanel = null;
    let overlay = null;
    let currentSummaryPoints = []; // Store points for translation

    // Cache for summaries
    let cachedUrl = null;
    let cachedSummary = null;
    let cachedTitle = null;

    /**
     * Initialize the extension on page load
     */
    function init() {
        // Check if page has article content
        if (!extractor.hasArticleContent()) {
            return; // Don't add button if no article found
        }

        // Create and inject the floating button
        createFloatButton();
    }

    /**
     * Create the floating summarize button
     */
    function createFloatButton() {
        // Don't create if already exists
        if (floatButton) return;

        floatButton = document.createElement('button');
        floatButton.className = 'summarizer-float-btn';
        floatButton.textContent = 'Summarize';
        floatButton.setAttribute('aria-label', 'Summarize this article');

        floatButton.addEventListener('click', handleButtonClick);

        document.body.appendChild(floatButton);
    }

    /**
     * Handle float button click
     */
    function handleButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (panelOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }

    /**
     * Open the summary panel
     */
    function openPanel() {
        if (!summaryPanel) {
            createPanel();
        }

        panelOpen = true;
        summaryPanel.classList.add('open');
        document.body.classList.add('summarizer-active'); // Blur background
        if (overlay) overlay.classList.add('visible');

        // Reset to English state
        resetTranslateButton();

        // Load and display summary
        displaySummary();
    }

    /**
     * Close the summary panel
     */
    function closePanel() {
        if (!summaryPanel) return;

        panelOpen = false;
        summaryPanel.classList.remove('open');
        document.body.classList.remove('summarizer-active'); // Remove blur
        if (overlay) overlay.classList.remove('visible');
    }

    /**
     * Create the summary panel
     */
    function createPanel() {
        // Create overlay for mobile
        overlay = document.createElement('div');
        overlay.className = 'summarizer-overlay';
        overlay.addEventListener('click', closePanel);
        document.body.appendChild(overlay);

        // Create panel
        summaryPanel = document.createElement('div');
        summaryPanel.className = 'summarizer-panel';

        // Panel HTML structure
        summaryPanel.innerHTML = `
      <div class="summarizer-header">
        <div class="summarizer-actions">
           <button class="summarizer-action-btn" id="translate-btn" title="Translate to Hindi">
             🌐 Hindi
           </button>
        </div>
        <button class="summarizer-close-btn" aria-label="Close summary">×</button>
        <h2 class="summarizer-title">📝 Article Summary</h2>
        <p class="summarizer-subtitle">Key points extracted just for you</p>
      </div>
      <div class="summarizer-content" id="summarizer-content">
        <!-- Content will be loaded here -->
      </div>
    `;

        document.body.appendChild(summaryPanel);

        // Add close button listener
        const closeBtn = summaryPanel.querySelector('.summarizer-close-btn');
        closeBtn.addEventListener('click', closePanel);

        // Add translate listener
        const translateBtn = summaryPanel.querySelector('#translate-btn');
        translateBtn.addEventListener('click', handleTranslate);
    }

    /**
     * Display summary in the panel
     */
    async function displaySummary() {
        const contentDiv = document.getElementById('summarizer-content');
        if (!contentDiv) return;

        // Get current URL
        const currentUrl = window.location.href;

        // Check if we have a cached summary for this URL
        if (cachedUrl === currentUrl && cachedSummary && cachedTitle) {
            currentSummaryPoints = cachedSummary;
            displayPoints(contentDiv, cachedTitle, cachedSummary);
            return;
        }

        // Show loading state
        contentDiv.innerHTML = `
      <div class="summarizer-loading">
        <div class="summarizer-spinner"></div>
        <div class="summarizer-loading-text">Analyzing article...</div>
    `;

        // Small delay for smooth UX
        setTimeout(async () => {
            try {
                // Wait for summarizer to initialize
                if (!summarizer) {
                    await initializeSummarizer();
                }

                // Check if API key is configured (AI-only mode)
                if (!summarizer) {
                    showError(contentDiv,
                        'Please configure a Groq or Gemini API key in the extension options to use AI summarization. ' +
                        'Click the extension icon → Options to set up your API key.'
                    );
                    return;
                }

                // Extract article
                const article = extractor.extractArticle();

                if (!article) {
                    showNoArticle(contentDiv);
                    return;
                }

                // Generate summary using AI
                let summaryPoints;
                if (summarizer && typeof summarizer.summarize === 'function') {
                    const result = summarizer.summarize(article.text, article.title);
                    // Handle both sync and async summarizers
                    summaryPoints = result instanceof Promise ? await result : result;
                } else {
                    showError(contentDiv, 'Summarizer not available. Please configure your API key.');
                    return;
                }

                if (!summaryPoints || summaryPoints.length === 0) {
                    showError(contentDiv, 'Could not generate summary. Please check your API key and try again.');
                    return;
                }

                // Cache the summary
                cachedUrl = currentUrl;
                cachedSummary = summaryPoints;
                cachedTitle = article.title;

                // Store points for translation
                currentSummaryPoints = summaryPoints;

                // Display summary
                displayPoints(contentDiv, article.title, summaryPoints);

            } catch (error) {
                console.error('Summarization error:', error);
                showError(contentDiv,
                    'An error occurred while summarizing: ' + error.message +
                    '. Please check your API key in extension options.'
                );
            }
        }, 500);
    }

    /**
     * Display summary points
     */
    function displayPoints(container, title, points) {
        const summaryHTML = `
      <ul class="summarizer-summary">
        ${points.map(point => `
          <li class="summarizer-summary-item">${point}</li>
        `).join('')}
      </ul>
    `;

        container.innerHTML = summaryHTML;
        resetTranslateButton();
    }

    /**
     * Show no article found message
     */
    function showNoArticle(container) {
        container.innerHTML = `
      <div class="summarizer-no-article">
        <div class="summarizer-no-article-icon">📄</div>
        <p class="summarizer-no-article-text">
          No article content detected on this page.
        </p>
      </div>
    `;
        resetTranslateButton();
    }

    /**
     * Show error message
     */
    function showError(container, message) {
        container.innerHTML = `
      <div class="summarizer-error">
        <strong>⚠️ Setup Required:</strong><br><br>
        ${escapeHtml(message)}
      </div>
    `;
        resetTranslateButton();
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Reset translate button state and header text
     */
    function resetTranslateButton() {
        // Reset Button
        const translateBtn = document.querySelector('#translate-btn');
        if (translateBtn) {
            translateBtn.innerHTML = '🌐 Hindi';
            translateBtn.disabled = false;
        }

        // Reset Header
        const titleEl = document.querySelector('.summarizer-title');
        const subtitleEl = document.querySelector('.summarizer-subtitle');
        if (titleEl) titleEl.innerText = '📝 Article Summary';
        if (subtitleEl) subtitleEl.innerText = 'Key points extracted just for you';
    }

    /**
     * Handle keyboard shortcuts
     */
    document.addEventListener('keydown', (e) => {
        // Escape key to close panel
        if (e.key === 'Escape' && panelOpen) {
            closePanel();
        }

        // Ctrl/Cmd + Shift + S to toggle panel
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
            e.preventDefault();
            if (floatButton) {
                handleButtonClick(e);
            }
        }
    });

    // Initialize when DOM is ready
    // Wait for page to be completely loaded before showing button
    if (document.readyState === 'complete') {
        // Page already loaded
        init();
    } else {
        // Wait for complete page load (including images, stylesheets, etc.)
        window.addEventListener('load', init);
    }

    // Translate handler
    async function handleTranslate() {
        if (!summarizer) return;

        const contentDiv = document.getElementById('summarizer-content');
        const translateBtn = document.querySelector('#translate-btn');
        const titleEl = document.querySelector('.summarizer-title');
        const subtitleEl = document.querySelector('.summarizer-subtitle');

        // Determine content to translate
        let textToTranslate = [];
        let mode = 'text'; // 'list' or 'text'
        let targetElement = null;

        // Add header text first
        if (titleEl) textToTranslate.push(titleEl.innerText);
        if (subtitleEl) textToTranslate.push(subtitleEl.innerText);

        // Track how many header items we have
        const headerCount = textToTranslate.length;

        // 1. Check for Summary List (Bullet points)
        if (currentSummaryPoints && currentSummaryPoints.length > 0 && contentDiv.querySelector('.summarizer-summary')) {
            textToTranslate = textToTranslate.concat(currentSummaryPoints);
            mode = 'list';
        }
        // 2. Check for Error Message
        else if (contentDiv.querySelector('.summarizer-error')) {
            targetElement = contentDiv.querySelector('.summarizer-error');
            textToTranslate.push(targetElement.innerText);
            mode = 'text';
        }
        // 3. Check for No Article Message
        else if (contentDiv.querySelector('.summarizer-no-article-text')) {
            targetElement = contentDiv.querySelector('.summarizer-no-article-text');
            textToTranslate.push(targetElement.innerText);
            mode = 'text';
        }
        // 4. Fallback: Translate whatever text is there
        else {
            const text = contentDiv.innerText.trim();
            if (text) {
                textToTranslate.push(text);
                targetElement = contentDiv;
                mode = 'text';
            }
        }

        // Show loading
        const originalBtnText = translateBtn.innerHTML;
        translateBtn.innerHTML = '⏳ Translating...';
        translateBtn.disabled = true;

        try {
            const translatedResult = await summarizer.translate(textToTranslate, 'Hindi');

            // Apply header translations
            let currentIndex = 0;
            if (titleEl && currentIndex < translatedResult.length) {
                titleEl.innerText = translatedResult[currentIndex++];
            }
            if (subtitleEl && currentIndex < translatedResult.length) {
                subtitleEl.innerText = translatedResult[currentIndex++];
            }

            // Get remaining translated items for content
            const contentResults = translatedResult.slice(currentIndex);

            if (mode === 'list') {
                // If it was a list, re-render as a list
                displayPoints(contentDiv, '', contentResults);
                // Update cache
                currentSummaryPoints = contentResults;
            } else {
                // If text, replace the target element's text
                if (targetElement && contentResults.length > 0) {
                    targetElement.innerText = contentResults[0];
                }
            }
            translateBtn.innerHTML = '✓ Translated';
        } catch (error) {
            console.error('Translation error:', error);
            translateBtn.innerHTML = '⚠️ Error';
            setTimeout(() => {
                translateBtn.innerHTML = originalBtnText;
                translateBtn.disabled = false;
            }, 3000);
        }
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'toggleSummary') {
            if (floatButton) {
                handleButtonClick(new Event('click'));
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'No article content found' });
            }
        } else if (message.action === 'reloadSummarizer') {
            // Reload the summarizer with updated API key
            initializeSummarizer();
            sendResponse({ success: true });
        }
        return true;
    });

})();
