# 📻 칼럼 팟캐스트 리더

월급쟁이 부자들(월부닷컴)의 칼럼을 팟캐스트처럼 음성으로 듣는 웹 앱입니다.

## 주요 기능

- 📝 URL 입력만으로 칼럼 자동 추출
- 🔊 OpenAI TTS로 자연스러운 한국어 음성 재생
- ⏯️ 재생/일시정지 컨트롤
- ⚡ 재생 속도 조절 (0.5x ~ 2.0x)
- 📊 진행률 및 재생 시간 표시
- 📱 모바일 반응형 디자인

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. API 키 설정

`.env` 파일에 OpenAI API 키를 설정합니다:

```bash
OPENAI_API_KEY=your-api-key-here
PORT=3000
```

**API 키 받는 방법:**
1. https://platform.openai.com/signup 에서 계정 생성
2. https://platform.openai.com/api-keys 에서 API 키 생성
3. 생성된 키를 `.env` 파일에 입력

### 3. 서버 실행

```bash
npm start
```

개발 모드 (자동 재시작):
```bash
npm run dev
```

### 3. 브라우저에서 열기

서버가 시작되면 브라우저에서 다음 주소를 엽니다:

```
http://localhost:3000
```

## 사용 방법

1. **칼럼 URL 입력**: 읽고 싶은 칼럼의 URL을 입력합니다
2. **불러오기 클릭**: 칼럼이 자동으로 추출됩니다
3. **재생 버튼(▶) 클릭**: 음성으로 칼럼을 들을 수 있습니다
4. **속도 조절**: 원하는 재생 속도를 선택합니다 (1.0x 권장)

## 권장 브라우저

- ✅ 모든 최신 브라우저 지원 (Chrome, Edge, Safari, Firefox)

## 기술 스택

### 프론트엔드
- HTML5 / CSS3
- Vanilla JavaScript
- HTML5 Audio API

### 백엔드
- Node.js
- Express
- OpenAI TTS API
- Axios (HTTP 클라이언트)
- Cheerio (HTML 파싱)

## 프로젝트 구조

```
podcast-reader/
├── public/
│   ├── index.html      # 메인 HTML
│   ├── style.css       # 스타일시트
│   └── app.js          # TTS 플레이어 로직
├── server.js           # Express 서버 & 텍스트 추출 API
├── package.json
└── README.md
```

## API 엔드포인트

### POST /api/extract

칼럼 URL에서 텍스트를 추출합니다.

**요청:**
```json
{
  "url": "https://example.com/article"
}
```

**응답:**
```json
{
  "title": "칼럼 제목",
  "author": "저자명",
  "content": "본문 텍스트...",
  "wordCount": 1234,
  "url": "https://example.com/article"
}
```

## 향후 개선 계획

- [ ] OpenAI TTS 연동 (더 자연스러운 음성)
- [ ] 구간 북마크 기능
- [ ] 읽은 위치 저장
- [ ] 다운로드 기능
- [ ] 재생 목록 관리
- [ ] 백그라운드 재생

## 라이선스

MIT

## 문의

문제가 발생하면 이슈를 등록해주세요.
