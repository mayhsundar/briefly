// Popup script - Handle popup interactions

document.addEventListener('DOMContentLoaded', () => {
    const summarizeBtn = document.getElementById('summarizeBtn');
    const statusDiv = document.getElementById('status');

    // Handle summarize button click
    summarizeBtn.addEventListener('click', async () => {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showStatus('No active tab found', 'error');
                return;
            }

            // Check if we can inject scripts into this tab
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                showStatus('Cannot summarize Chrome internal pages', 'error');
                return;
            }

            // Send message to content script to trigger summarization
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'toggleSummary' });
                showStatus('Summary panel opened!', 'success');

                // Close popup after a short delay
                setTimeout(() => window.close(), 1000);
            } catch (error) {
                // Content script might not be loaded yet, or page doesn't have article content
                showStatus('No article content found on this page', 'info');
            }

        } catch (error) {
            console.error('Error:', error);
            showStatus('An error occurred', 'error');
        }
    });

    /**
     * Show status message
     */
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = 'status visible';
        statusDiv.style.background = type === 'error'
            ? 'rgba(245, 101, 101, 0.3)'
            : type === 'success'
                ? 'rgba(72, 187, 120, 0.3)'
                : 'rgba(255, 255, 255, 0.2)';
    }
});
