// Options page script

document.addEventListener('DOMContentLoaded', () => {
    const groqApiKeyInput = document.getElementById('groqApiKey');
    const geminiApiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const statusDiv = document.getElementById('status');

    // Load saved API keys on page load
    loadSettings();

    // Save button
    saveBtn.addEventListener('click', saveSettings);

    // Clear button
    clearBtn.addEventListener('click', clearSettings);

    // Allow Enter key to save
    groqApiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveSettings();
        }
    });

    geminiApiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveSettings();
        }
    });

    /**
     * Load settings from storage
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['groqApiKey', 'geminiApiKey']);
            if (result.groqApiKey) {
                groqApiKeyInput.value = result.groqApiKey;
            }
            if (result.geminiApiKey) {
                geminiApiKeyInput.value = result.geminiApiKey;
            }
            if (result.groqApiKey || result.geminiApiKey) {
                showStatus('Settings loaded', 'success');
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /**
     * Save settings to storage
     */
    async function saveSettings() {
        const groqKey = groqApiKeyInput.value.trim();
        const geminiKey = geminiApiKeyInput.value.trim();

        if (!groqKey && !geminiKey) {
            showStatus('Please enter at least one API key', 'error');
            return;
        }

        // Validation for Gemini key (starts with 'AIza')
        if (geminiKey && !geminiKey.startsWith('AIza')) {
            showStatus('Warning: Gemini API key format looks incorrect. Gemini keys usually start with "AIza"', 'error');
            return;
        }

        // Validation for Groq key (starts with 'gsk_')
        if (groqKey && !groqKey.startsWith('gsk_')) {
            showStatus('Warning: Groq API key format looks incorrect. Groq keys usually start with "gsk_"', 'error');
            return;
        }

        try {
            const toSave = {};
            if (groqKey) toSave.groqApiKey = groqKey;
            if (geminiKey) toSave.geminiApiKey = geminiKey;

            await chrome.storage.sync.set(toSave);

            // Build success message
            let message = '✅ Settings saved! ';
            if (groqKey && geminiKey) {
                message += 'Groq (primary) + Gemini (fallback) enabled.';
            } else if (groqKey) {
                message += 'Groq enabled (ultra-fast summaries).';
            } else {
                message += 'Gemini enabled (reliable summaries).';
            }

            showStatus(message, 'success');

            // Notify all tabs to reload the summarizer
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach((tab) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'reloadSummarizer' }, () => {
                        // Ignore errors for tabs that don't have the content script
                        if (chrome.runtime.lastError) {
                            // Silent
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('Error saving settings: ' + error.message, 'error');
        }
    }

    /**
     * Clear API keys
     */
    async function clearSettings() {
        try {
            await chrome.storage.sync.remove(['groqApiKey', 'geminiApiKey']);
            groqApiKeyInput.value = '';
            geminiApiKeyInput.value = '';
            showStatus('✅ API keys cleared.', 'success');

            // Notify all tabs to reload the summarizer
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach((tab) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'reloadSummarizer' }, () => {
                        // Ignore errors
                        if (chrome.runtime.lastError) {
                            // Silent
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Error clearing settings:', error);
            showStatus('Error clearing settings: ' + error.message, 'error');
        }
    }

    /**
     * Show status message
     */
    function showStatus(message, type = 'success') {
        statusDiv.textContent = message;
        statusDiv.className = `status visible ${type}`;

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.classList.remove('visible');
            }, 5000);
        }
    }
});
