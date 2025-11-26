// DOM Elements
const apiKeySection = document.getElementById('api-key-section');
const translateSection = document.getElementById('translate-section');
const loadingSection = document.getElementById('loading-section');
const resultSection = document.getElementById('result-section');
const errorSection = document.getElementById('error-section');

const apiKeyInput = document.getElementById('api-key-input');
const saveKeyBtn = document.getElementById('save-key-btn');
const keyStatus = document.getElementById('key-status');

const urlInput = document.getElementById('url-input');
const targetLang = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const changeKeyLink = document.getElementById('change-key-link');

const resultContent = document.getElementById('result-content');
const showTranslatedBtn = document.getElementById('show-translated');
const showOriginalBtn = document.getElementById('show-original');
const newTranslateBtn = document.getElementById('new-translate-btn');

const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');

// State
let translatedContent = '';
let originalContent = '';

// API Base URL - Vercel 배포 시 자동으로 설정됨
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('deepl_api_key');
    if (savedKey) {
        showTranslateSection();
    } else {
        showApiKeySection();
    }
});

// API Key Management
saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
        showKeyStatus('API 키를 입력해주세요.', 'error');
        return;
    }

    // DeepL API 키 형식 검증 (기본적인 검증)
    if (key.length < 30) {
        showKeyStatus('올바른 API 키 형식이 아닙니다.', 'error');
        return;
    }

    localStorage.setItem('deepl_api_key', key);
    showKeyStatus('API 키가 저장되었습니다!', 'success');

    setTimeout(() => {
        showTranslateSection();
    }, 1000);
});

changeKeyLink.addEventListener('click', (e) => {
    e.preventDefault();
    showApiKeySection();
    apiKeyInput.value = localStorage.getItem('deepl_api_key') || '';
});

function showKeyStatus(message, type) {
    keyStatus.textContent = message;
    keyStatus.className = 'status ' + type;
}

// Section Display
function hideAllSections() {
    apiKeySection.classList.add('hidden');
    translateSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
}

function showApiKeySection() {
    hideAllSections();
    apiKeySection.classList.remove('hidden');
    keyStatus.textContent = '';
}

function showTranslateSection() {
    hideAllSections();
    translateSection.classList.remove('hidden');
    urlInput.value = '';
    urlInput.focus();
}

function showLoading() {
    hideAllSections();
    loadingSection.classList.remove('hidden');
}

function showResult() {
    hideAllSections();
    resultSection.classList.remove('hidden');
}

function showError(message) {
    hideAllSections();
    errorSection.classList.remove('hidden');
    errorMessage.textContent = message;
}

// Translation
translateBtn.addEventListener('click', translate);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') translate();
});

async function translate() {
    const url = urlInput.value.trim();
    const lang = targetLang.value;
    const apiKey = localStorage.getItem('deepl_api_key');

    if (!url) {
        alert('URL을 입력해주세요.');
        return;
    }

    if (!isValidUrl(url)) {
        alert('올바른 URL 형식을 입력해주세요. (https://...)');
        return;
    }

    if (!apiKey) {
        showApiKeySection();
        return;
    }

    showLoading();

    try {
        const response = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: url,
                targetLang: lang,
                apiKey: apiKey
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '번역 중 오류가 발생했습니다.');
        }

        originalContent = data.original;
        translatedContent = data.translated;

        displayTranslated();
        showResult();

    } catch (error) {
        console.error('Translation error:', error);

        let errorMsg = error.message;
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            errorMsg = 'API 키가 유효하지 않습니다. 키를 확인해주세요.';
        } else if (errorMsg.includes('456')) {
            errorMsg = '이번 달 무료 번역 한도를 초과했습니다.';
        } else if (errorMsg.includes('fetch')) {
            errorMsg = '해당 웹페이지를 가져올 수 없습니다. URL을 확인해주세요.';
        }

        showError(errorMsg);
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Result Display
showTranslatedBtn.addEventListener('click', () => {
    displayTranslated();
});

showOriginalBtn.addEventListener('click', () => {
    displayOriginal();
});

function displayTranslated() {
    resultContent.innerHTML = translatedContent;
    showTranslatedBtn.classList.add('active');
    showOriginalBtn.classList.remove('active');
}

function displayOriginal() {
    resultContent.innerHTML = originalContent;
    showOriginalBtn.classList.add('active');
    showTranslatedBtn.classList.remove('active');
}

newTranslateBtn.addEventListener('click', () => {
    showTranslateSection();
});

retryBtn.addEventListener('click', () => {
    showTranslateSection();
});
