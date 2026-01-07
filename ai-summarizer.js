// AI-Enhanced Summarizer with Groq and Gemini API support

class AISummarizer {
    constructor(groqApiKey = null, geminiApiKey = null) {
        this.groqApiKey = groqApiKey;
        this.geminiApiKey = geminiApiKey;
        this.groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
        this.geminiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.groqModel = 'llama-3.3-70b-versatile'; // Fast and high quality
    }

    /**
     * Check if Groq is available
     * @returns {boolean}
     */
    isGroqAvailable() {
        return this.groqApiKey !== null && this.groqApiKey.trim() !== '';
    }

    /**
     * Check if Gemini is available
     * @returns {boolean}
     */
    isGeminiAvailable() {
        return this.geminiApiKey !== null && this.geminiApiKey.trim() !== '';
    }

    /**
     * Generate summary using AI with Groq → Gemini fallback
     * @param {string} text - The article text
     * @param {string} title - The article title
     * @returns {Promise<Array<string>>} - Array of summary sentences
     */
    async summarize(text, title = '') {
        // Try Groq first (faster)
        if (this.isGroqAvailable()) {
            try {
                return await this.summarizeWithGroq(text, title);
            } catch (error) {
                // Fallback to Gemini silently
            }
        }

        // Fallback to Gemini
        if (this.isGeminiAvailable()) {
            try {
                return await this.summarizeWithGemini(text, title);
            } catch (error) {
                console.error('❌ Gemini summarization also failed:', error);
                throw error;
            }
        }

        // No API keys configured
        throw new Error('API key required. Please configure Groq or Gemini API key in extension options.');
    }

    /**
     * Summarize using Groq API
     * @param {string} text - The article text
     * @param {string} title - The article title
     * @returns {Promise<Array<string>>}
     */
    async summarizeWithGroq(text, title) {
        // Truncate text if too long
        const maxChars = 25000;
        const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

        const prompt = `You are a professional content analyst. Your task is to create a COMPREHENSIVE yet CONCISE summary that captures ALL the important information from this article using a few highly dense bullet points.

Article Title: ${title}

Article Content:
${truncatedText}

CRITICAL REQUIREMENTS:
- Generate EXACTLY 5-6 comprehensive bullet points
- Each bullet point MUST be 40-60 words and END WITH A PERIOD
- Combine related concepts into single, dense points
- Cover EVERY major section, argument, example, and insight
- Include specific details: names, numbers, quotes, statistics within these points
- The reader should understand the FULL context from just these 5-6 points
- Order points logically following the article's flow
- IMPORTANT: Every point must be a complete sentence ending with a period (.)

CONTENT TO INCLUDE:
✓ Main thesis and key arguments
✓ Important examples and case studies
✓ Specific names, companies, data points
✓ Implications and conclusions
✓ Contrasting viewpoints if present

FORMAT:
- Write complete, standalone sentences (one per line)
- NO bullet symbols (•, -, *) - I'll add them
- Each point should be a rich, information-dense paragraph-style bullet
- Use clear, professional language`;

        const requestBody = {
            model: this.groqModel,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: 0.8,
            max_tokens: 2500,
            top_p: 0.95
        };

        const response = await fetch(this.groqEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.groqApiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const generatedText = data.choices?.[0]?.message?.content;

        if (!generatedText) {
            throw new Error('No text generated from Groq API');
        }

        // Parse bullet points
        const points = generatedText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[•\-\*\d+\.\)]\s*/, '').trim())
            .filter(line => line.length > 20);

        // Remove last point if incomplete
        if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            const endsWithPunctuation = /[.!?]$/.test(lastPoint);
            if (!endsWithPunctuation) {
                console.warn('🚨 Removing incomplete last sentence:', lastPoint);
                points.pop();
            }
        }

        return points;
    }

    /**
     * Summarize using Gemini AI
     * @param {string} text - The article text
     * @param {string} title - The article title
     * @returns {Promise<Array<string>>}
     */
    async summarizeWithGemini(text, title) {
        // Truncate text if too long (Gemini has token limits)
        const maxChars = 25000;
        const truncatedText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

        const prompt = `You are a professional content analyst. Your task is to create a COMPREHENSIVE yet CONCISE summary that captures ALL the important information from this article using a few highly dense bullet points.

Article Title: ${title}

Article Content:
${truncatedText}

CRITICAL REQUIREMENTS:
- Generate EXACTLY 5-6 comprehensive bullet points
- Each bullet point MUST be 40-60 words and END WITH A PERIOD
- Combine related concepts into single, dense points
- Cover EVERY major section, argument, example, and insight
- Include specific details: names, numbers, quotes, statistics within these points
- The reader should understand the FULL context from just these 5-6 points
- Order points logically following the article's flow
- IMPORTANT: Every point must be a complete sentence ending with a period (.)

CONTENT TO INCLUDE:
✓ Main thesis and key arguments
✓ Important examples and case studies
✓ Specific names, companies, data points
✓ Implications and conclusions
✓ Contrasting viewpoints if present

FORMAT:
- Write complete, standalone sentences (one per line)
- NO bullet symbols (•, -, *) - I'll add them
- Each point should be a rich, information-dense paragraph-style bullet
- Use clear, professional language`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2500,
            }
        };

        const response = await fetch(`${this.geminiEndpoint}?key=${this.geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Gemini API error: ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error?.message) {
                    errorMessage += ` - ${errorData.error.message}`;
                }
            } catch (e) {
                // If not JSON, use the raw text
                if (errorText) {
                    errorMessage += ` - ${errorText.substring(0, 200)}`;
                }
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const finishReason = data.candidates?.[0]?.finishReason;

        if (!generatedText) {
            throw new Error('No text generated from API');
        }

        if (finishReason === 'MAX_TOKENS') {
            // Response was truncated
        }

        // Parse bullet points
        const points = generatedText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^[•\-\*\d+\.\)]\s*/, '').trim())
            .filter(line => line.length > 20);

        // Remove last point if incomplete
        if (points.length > 0) {
            const lastPoint = points[points.length - 1];
            const endsWithPunctuation = /[.!?]$/.test(lastPoint);
            if (!endsWithPunctuation) {
                console.warn('🚨 Removing incomplete last sentence:', lastPoint);
                points.pop();
            }
        }

        return points;
    }

    /**
     * Translate summary points to target language using Google Translate
     * @param {Array<string>} points - Array of summary points
     * @param {string} targetLanguage - Target language (e.g., 'Hindi')
     * @returns {Promise<Array<string>>}
     */
    async translate(points, targetLanguage) {
        // Simple language map
        const langMap = {
            'Hindi': 'hi',
            'English': 'en',
            'Spanish': 'es',
            'French': 'fr',
            'German': 'de',
            'Italian': 'it',
            'Portuguese': 'pt',
            'Russian': 'ru',
            'Japanese': 'ja',
            'Korean': 'ko',
            'Chinese': 'zh-CN'
        };
        const langCode = langMap[targetLanguage] || 'hi';

        console.log(`Translating ${points.length} points to ${targetLanguage} (${langCode}) using Google Translate`);

        const translatePoint = async (text) => {
            try {
                const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${langCode}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                // data[0] contains the translation segments. Join them if multiple.
                if (data && data[0]) {
                    return data[0].map(s => s[0]).join('');
                }
                return text; // Fallback
            } catch (err) {
                return text; // Return original if failed
            }
        };

        try {
            // Run all translations in parallel
            const translatedPoints = await Promise.all(points.map(p => translatePoint(p)));
            return translatedPoints;
        } catch (error) {
            console.error('Translation error:', error);
            throw new Error('Translation failed');
        }
    }

    /**
     * Set or update API keys
     * @param {string} groqApiKey
     * @param {string} geminiApiKey
     */
    setApiKeys(groqApiKey, geminiApiKey) {
        this.groqApiKey = groqApiKey;
        this.geminiApiKey = geminiApiKey;
    }
}

// Make available globally
window.AISummarizer = AISummarizer;
