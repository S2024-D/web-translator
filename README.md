# Web Translator

URL을 입력하면 웹페이지를 번역하는 웹 애플리케이션입니다.

## 기능

- URL 입력 → 웹페이지 번역
- 원문/번역문 토글 비교
- 다국어 지원 (한국어, 영어, 일본어, 중국어, 독일어, 프랑스어, 스페인어)
- DeepL API를 사용한 고품질 번역

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

## 라이선스

MIT
