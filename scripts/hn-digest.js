/**
 * Hacker News Daily Digest
 * - HN 인기글 크롤링
 * - DeepL로 번역
 * - 이메일로 전송
 */

const https = require('https');

// 설정
const CONFIG = {
    topStoriesCount: 10,  // 가져올 인기글 수
    targetLang: 'KO',     // 번역 대상 언어
    deeplApiKey: process.env.DEEPL_API_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    emailTo: process.env.EMAIL_TO,
    emailFrom: process.env.EMAIL_FROM || 'HN Digest <onboarding@resend.dev>'
};

// 메인 실행
async function main() {
    console.log('🚀 Hacker News Digest 시작...\n');

    // 1. 인기글 가져오기
    console.log('📰 인기글 목록 가져오는 중...');
    const stories = await getTopStories(CONFIG.topStoriesCount);
    console.log(`   ${stories.length}개 글 발견\n`);

    // 2. 각 글 내용 가져오기 + 번역
    console.log('🔄 글 내용 번역 중...');
    const translatedStories = [];

    for (let i = 0; i < stories.length; i++) {
        const story = stories[i];
        console.log(`   [${i + 1}/${stories.length}] ${story.title.substring(0, 50)}...`);

        try {
            // 제목 번역
            const translatedTitle = await translateText(story.title, CONFIG.targetLang);

            // URL이 있으면 내용도 가져와서 번역
            let translatedContent = '';
            if (story.url) {
                try {
                    const content = await fetchPageContent(story.url);
                    if (content && content.length > 100) {
                        // 내용이 너무 길면 앞부분만 번역 (API 한도 절약)
                        const truncated = content.substring(0, 3000);
                        translatedContent = await translateText(truncated, CONFIG.targetLang);
                    }
                } catch (e) {
                    console.log(`      ⚠️ 내용 가져오기 실패: ${e.message}`);
                }
            }

            translatedStories.push({
                ...story,
                translatedTitle,
                translatedContent,
                hnUrl: `https://news.ycombinator.com/item?id=${story.id}`
            });

            // API 속도 제한 방지
            await sleep(500);
        } catch (e) {
            console.log(`      ❌ 번역 실패: ${e.message}`);
            translatedStories.push({
                ...story,
                translatedTitle: story.title,
                translatedContent: '',
                hnUrl: `https://news.ycombinator.com/item?id=${story.id}`
            });
        }
    }

    console.log('\n✅ 번역 완료\n');

    // 3. 이메일 생성 및 전송
    console.log('📧 이메일 전송 중...');
    const emailHtml = generateEmailHtml(translatedStories);

    if (CONFIG.resendApiKey && CONFIG.emailTo) {
        await sendEmail(emailHtml);
        console.log('✅ 이메일 전송 완료!');
    } else {
        console.log('⚠️ 이메일 설정 없음. 결과를 콘솔에 출력합니다.\n');
        console.log('='.repeat(60));
        translatedStories.forEach((story, i) => {
            console.log(`\n[${i + 1}] ${story.translatedTitle}`);
            console.log(`    원제: ${story.title}`);
            console.log(`    링크: ${story.url || story.hnUrl}`);
            console.log(`    점수: ${story.score} | 댓글: ${story.descendants || 0}`);
            if (story.translatedContent) {
                console.log(`    내용: ${story.translatedContent.substring(0, 200)}...`);
            }
        });
        console.log('\n' + '='.repeat(60));
    }

    console.log('\n🎉 완료!');
}

// HN API에서 인기글 ID 가져오기
async function getTopStories(count) {
    const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
    const topIds = ids.slice(0, count);

    const stories = await Promise.all(
        topIds.map(id => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`))
    );

    return stories.filter(s => s && s.type === 'story');
}

// JSON 가져오기
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// 웹페이지 내용 가져오기
function fetchPageContent(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : require('http');

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; HN-Digest/1.0)',
                'Accept': 'text/html'
            },
            timeout: 10000
        };

        const req = protocol.get(options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // 리다이렉트 처리
                const redirectUrl = new URL(res.headers.location, url).href;
                resolve(fetchPageContent(redirectUrl));
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                data += chunk;
                // 너무 큰 페이지는 중단
                if (data.length > 500000) {
                    req.destroy();
                    resolve(extractText(data));
                }
            });
            res.on('end', () => resolve(extractText(data)));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// HTML에서 텍스트 추출
function extractText(html) {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

// DeepL 번역
async function translateText(text, targetLang) {
    if (!CONFIG.deeplApiKey) {
        return text; // API 키 없으면 원문 반환
    }

    const isFreeApi = CONFIG.deeplApiKey.endsWith(':fx');
    const hostname = isFreeApi ? 'api-free.deepl.com' : 'api.deepl.com';

    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            text: text,
            target_lang: targetLang
        }).toString();

        const options = {
            hostname,
            path: '/v2/translate',
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${CONFIG.deeplApiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(data);
                    resolve(result.translations[0].text);
                } else {
                    reject(new Error(`DeepL API error: ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 이메일 HTML 생성
function generateEmailHtml(stories) {
    const date = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    const storiesHtml = stories.map((story, i) => `
        <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #eee;">
            <h2 style="margin: 0 0 8px; font-size: 18px;">
                <span style="color: #666;">${i + 1}.</span>
                <a href="${story.url || story.hnUrl}" style="color: #0066cc; text-decoration: none;">
                    ${story.translatedTitle}
                </a>
            </h2>
            <p style="margin: 4px 0; color: #888; font-size: 14px;">
                원제: ${story.title}
            </p>
            <p style="margin: 8px 0; color: #666; font-size: 14px;">
                ⬆️ ${story.score}점 | 💬 <a href="${story.hnUrl}" style="color: #666;">${story.descendants || 0}개 댓글</a>
                ${story.url ? ` | 🔗 ${new URL(story.url).hostname}` : ''}
            </p>
            ${story.translatedContent ? `
                <div style="margin-top: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; font-size: 14px; color: #333; line-height: 1.6;">
                    ${story.translatedContent.substring(0, 500)}${story.translatedContent.length > 500 ? '...' : ''}
                </div>
            ` : ''}
        </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
    <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 2px solid #ff6600;">
            <h1 style="margin: 0; color: #ff6600; font-size: 24px;">🔥 Hacker News Daily</h1>
            <p style="margin: 8px 0 0; color: #888;">${date}</p>
        </div>

        ${storiesHtml}

        <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
            <p>이 이메일은 자동으로 생성되었습니다.</p>
            <p><a href="https://news.ycombinator.com" style="color: #ff6600;">Hacker News</a>에서 더 많은 글 보기</p>
        </div>
    </div>
</body>
</html>`;
}

// Resend로 이메일 전송
function sendEmail(htmlContent) {
    return new Promise((resolve, reject) => {
        const date = new Date().toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric'
        });

        const postData = JSON.stringify({
            from: CONFIG.emailFrom,
            to: CONFIG.emailTo,
            subject: `🔥 HN Daily Digest - ${date}`,
            html: htmlContent
        });

        const options = {
            hostname: 'api.resend.com',
            path: '/emails',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.resendApiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Resend API error: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 실행
main().catch(err => {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
});
