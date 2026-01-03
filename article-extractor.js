// Improved Article Extractor using Mozilla's Readability.js

class ArticleExtractor {
    constructor() {
        this.minArticleLength = 300;
    }

    /**
     * Checks if the current page appears to have article content
     * Uses Readability's isProbablyReaderable for better detection
     * @returns {boolean}
     */
    hasArticleContent() {
        // Use Readability's built-in check if available
        if (typeof isProbablyReaderable === 'function') {
            return isProbablyReaderable(document);
        }

        // Fallback check
        const article = this.extractArticle();
        return article && article.text.length >= this.minArticleLength;
    }

    /**
     * Extracts the main article content from the page using Readability.js
     * @returns {Object|null} - { title, text, paragraphs, excerpt }
     */
    extractArticle() {
        try {
            // Use Mozilla's Readability library for professional-grade extraction
            if (typeof Readability !== 'undefined') {
                // Clone the document to avoid modifying the original
                const documentClone = document.cloneNode(true);

                // Create a new Readability object and parse
                const reader = new Readability(documentClone, {
                    debug: false,
                    maxElemsToParse: 0, // No limit
                    nbTopCandidates: 5,
                    charThreshold: 500,
                    classesToPreserve: [] // Don't preserve any classes
                });

                const article = reader.parse();

                if (!article) {
                    return this.fallbackExtraction();
                }

                // Readability returns: title, content (HTML), textContent, excerpt, byline, etc.
                let cleanText = article.textContent || article.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

                // Clean the text from metadata, dates, bylines, etc.
                cleanText = this.cleanArticleText(cleanText, article.byline);

                if (cleanText.length < this.minArticleLength) {
                    return null;
                }

                // Split into paragraphs for additional processing if needed
                const paragraphs = cleanText
                    .split(/\n\n+/)
                    .map(p => p.trim())
                    .filter(p => p.length > 50);

                return {
                    title: article.title || this.extractTitle(),
                    text: cleanText,
                    paragraphs: paragraphs,
                    excerpt: article.excerpt || '',
                    byline: article.byline || '',
                    siteName: article.siteName || document.location.hostname
                };
            }

            // Fallback if Readability is not available
            return this.fallbackExtraction();

        } catch (error) {
            console.error('Error extracting article:', error);
            return this.fallbackExtraction();
        }
    }

    /**
     * Fallback extraction method (original logic)
     * @returns {Object|null}
     */
    fallbackExtraction() {
        // Try semantic HTML first
        const article = this.trySemanticExtraction() || this.tryHeuristicExtraction();

        if (!article || article.text.length < this.minArticleLength) {
            return null;
        }

        return {
            title: this.extractTitle(),
            text: article.text,
            paragraphs: article.paragraphs,
            excerpt: article.text.substring(0, 200) + '...',
            byline: '',
            siteName: document.location.hostname
        };
    }

    /**
     * Try to extract article using semantic HTML5 tags
     * @returns {Object|null}
     */
    trySemanticExtraction() {
        const articleTags = document.querySelectorAll('article');
        if (articleTags.length > 0) {
            let longestArticle = null;
            let maxLength = 0;

            articleTags.forEach(article => {
                const text = this.getTextContent(article);
                if (text.length > maxLength) {
                    maxLength = text.length;
                    longestArticle = article;
                }
            });

            if (longestArticle) {
                return {
                    text: this.getTextContent(longestArticle),
                    paragraphs: this.extractParagraphs(longestArticle)
                };
            }
        }

        const mainTag = document.querySelector('main');
        if (mainTag) {
            const text = this.getTextContent(mainTag);
            if (text.length >= this.minArticleLength) {
                return {
                    text: text,
                    paragraphs: this.extractParagraphs(mainTag)
                };
            }
        }

        return null;
    }

    /**
     * Try to extract article using heuristics
     * @returns {Object|null}
     */
    tryHeuristicExtraction() {
        const candidates = document.querySelectorAll('div, section');
        let bestCandidate = null;
        let bestScore = 0;

        candidates.forEach(element => {
            const score = this.scoreElement(element);
            if (score > bestScore) {
                bestScore = score;
                bestCandidate = element;
            }
        });

        if (bestCandidate && bestScore > 0) {
            return {
                text: this.getTextContent(bestCandidate),
                paragraphs: this.extractParagraphs(bestCandidate)
            };
        }

        return null;
    }

    /**
     * Score an element based on article-like characteristics
     * @param {Element} element
     * @returns {number}
     */
    scoreElement(element) {
        let score = 0;

        const className = element.className.toLowerCase();
        const id = element.id.toLowerCase();
        const combined = className + ' ' + id;

        if (/(nav|header|footer|sidebar|menu|comment|ad|related|social)/i.test(combined)) {
            return -1000;
        }

        if (/(article|post|content|main|story|entry)/i.test(combined)) {
            score += 25;
        }

        const paragraphs = element.querySelectorAll('p');
        score += Math.min(paragraphs.length * 3, 50);

        const textLength = this.getTextContent(element).length;
        score += Math.min(textLength / 100, 50);

        const links = element.querySelectorAll('a');
        const linkDensity = links.length / Math.max(paragraphs.length, 1);
        score -= linkDensity * 3;

        return score;
    }

    /**
     * Extract clean text content from an element
     * @param {Element} element
     * @returns {string}
     */
    getTextContent(element) {
        const clone = element.cloneNode(true);
        const unwanted = clone.querySelectorAll('script, style, nav, footer, header, aside, .ad, .advertisement, iframe');
        unwanted.forEach(el => el.remove());
        return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    /**
     * Clean article text from metadata and other non-content elements
     * @param {string} text - The raw article text
     * @param {string} byline - The article byline/author
     * @returns {string} - Cleaned text
     */
    cleanArticleText(text, byline = '') {
        let cleaned = text;

        // Remove common date patterns at the beginning
        // Matches: "Sept. 9, 2025" "September 9, 2025" "9/9/2025" "2025-09-09" etc.
        cleaned = cleaned.replace(/^[A-Za-z]+\.?\s+\d{1,2},?\s+\d{4}\.?\s*/i, '');
        cleaned = cleaned.replace(/^\d{1,2}\/\d{1,2}\/\d{2,4}\s*/i, '');
        cleaned = cleaned.replace(/^\d{4}-\d{2}-\d{2}\s*/i, '');

        // Remove byline/author patterns
        if (byline) {
            // Remove the exact byline
            cleaned = cleaned.replace(new RegExp('^' + byline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\s*[\|\-]?\s*', 'i'), '');
        }
        // Remove common byline patterns like "By John Doe" "John Doe |"
        cleaned = cleaned.replace(/^By\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\|\-]?\s*/i, '');
        cleaned = cleaned.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s*\|\s*/i, '');

        // Remove image credits and sources
        cleaned = cleaned.replace(/^[A-Z][a-z]+\s+[A-Z][a-z]+\s*\|\s*[A-Za-z]+\s*/i, ''); // "John Doe | Reuters"
        cleaned = cleaned.replace(/^Photo by:?\s+[^.]+\.?\s*/i, '');
        cleaned = cleaned.replace(/^Image:?\s+[^.]+\.?\s*/i, '');
        cleaned = cleaned.replace(/^Credit:?\s+[^.]+\.?\s*/i, '');
        cleaned = cleaned.replace(/^Source:?\s+[^.]+\.?\s*/i, '');

        // Remove common metadata separators and artifacts
        cleaned = cleaned.replace(/^[\|\-—]+\s*/g, '');
        cleaned = cleaned.replace(/^\s*•\s*/g, '');

        // Remove "Published on" or "Updated" timestamps
        cleaned = cleaned.replace(/^(Published|Updated|Posted)\s+(on\s+)?[^.]+\.?\s*/i, '');

        // Remove common news wire prefixes
        cleaned = cleaned.replace(/^(Reuters|AP|AFP|Bloomberg|CNN)\s*[\-—]\s*/i, '');

        // Clean up any remaining multiple spaces
        cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

        return cleaned;
    }

    /**
     * Extract paragraphs from an element
     * @param {Element} element
     * @returns {Array<string>}
     */
    extractParagraphs(element) {
        const paragraphs = [];
        const pTags = element.querySelectorAll('p');

        pTags.forEach(p => {
            const text = p.textContent.trim();
            if (text.length >= 50) {
                paragraphs.push(text);
            }
        });

        return paragraphs;
    }

    /**
     * Extract the page title
     * @returns {string}
     */
    extractTitle() {
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) return ogTitle.getAttribute('content');

        const h1 = document.querySelector('h1');
        if (h1) return h1.textContent.trim();

        return document.title;
    }
}

// Make available globally for content.js
window.ArticleExtractor = ArticleExtractor;
