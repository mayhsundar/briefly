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
    let isTranslatedToHindi = false; // Track if content is currently translated to Hindi

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
        if (translateBtn) {
            translateBtn.addEventListener('click', () => {
                console.log('🔘 Hindi button clicked - event listener triggered!');
                handleTranslate();
            });
            console.log('✅ Hindi button event listener attached');
        } else {
            console.error('❌ Could not find translate button');
        }
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
                    showSetupInstructions(contentDiv);
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
     * Show rich setup instructions when no API keys are configured
     */
    function showSetupInstructions(container) {
        container.innerHTML = `
      <div class="summarizer-setup">
        <div class="setup-header">
          <div class="setup-icon">✨</div>
          <h3 class="setup-title">Let's Get Started</h3>
          <p class="setup-description">
            Enter at least one API key below to start summarizing.<br>
            Both are 100% free and take just 30 seconds!
          </p>
        </div>

        <div class="setup-form">
          <div class="setup-input-group">
            <div class="setup-input-header">
              <span class="setup-emoji">🚀</span>
              <label for="groq-key-input">Groq API Key</label>
              <span class="setup-badge setup-badge-fastest">FASTEST</span>
            </div>
            <p class="setup-input-desc">
              Get your free key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq Console</a>
            </p>
            <input type="password" id="groq-key-input" class="setup-input" placeholder="Enter Groq API key (optional)" autocomplete="off">
          </div>

          <div class="setup-input-group">
            <div class="setup-input-header">
              <span class="setup-emoji">🤖</span>
              <label for="gemini-key-input">Gemini API Key</label>
              <span class="setup-badge setup-badge-fallback">FALLBACK</span>
            </div>
            <p class="setup-input-desc">
              Get your free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>
            </p>
            <input type="password" id="gemini-key-input" class="setup-input" placeholder="Enter Gemini API key (optional)" autocomplete="off">
          </div>

        <div class="setup-recommendation">
          <span class="recommendation-icon">💡</span>
          <strong>Pro Tip:</strong> Configure both! Groq for speed, Gemini as backup.
        </div>

        <button class="setup-button" id="saveKeysBtn">
          ✨ Save Keys and Start Summarizing
        </button>
        
        <div class="setup-status" id="setup-status"></div>
      </div>
    `;

        // Add click listener to the save button
        const saveKeysBtn = container.querySelector('#saveKeysBtn');
        const groqInput = container.querySelector('#groq-key-input');
        const geminiInput = container.querySelector('#gemini-key-input');
        const statusDiv = container.querySelector('#setup-status');

        if (saveKeysBtn) {
            saveKeysBtn.addEventListener('click', async () => {
                const groqKey = groqInput.value.trim();
                const geminiKey = geminiInput.value.trim();

                // Validate that at least one key is provided
                if (!groqKey && !geminiKey) {
                    statusDiv.className = 'setup-status setup-status-error';
                    if (isTranslatedToHindi) {
                        statusDiv.textContent = '⚠️ कृपया कम से कम एक एपीआई कुंजी दर्ज करें'; // "Please enter at least one API key" in Hindi
                    } else {
                        statusDiv.textContent = '⚠️ Please enter at least one API key';
                    }
                    statusDiv.style.display = 'block';

                    // Auto-hide error after 4 seconds
                    setTimeout(() => {
                        statusDiv.style.display = 'none';
                    }, 4000);
                    return;
                }

                // Show loading state
                saveKeysBtn.disabled = true;
                if (isTranslatedToHindi) {
                    saveKeysBtn.textContent = '⏳ सहेजा जा रहा है...'; // "Saving..." in Hindi
                } else {
                    saveKeysBtn.textContent = '⏳ Saving...';
                }
                statusDiv.style.display = 'none';

                try {
                    // Save to chrome storage
                    await chrome.storage.sync.set({
                        groqApiKey: groqKey || null,
                        geminiApiKey: geminiKey || null
                    });

                    // Reinitialize summarizer
                    await initializeSummarizer();

                    // Show success and auto-generate summary
                    statusDiv.className = 'setup-status setup-status-success';
                    if (isTranslatedToHindi) {
                        statusDiv.textContent = '✅ कुंजी सहेजी गई! सारांश बनाया जा रहा है...'; // "Keys saved! Generating summary..." in Hindi
                    } else {
                        statusDiv.textContent = '✅ Keys saved! Generating summary...';
                    }
                    statusDiv.style.display = 'block';

                    // Wait a moment then regenerate summary
                    setTimeout(() => {
                        displaySummary();
                    }, 500);

                } catch (error) {
                    console.error('Error saving keys:', error);
                    statusDiv.className = 'setup-status setup-status-error';
                    if (isTranslatedToHindi) {
                        statusDiv.textContent = '⚠️ कुंजी सहेजने में त्रुटि। कृपया पुनः प्रयास करें।'; // "Error saving keys. Please try again." in Hindi
                    } else {
                        statusDiv.textContent = '⚠️ Error saving keys. Please try again.';
                    }
                    statusDiv.style.display = 'block';
                    saveKeysBtn.disabled = false;
                    if (isTranslatedToHindi) {
                        saveKeysBtn.textContent = '✨ कुंजियाँ सहेजें और सारांश प्रारंभ करें'; // Button text in Hindi
                    } else {
                        saveKeysBtn.textContent = '✨ Save Keys and Start Summarizing';
                    }
                }
            });
        }

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
     * Standalone Google Translate function (doesn't require API keys)
     */
    async function translateText(text, targetLang = 'hi') {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            // data[0] contains the translation segments
            if (data && data[0]) {
                return data[0].map(s => s[0]).join('');
            }
            return text; // Fallback to original
        } catch (err) {
            console.error('Translation error:', err);
            return text; // Return original if failed
        }
    }

    /**
     * Translate multiple texts
     */
    async function translateMultiple(texts, targetLang = 'hi') {
        console.log(`🌐 Translating ${texts.length} items to language code: ${targetLang}`);
        return await Promise.all(texts.map(t => translateText(t, targetLang)));
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

        // Reset setup screen placeholders and descriptions if they exist
        const contentDiv = document.getElementById('summarizer-content');
        if (contentDiv && contentDiv.querySelector('.summarizer-setup')) {
            const groqInput = contentDiv.querySelector('#groq-key-input');
            const geminiInput = contentDiv.querySelector('#gemini-key-input');
            const groqDesc = contentDiv.querySelector('.setup-input-group:nth-child(1) .setup-input-desc');
            const geminiDesc = contentDiv.querySelector('.setup-input-group:nth-child(2) .setup-input-desc');

            if (groqInput) groqInput.placeholder = 'Enter Groq API key (optional)';
            if (geminiInput) geminiInput.placeholder = 'Enter Gemini API key (optional)';
            if (groqDesc) {
                groqDesc.innerHTML = 'Get your free key from <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq Console</a>';
            }
            if (geminiDesc) {
                geminiDesc.innerHTML = 'Get your free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>';
            }
        }

        // Reset translation flag
        isTranslatedToHindi = false;
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
        console.log('🌐 Translate button clicked');

        const contentDiv = document.getElementById('summarizer-content');
        const translateBtn = document.querySelector('#translate-btn');
        const titleEl = document.querySelector('.summarizer-title');
        const subtitleEl = document.querySelector('.summarizer-subtitle');

        // Determine content to translate
        let textToTranslate = [];
        let mode = 'text'; // 'list' or 'text' or 'error'
        let targetElement = null;

        // Add header text first
        if (titleEl) textToTranslate.push(titleEl.innerText);
        if (subtitleEl) textToTranslate.push(subtitleEl.innerText);

        // Track how many header items we have
        const headerCount = textToTranslate.length;
        console.log(`📋 Header items: ${headerCount}`);

        // 1. Check for Setup Screen (special handling for all UI elements)
        if (contentDiv.querySelector('.summarizer-setup')) {
            mode = 'setup';
            console.log(`⚙️ Translating setup screen`);

            // Collect all setup screen text to translate
            const setupTitle = contentDiv.querySelector('.setup-title');
            const setupDesc = contentDiv.querySelector('.setup-description');
            const groqLabel = contentDiv.querySelector('[for="groq-key-input"]');
            const geminiLabel = contentDiv.querySelector('[for="gemini-key-input"]');
            const fastestBadge = contentDiv.querySelector('.setup-badge-fastest');
            const fallbackBadge = contentDiv.querySelector('.setup-badge-fallback');
            const proTip = contentDiv.querySelector('.setup-recommendation');
            const saveButton = contentDiv.querySelector('#saveKeysBtn');

            // Collect text nodes
            if (setupTitle) textToTranslate.push(setupTitle.innerText);
            if (setupDesc) textToTranslate.push(setupDesc.innerHTML.replace(/<br>/g, '\n')); // Preserve line breaks
            if (groqLabel) textToTranslate.push(groqLabel.innerText);
            if (geminiLabel) textToTranslate.push(geminiLabel.innerText);
            if (fastestBadge) textToTranslate.push(fastestBadge.innerText);
            if (fallbackBadge) textToTranslate.push(fallbackBadge.innerText);
            if (proTip) {
                // Extract Pro Tip text without icon and strong tag
                const proTipText = proTip.textContent.replace(/^💡\s*/, '').replace(/^Pro Tip:\s*/i, '').trim();
                textToTranslate.push('Pro Tip');
                textToTranslate.push(proTipText);
            }
            if (saveButton) {
                const btnText = saveButton.textContent.replace(/^✨\s*/, '').trim();
                textToTranslate.push(btnText);
            }
        }
        // 2. Check for Summary List (Bullet points)
        else if (currentSummaryPoints && currentSummaryPoints.length > 0 && contentDiv.querySelector('.summarizer-summary')) {
            textToTranslate = textToTranslate.concat(currentSummaryPoints);
            mode = 'list';
            console.log(`✅ Translating summary list (${currentSummaryPoints.length} points)`);
        }
        // 3. Check for Error Message
        else if (contentDiv.querySelector('.summarizer-error')) {
            targetElement = contentDiv.querySelector('.summarizer-error');
            // Extract just the error message text (skip the icon and "Setup Required:" part)
            const errorText = targetElement.textContent.replace(/^⚠️\s*Setup Required:\s*/i, '').trim();
            textToTranslate.push(errorText);
            // Also translate the "Setup Required" text
            textToTranslate.push('Setup Required');
            mode = 'error';
            console.log(`⚠️ Translating error message`);
        }
        // 4. Check for No Article Message
        else if (contentDiv.querySelector('.summarizer-no-article-text')) {
            targetElement = contentDiv.querySelector('.summarizer-no-article-text');
            textToTranslate.push(targetElement.innerText);
            mode = 'text';
            console.log(`📄 Translating no-article message`);
        }
        // 5. Fallback: Translate whatever text is there
        else {
            const text = contentDiv.innerText.trim();
            if (text) {
                textToTranslate.push(text);
                targetElement = contentDiv;
                mode = 'text';
                console.log(`📝 Translating fallback content`);
            }
        }

        console.log(`🔤 Total items to translate: ${textToTranslate.length}`, textToTranslate);

        // Show loading
        const originalBtnText = translateBtn.innerHTML;
        translateBtn.innerHTML = '⏳ अनुवाद हो रहा है...'; // "Translating..." in Hindi
        translateBtn.disabled = true;

        try {
            // Use standalone translation (works without API keys)
            const translatedResult = await translateMultiple(textToTranslate, 'hi');
            console.log(`✅ Translation complete!`, translatedResult);

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

            if (mode === 'setup') {
                // For setup screen, apply translations to specific elements
                const setupTitle = contentDiv.querySelector('.setup-title');
                const setupDesc = contentDiv.querySelector('.setup-description');
                const groqLabel = contentDiv.querySelector('[for="groq-key-input"]');
                const geminiLabel = contentDiv.querySelector('[for="gemini-key-input"]');
                const fastestBadge = contentDiv.querySelector('.setup-badge-fastest');
                const fallbackBadge = contentDiv.querySelector('.setup-badge-fallback');
                const proTip = contentDiv.querySelector('.setup-recommendation');
                const saveButton = contentDiv.querySelector('#saveKeysBtn');
                const groqInput = contentDiv.querySelector('#groq-key-input');
                const geminiInput = contentDiv.querySelector('#gemini-key-input');
                const groqDesc = contentDiv.querySelector('.setup-input-group:nth-child(1) .setup-input-desc');
                const geminiDesc = contentDiv.querySelector('.setup-input-group:nth-child(2) .setup-input-desc');

                let resultIndex = 0;
                if (setupTitle && resultIndex < contentResults.length) {
                    setupTitle.innerText = contentResults[resultIndex++];
                }
                if (setupDesc && resultIndex < contentResults.length) {
                    // Restore line breaks
                    const translatedDesc = contentResults[resultIndex++].replace(/\n/g, '<br>');
                    setupDesc.innerHTML = translatedDesc;
                }
                if (groqLabel && resultIndex < contentResults.length) {
                    groqLabel.innerText = contentResults[resultIndex++];
                }
                if (geminiLabel && resultIndex < contentResults.length) {
                    geminiLabel.innerText = contentResults[resultIndex++];
                }
                if (fastestBadge && resultIndex < contentResults.length) {
                    fastestBadge.innerText = contentResults[resultIndex++];
                }
                if (fallbackBadge && resultIndex < contentResults.length) {
                    fallbackBadge.innerText = contentResults[resultIndex++];
                }
                if (proTip && resultIndex < contentResults.length + 1) {
                    const translatedProTipLabel = contentResults[resultIndex++];
                    const translatedProTipText = contentResults[resultIndex++];
                    proTip.innerHTML = `<span class="recommendation-icon">💡</span><strong>${translatedProTipLabel}:</strong> ${translatedProTipText}`;
                }
                if (saveButton && resultIndex < contentResults.length) {
                    saveButton.textContent = `✨ ${contentResults[resultIndex++]}`;
                }

                // Translate input placeholders and descriptions - do synchronously
                (async () => {
                    const groqPlaceholder = await translateText('Enter Groq API key (optional)', 'hi');
                    const geminiPlaceholder = await translateText('Enter Gemini API key (optional)', 'hi');
                    const getKeyText = await translateText('Get your free key from', 'hi');

                    if (groqInput) groqInput.placeholder = groqPlaceholder;
                    if (geminiInput) geminiInput.placeholder = geminiPlaceholder;
                    if (groqDesc) {
                        groqDesc.innerHTML = `${getKeyText} <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Groq Console</a>`;
                    }
                    if (geminiDesc) {
                        geminiDesc.innerHTML = `${getKeyText} <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>`;
                    }
                })();
            } else if (mode === 'list') {
                // If it was a list, re-render as a list
                displayPoints(contentDiv, '', contentResults);
                // Update cache
                currentSummaryPoints = contentResults;
            } else if (mode === 'error') {
                // For error messages, reconstruct with HTML structure
                // contentResults[0] = translated error message
                // contentResults[1] = translated "Setup Required"
                if (targetElement && contentResults.length >= 2) {
                    const translatedErrorMsg = contentResults[0];
                    const translatedSetupRequired = contentResults[1];
                    targetElement.innerHTML = `<strong>⚠️ ${translatedSetupRequired}:</strong><br><br>${escapeHtml(translatedErrorMsg)}`;
                }
            } else {
                // If text, replace the target element's text
                if (targetElement && contentResults.length > 0) {
                    targetElement.innerText = contentResults[0];
                }
            }
            translateBtn.innerHTML = '✓ अनुवादित'; // "Translated" in Hindi
            isTranslatedToHindi = true; // Mark as translated
        } catch (error) {
            console.error('Translation error:', error);
            translateBtn.innerHTML = '⚠️ त्रुटि'; // "Error" in Hindi
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
