require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// USAGE_FILE 주석 처리 (Vercel에서는 파일 시스템이 유지되지 않음)
// const USAGE_FILE = path.join(__dirname, 'usage.json');
const MAX_CHARACTERS = 1000000; // 100만 글자

// 사용량 읽기 (Vercel용 - 항상 0 반환)
function readUsage() {
    return { month: new Date().toISOString().slice(0, 7), characters: 0 };
}

// 사용량 저장 (Vercel용 - 아무 작업 안 함)
function writeUsage(usage) {
    // Vercel에서는 파일 시스템에 쓸 수 없으므로 비활성화
    console.log('Usage tracking disabled on Vercel:', usage);
}

// 현재 월 확인 및 초기화 (Vercel용 - 항상 새 객체 반환)
function checkAndResetUsage() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return { month: currentMonth, characters: 0 };
}

// 사용량 추가 (Vercel용 - 로그만 출력)
function addUsage(characters) {
    const usage = checkAndResetUsage();
    usage.characters += characters;
    console.log(`TTS 사용: ${characters}자 (누적: ${usage.characters}자)`);
    return usage;
}

// 미들웨어
app.use(express.json());
app.use(express.static('public'));

// 재사용 가능한 컨텐츠 추출 함수
async function extractArticleContent(url) {
    try {
        // URL에서 HTML 가져오기
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 3000 // 빠른 응답을 위해 3초로 단축
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // 제목 추출
        let title = $('h1').first().text().trim() ||
                    $('title').text().trim() ||
                    $('meta[property="og:title"]').attr('content') ||
                    '제목 없음';

        // 대표 이미지 추출
        let image = $('meta[property="og:image"]').attr('content') ||
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('img').first().attr('src') ||
                    '';

        // 저자 추출 시도 (다양한 선택자 시도)
        let author = $('meta[name="author"]').attr('content') ||
                     $('meta[property="article:author"]').attr('content') ||
                     $('.author').first().text().trim() ||
                     $('.user-nickname').first().text().trim() ||
                     $('.writer').first().text().trim() ||
                     $('.by').first().text().trim() ||
                     $('[data-author]').first().attr('data-author') ||
                     $('a[rel="author"]').first().text().trim() ||
                     '';

        // 본문 텍스트 추출
        let content = '';

        // 다양한 선택자 시도
        const selectors = [
            'article',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.content',
            'main article',
            '[role="main"]',
            '.article-body',
            '.post-body'
        ];

        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                // 불필요한 요소 제거 (댓글 포함)
                element.find('script, style, nav, header, footer, aside, .ad, .advertisement, .social-share, .comment, .comments, #comments, .reply, .replies, .comment-list, .comment-section').remove();

                // 제목과 문단을 순서대로 추출
                const contentParts = [];
                element.find('h1, h2, h3, h4, h5, h6, p').each((i, el) => {
                    const text = $(el).text().trim();
                    if (text.length > 1) { // 의미있는 텍스트만
                        contentParts.push(text);
                    }
                });

                if (contentParts.length > 0) {
                    content = contentParts.join(' ');
                    break;
                }
            }
        }

        // 콘텐츠를 찾지 못한 경우, 모든 제목과 p 태그에서 추출
        if (!content) {
            const contentParts = [];
            $('h1, h2, h3, h4, h5, h6, p').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 10) {
                    contentParts.push(text);
                }
            });
            content = contentParts.join(' ');
        }

        // 여전히 콘텐츠가 없다면 null 반환
        if (!content || content.length < 50) {
            return null;
        }

        // 텍스트 정리
        content = content
            .replace(/\s+/g, ' ')          // 모든 공백을 하나의 공백으로
            .trim();

        return {
            content,
            wordCount: content.replace(/\s+/g, '').length,
            title,
            author,
            image
        };

    } catch (error) {
        console.error(`추출 실패 (${url}):`, error.message);
        return null;
    }
}

// 인기글 목록 가져오기 API
app.get('/api/fetch-popular', async (req, res) => {
    try {
        const response = await axios.get('https://weolbu.com/community', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const articles = [];

        // Next.js 앱이므로 __NEXT_DATA__ 스크립트에서 데이터 추출
        const nextDataScript = $('script#__NEXT_DATA__').html();

        if (nextDataScript) {
            try {
                const nextData = JSON.parse(nextDataScript);
                const posts = nextData?.props?.pageProps?.posts ||
                             nextData?.props?.pageProps?.popularPosts ||
                             nextData?.props?.pageProps?.data?.posts ||
                             [];

                console.log(`📊 Next.js에서 찾은 posts 개수: ${posts.length}`);

                posts.slice(0, 5).forEach(post => {
                    const url = `https://weolbu.com/community/${post.id}/${post.slug || ''}`;
                    const author = post.user?.nickName || post.user?.name || post.author?.nickName || post.author?.name || '';

                    articles.push({
                        id: url,
                        title: post.title || '제목 없음',
                        url: url,
                        image: post.thumbnailUrl || post.thumbnail || '',
                        author: author
                    });
                });
            } catch (parseError) {
                console.error('Next.js 데이터 파싱 오류:', parseError.message);
            }
        }

        // Next.js 데이터로 추출 못했으면 HTML에서 직접 추출 시도
        if (articles.length === 0) {
            console.log('⚠️  Next.js 데이터를 찾지 못해 HTML 스크래핑 시도');

            // 모든 커뮤니티 링크 수집
            const seenIds = new Set();
            const postLinks = [];

            $('a[href*="/community/"]').each((i, element) => {
                const $el = $(element);
                const href = $el.attr('href');

                if (!href || href === '/community') return;

                // /community/숫자/... 패턴 추출
                const match = href.match(/\/community\/(\d+)/);
                if (match && !seenIds.has(match[1])) {
                    seenIds.add(match[1]);

                    // 링크 요소와 부모 요소에서 정보 추출
                    const $parent = $el.closest('article, div[class*="post"], div[class*="item"], li');
                    const $container = $parent.length > 0 ? $parent : $el;

                    // 제목 찾기 - 여러 방법 시도
                    let title = $container.find('h1, h2, h3, h4, h5, h6, [class*="title"]')
                        .not('[class*="sub"]')
                        .first()
                        .text()
                        .trim();

                    if (!title || title.length < 5) {
                        title = $el.text().trim();
                    }

                    // 작성자 찾기
                    let author = $container.find('[class*="author"], [class*="user"], [class*="writer"], [class*="nickname"]')
                        .not('[class*="date"]')
                        .first()
                        .text()
                        .trim();

                    // 이미지 찾기
                    const image = $container.find('img').first().attr('src') || '';

                    if (title.length >= 5) {
                        const fullUrl = href.startsWith('http') ? href : `https://weolbu.com${href}`;
                        postLinks.push({
                            id: fullUrl,
                            title: title,
                            url: fullUrl,
                            image: image,
                            author: author || '월급쟁이 부자들'
                        });
                    }
                }

                if (postLinks.length >= 5) return false; // 5개 찾으면 중단
            });

            console.log(`📝 HTML 스크래핑으로 ${postLinks.length}개 추출`);
            articles.push(...postLinks.slice(0, 5));
        }

        // 중복 제거 (id 기준)
        let uniqueArticles = Array.from(new Map(articles.map(item => [item.id, item])).values());

        // 여전히 5개 미만이면 빈 슬롯 채우기 (실제 URL로)
        while (uniqueArticles.length < 5) {
            const index = uniqueArticles.length + 1;
            uniqueArticles.push({
                id: `https://weolbu.com/community/placeholder-${index}`,
                title: `추가 인기글 ${index}`,
                url: `https://weolbu.com/community`,
                image: '',
                author: '월급쟁이 부자들'
            });
        }

        // 예상 시간 계산 제거 - 실제 재생 시에만 콘텐츠 로드

        console.log(`✅ ${uniqueArticles.length}개의 인기글을 반환합니다.`);
        res.json({ articles: uniqueArticles });

    } catch (error) {
        console.error('인기글 가져오기 오류:', error.message);
        res.json({ articles: [] });
    }
});

// 텍스트 추출 API
app.post('/api/extract', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL이 필요합니다.' });
        }

        // 재사용 가능한 함수 사용 (타임아웃 10초)
        const result = await extractArticleContent(url);

        if (!result) {
            return res.status(400).json({
                error: '콘텐츠를 추출할 수 없습니다. 다른 URL을 시도해주세요.'
            });
        }

        res.json({
            title: result.title,
            author: result.author,
            image: result.image,
            content: result.content,
            wordCount: result.wordCount,
            url
        });

    } catch (error) {
        console.error('Error extracting content:', error.message);

        if (error.code === 'ENOTFOUND') {
            return res.status(404).json({
                error: '페이지를 찾을 수 없습니다.'
            });
        }

        if (error.code === 'ETIMEDOUT') {
            return res.status(408).json({
                error: '요청 시간이 초과되었습니다.'
            });
        }

        res.status(500).json({
            error: '콘텐츠를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 텍스트를 청크로 나누기
app.post('/api/prepare-chunks', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: '텍스트가 필요합니다.' });
        }

        // 약 5,000자씩 청크로 나누기 (더 빠른 로딩)
        const CHUNK_SIZE = 5000;
        const chunks = [];
        const words = text.split(' ');
        let currentChunk = '';

        for (const word of words) {
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
            if (testChunk.length > CHUNK_SIZE && currentChunk) {
                chunks.push(currentChunk);
                currentChunk = word;
            } else {
                currentChunk = testChunk;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        console.log(`📦 텍스트를 ${chunks.length}개의 청크로 분할`);

        res.json({
            totalChunks: chunks.length,
            chunks: chunks.map((chunk, index) => ({
                index,
                length: chunk.length,
                text: chunk
            }))
        });

    } catch (error) {
        console.error('청크 준비 오류:', error.message);
        res.status(500).json({
            error: '청크 준비 중 오류가 발생했습니다.'
        });
    }
});

// 특정 청크만 TTS로 변환
app.post('/api/synthesize-chunk', async (req, res) => {
    try {
        const { text, voice, chunkIndex, totalChunks } = req.body;

        if (!text) {
            return res.status(400).json({ error: '텍스트가 필요합니다.' });
        }

        // 기본 목소리 설정
        const selectedVoice = voice || 'ko-KR-Wavenet-A';

        // API 키 확인
        if (!process.env.GOOGLE_CLOUD_API_KEY) {
            return res.status(500).json({
                error: 'Google Cloud API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.'
            });
        }

        // 사용량 확인
        const usage = checkAndResetUsage();
        const textLength = text.length;

        if (usage.characters + textLength > MAX_CHARACTERS) {
            const remaining = MAX_CHARACTERS - usage.characters;
            return res.status(429).json({
                error: `월 사용량 한도를 초과했습니다. (${usage.characters.toLocaleString()}/${MAX_CHARACTERS.toLocaleString()}자 사용) 남은 글자: ${remaining.toLocaleString()}자`,
                usage: usage.characters,
                limit: MAX_CHARACTERS,
                remaining: remaining
            });
        }

        console.log(`🎙️  청크 ${chunkIndex + 1}/${totalChunks} TTS 생성 중... (${textLength}자)`);

        // 텍스트를 TTS API 청크로 분할 (4000바이트씩)
        const MAX_TTS_CHUNK_SIZE = 4000;
        const ttsChunks = [];
        let currentTtsChunk = '';

        const words = text.split(' ');
        for (const word of words) {
            const testChunk = currentTtsChunk + (currentTtsChunk ? ' ' : '') + word;
            if (Buffer.byteLength(testChunk, 'utf8') > MAX_TTS_CHUNK_SIZE) {
                if (currentTtsChunk) {
                    ttsChunks.push(currentTtsChunk);
                }
                currentTtsChunk = word;
            } else {
                currentTtsChunk = testChunk;
            }
        }
        if (currentTtsChunk) {
            ttsChunks.push(currentTtsChunk);
        }

        // 각 TTS 청크를 변환
        const audioBuffers = [];
        for (let i = 0; i < ttsChunks.length; i++) {
            const response = await axios.post(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
                {
                    input: {
                        text: ttsChunks[i]
                    },
                    voice: {
                        languageCode: 'ko-KR',
                        name: selectedVoice
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 1.0,
                        pitch: 0.0
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const buffer = Buffer.from(response.data.audioContent, 'base64');
            audioBuffers.push(buffer);
        }

        // 모든 오디오 버퍼를 합치기
        const audioBuffer = Buffer.concat(audioBuffers);

        // MP3로 응답
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=86400'
        });

        res.send(audioBuffer);

        // 사용량 추가
        const newUsage = addUsage(textLength);
        console.log(`✅ 청크 ${chunkIndex + 1}/${totalChunks} 완료 - 누적 사용량: ${newUsage.characters.toLocaleString()}/${MAX_CHARACTERS.toLocaleString()}자`);

    } catch (error) {
        console.error('TTS Error:', error.response?.data || error.message);

        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(401).json({
                error: 'Google Cloud API 키가 올바르지 않거나 권한이 없습니다.'
            });
        }

        res.status(500).json({
            error: '음성 생성 중 오류가 발생했습니다.'
        });
    }
});

// Google Cloud TTS API (기존 방식 - 호환성 유지)
app.post('/api/synthesize', async (req, res) => {
    try {
        const { text, voice } = req.body;

        if (!text) {
            return res.status(400).json({ error: '텍스트가 필요합니다.' });
        }

        // 기본 목소리 설정
        const selectedVoice = voice || 'ko-KR-Wavenet-A';

        // API 키 확인
        if (!process.env.GOOGLE_CLOUD_API_KEY) {
            return res.status(500).json({
                error: 'Google Cloud API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.'
            });
        }

        // 사용량 확인
        const usage = checkAndResetUsage();
        const textLength = text.length;

        if (usage.characters + textLength > MAX_CHARACTERS) {
            const remaining = MAX_CHARACTERS - usage.characters;
            return res.status(429).json({
                error: `월 사용량 한도를 초과했습니다. (${usage.characters.toLocaleString()}/${MAX_CHARACTERS.toLocaleString()}자 사용) 남은 글자: ${remaining.toLocaleString()}자`,
                usage: usage.characters,
                limit: MAX_CHARACTERS,
                remaining: remaining
            });
        }

        console.log(`🎙️  TTS 생성 중... (${textLength}자) - 이번 달 사용량: ${usage.characters.toLocaleString()}/${MAX_CHARACTERS.toLocaleString()}자`);

        // 텍스트를 청크로 분할 (4000바이트씩, 안전하게)
        const MAX_CHUNK_SIZE = 4000;
        const chunks = [];
        let currentChunk = '';

        const words = text.split(' ');
        for (const word of words) {
            const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;
            if (Buffer.byteLength(testChunk, 'utf8') > MAX_CHUNK_SIZE) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                }
                currentChunk = word;
            } else {
                currentChunk = testChunk;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        console.log(`📦 ${chunks.length}개의 청크로 분할`);

        // 각 청크를 TTS로 변환
        const audioBuffers = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`🎵 청크 ${i + 1}/${chunks.length} 처리 중...`);
            const response = await axios.post(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_CLOUD_API_KEY}`,
                {
                    input: {
                        text: chunks[i]
                    },
                    voice: {
                        languageCode: 'ko-KR',
                        name: selectedVoice
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 1.0,
                        pitch: 0.0
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            const buffer = Buffer.from(response.data.audioContent, 'base64');
            audioBuffers.push(buffer);
        }

        // 모든 오디오 버퍼를 합치기
        const audioBuffer = Buffer.concat(audioBuffers);

        // MP3로 응답
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
            'Cache-Control': 'public, max-age=86400' // 24시간 캐시
        });

        res.send(audioBuffer);

        // 사용량 추가
        const newUsage = addUsage(textLength);
        console.log(`✅ TTS 생성 완료 - 누적 사용량: ${newUsage.characters.toLocaleString()}/${MAX_CHARACTERS.toLocaleString()}자`);

    } catch (error) {
        console.error('TTS Error:', error.response?.data || error.message);

        if (error.response?.status === 401 || error.response?.status === 403) {
            return res.status(401).json({
                error: 'Google Cloud API 키가 올바르지 않거나 권한이 없습니다.'
            });
        }

        res.status(500).json({
            error: '음성 생성 중 오류가 발생했습니다.'
        });
    }
});

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작 (로컬 개발용)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n✅ 서버가 시작되었습니다!`);
        console.log(`🌐 브라우저에서 열기: http://localhost:${PORT}`);
        console.log(`\n사용 방법:`);
        console.log(`1. 브라우저에서 위 주소를 엽니다`);
        console.log(`2. 칼럼 URL을 입력합니다`);
        console.log(`3. "불러오기" 버튼을 클릭합니다`);
        console.log(`4. 재생 버튼(▶)을 눌러 듣습니다\n`);
    });
}

// Vercel을 위한 export
module.exports = app;
