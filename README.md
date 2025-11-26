# Web Translator

URL을 입력하면 웹페이지를 번역하는 웹 애플리케이션입니다.

## 기능

### 웹 번역기
- URL 입력 → 웹페이지 번역
- 원문/번역문 토글 비교
- 다국어 지원 (한국어, 영어, 일본어, 중국어, 독일어, 프랑스어, 스페인어)
- DeepL API를 사용한 고품질 번역

### Hacker News Daily Digest
- 매일 아침 HN 인기글 Top 10 자동 크롤링
- 제목 + 본문 한국어 번역
- 이메일로 전송
- GitHub Actions로 자동 실행 + 수동 실행 가능

## 배포 방법

### 1. Vercel로 배포 (권장)

1. [Vercel](https://vercel.com)에 GitHub 계정으로 로그인
2. "New Project" 클릭
3. 이 저장소 선택
4. "Deploy" 클릭
5. 배포 완료!

### 2. 로컬 실행

```bash
# Vercel CLI 설치
npm i -g vercel

# 개발 서버 실행
vercel dev
```

## 사용 방법

1. [DeepL API](https://www.deepl.com/pro-api)에서 무료 API 키 발급
2. 웹사이트에서 API 키 입력 및 저장
3. 번역할 웹페이지 URL 입력
4. 번역 언어 선택 후 "번역" 클릭

## DeepL Free API

- 무료 가입으로 API 키 발급 가능
- 월 50만자 무료 (약 100~200 페이지)
- 최고 품질의 번역 제공

## 기술 스택

- Frontend: HTML, CSS, JavaScript (Vanilla)
- Backend: Vercel Serverless Functions
- Translation: DeepL API

## HN Daily Digest 설정

### 1. 필요한 API 키 발급

1. **DeepL API 키**: [deepl.com/pro-api](https://www.deepl.com/pro-api) (무료)
2. **Resend API 키**: [resend.com](https://resend.com) (무료, 월 3000개 이메일)

### 2. GitHub Secrets 설정

GitHub 저장소 → Settings → Secrets and variables → Actions에서 추가:

| Secret 이름 | 설명 |
|-------------|------|
| `DEEPL_API_KEY` | DeepL API 키 |
| `RESEND_API_KEY` | Resend API 키 |
| `EMAIL_TO` | 받을 이메일 주소 |
| `EMAIL_FROM` | (선택) 보내는 이메일 주소 |

### 3. 실행 방법

**자동 실행**: 매일 오전 9시 (한국 시간)

**수동 실행**: GitHub → Actions → "HN Daily Digest" → "Run workflow"

**로컬 테스트**:
```bash
export DEEPL_API_KEY="your-key"
export RESEND_API_KEY="your-key"
export EMAIL_TO="your@email.com"
npm run digest
```

## 라이선스

MIT
