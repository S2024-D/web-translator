const https = require('https');
const http = require('http');
const { URL } = require('url');

module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { url, targetLang, apiKey } = req.body;

    if (!url || !targetLang || !apiKey) {
        res.status(400).json({ error: 'Missing required fields: url, targetLang, apiKey' });
        return;
    }

    try {
        // 1. 웹페이지 가져오기
        const htmlContent = await fetchPage(url);

        // 2. HTML에서 텍스트 추출
        const { textContent, structure } = extractText(htmlContent);

        if (!textContent.trim()) {
            res.status(400).json({ error: '번역할 텍스트를 찾을 수 없습니다.' });
            return;
        }

        // 3. DeepL API로 번역
        const translatedText = await translateWithDeepL(textContent, targetLang, apiKey);

        // 4. 번역된 텍스트를 HTML 구조에 다시 삽입
        const translatedHtml = reconstructHtml(structure, translatedText);
        const originalHtml = reconstructHtml(structure, textContent);

        res.status(200).json({
            original: originalHtml,
            translated: translatedHtml
        });

    } catch (error) {
        console.error('Translation error:', error);
        res.status(500).json({ error: error.message || '번역 중 오류가 발생했습니다.' });
    }
};

// 웹페이지 가져오기
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        };

        const req = protocol.request(options, (response) => {
            // 리다이렉트 처리
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, url).href;
                resolve(fetchPage(redirectUrl));
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`페이지를 가져올 수 없습니다. (상태 코드: ${response.statusCode})`));
                return;
            }

            let data = '';
            response.setEncoding('utf8');
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve(data));
        });

        req.on('error', (error) => {
            reject(new Error(`페이지 연결 실패: ${error.message}`));
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('페이지 로딩 시간 초과'));
        });

        req.end();
    });
}

// HTML에서 텍스트 추출 (간단한 파서)
function extractText(html) {
    // script, style 태그 제거
    let cleaned = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    const structure = [];
    let textContent = '';

    // 주요 텍스트 태그들에서 내용 추출
    const textTags = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'span', 'a', 'div', 'article', 'section'];

    // 단락 구분을 위한 블록 태그
    const blockTags = ['title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'div', 'article', 'section', 'tr'];

    // 간단한 태그 파싱
    const tagRegex = /<(\/?)([\w]+)[^>]*>/g;
    let lastIndex = 0;
    let match;
    let currentTag = '';
    let depth = 0;

    // body 내용만 추출
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
        cleaned = bodyMatch[1];
    }

    // HTML 태그 제거하고 텍스트만 추출
    const textOnly = cleaned
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

    // 문단 단위로 분리
    const paragraphs = textOnly.split(/\n+/).filter(p => p.trim().length > 0);

    paragraphs.forEach((para, index) => {
        const trimmed = para.trim();
        if (trimmed) {
            structure.push({ type: 'p', index: textContent.length });
            textContent += trimmed + '\n\n';
        }
    });

    return { textContent: textContent.trim(), structure };
}

// DeepL API 호출
function translateWithDeepL(text, targetLang, apiKey) {
    return new Promise((resolve, reject) => {
        // 텍스트를 청크로 분할 (DeepL 제한: 한 번에 128KB)
        const maxLength = 50000;
        const chunks = [];

        if (text.length > maxLength) {
            // 문단 단위로 분할
            const paragraphs = text.split('\n\n');
            let currentChunk = '';

            for (const para of paragraphs) {
                if ((currentChunk + para).length > maxLength) {
                    if (currentChunk) chunks.push(currentChunk.trim());
                    currentChunk = para;
                } else {
                    currentChunk += (currentChunk ? '\n\n' : '') + para;
                }
            }
            if (currentChunk) chunks.push(currentChunk.trim());
        } else {
            chunks.push(text);
        }

        // 모든 청크 번역
        Promise.all(chunks.map(chunk => translateChunk(chunk, targetLang, apiKey)))
            .then(results => resolve(results.join('\n\n')))
            .catch(reject);
    });
}

function translateChunk(text, targetLang, apiKey) {
    return new Promise((resolve, reject) => {
        const isFreeApi = apiKey.endsWith(':fx');
        const hostname = isFreeApi ? 'api-free.deepl.com' : 'api.deepl.com';

        const postData = new URLSearchParams({
            text: text,
            target_lang: targetLang
        }).toString();

        const options = {
            hostname: hostname,
            path: '/v2/translate',
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                if (response.statusCode === 200) {
                    try {
                        const result = JSON.parse(data);
                        const translated = result.translations.map(t => t.text).join('\n\n');
                        resolve(translated);
                    } catch (e) {
                        reject(new Error('번역 응답 파싱 실패'));
                    }
                } else if (response.statusCode === 403) {
                    reject(new Error('API 키가 유효하지 않습니다. (403)'));
                } else if (response.statusCode === 456) {
                    reject(new Error('이번 달 무료 번역 한도를 초과했습니다. (456)'));
                } else {
                    reject(new Error(`DeepL API 오류 (${response.statusCode}): ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`DeepL API 연결 실패: ${error.message}`));
        });

        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('번역 시간 초과'));
        });

        req.write(postData);
        req.end();
    });
}

// 번역된 텍스트를 HTML로 재구성
function reconstructHtml(structure, text) {
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    let html = '<div class="translated-content">';

    paragraphs.forEach((para, index) => {
        const trimmed = para.trim();
        if (trimmed) {
            // 제목처럼 보이는 짧은 텍스트는 h3로
            if (trimmed.length < 100 && !trimmed.includes('.') && index < 3) {
                html += `<h3>${escapeHtml(trimmed)}</h3>`;
            } else {
                html += `<p>${escapeHtml(trimmed)}</p>`;
            }
        }
    });

    html += '</div>';
    return html;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
