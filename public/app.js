// 오디오 플레이어 클래스
class PodcastPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentText = '';
        this.sentences = [];
        this.sentenceCumulativePercent = [];
        this.currentSentenceIndex = 0;
        this.currentArticle = null;
        this.playlist = [];

        // 스트리밍 관련
        this.audioChunks = [];
        this.currentChunkIndex = 0;
        this.totalChunks = 0;
        this.chunks = [];

        // 청크 캐시 (메모리 기반 - 세션 동안 유지)
        this.chunkCache = {};

        // 플레이어 상태
        this.isPlayerVisible = false;
        this.isFullscreen = false;
        this.miniPlayerVisible = false;

        // 현재 화면
        this.currentView = 'home'; // home, playlist

        // 편집 모드
        this.isEditMode = false;

        // 드롭다운 상태
        this.currentSpeed = 1.0;
        this.currentVoice = 'ko-KR-Wavenet-A';
        this.currentVoiceLabel = '여성 A';

        // 인기글 목록
        this.popularArticles = [];

        this.initElements();
        this.initEventListeners();
        this.initAudioListeners();
        this.loadTheme();
        this.loadPlaylist();
        this.loadPopularArticles();
    }

    initElements() {
        // 상태
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');

        // 홈 화면
        this.homeView = document.getElementById('homeView');
        this.urlInputHome = document.getElementById('urlInputHome');
        this.addUrlBtn = document.getElementById('addUrlBtn');
        this.popularContent = document.getElementById('popularContent');
        this.playAllBtn = document.getElementById('playAllBtn');
        this.themeToggleHome = document.getElementById('themeToggleHome');

        // 재생목록 화면
        this.playlistView = document.getElementById('playlistView');
        this.playlistContent = document.getElementById('playlistContent');
        this.editPlaylistBtn = document.getElementById('editPlaylistBtn');
        this.themeToggle = document.getElementById('themeToggle');

        // 네비게이션
        this.bottomNav = document.getElementById('bottomNav');
        this.navHome = document.getElementById('navHome');
        this.navPlaylist = document.getElementById('navPlaylist');

        // 모달
        this.urlModal = document.getElementById('urlModal');
        this.urlInputModal = document.getElementById('urlInputModal');
        this.addBtnPlaylist = document.getElementById('addBtnPlaylist');
        this.closeModal = document.getElementById('closeModal');
        this.cancelModal = document.getElementById('cancelModal');
        this.submitModal = document.getElementById('submitModal');

        // 플레이어 화면
        this.playerScreen = document.getElementById('playerScreen');
        this.closePlayer = document.getElementById('closePlayer');

        // 플레이어 정보
        this.playerTitle = document.getElementById('playerTitle');
        this.playerAuthor = document.getElementById('playerAuthor');
        this.playerDuration = document.getElementById('playerDuration');
        this.sentencesList = document.getElementById('sentencesList');

        // 미니 플레이어 요소
        this.bottomSheet = document.getElementById('bottomSheet');
        this.miniPlayer = document.getElementById('miniPlayer');
        this.miniThumbnail = document.getElementById('miniThumbnail');
        this.miniTitle = document.getElementById('miniTitle');
        this.miniAuthor = document.getElementById('miniAuthor');
        this.miniPlayBtn = document.getElementById('miniPlayBtn');
        this.miniProgressFill = document.getElementById('miniProgressFill');

        // 컨트롤
        this.playBtn = document.getElementById('playBtn');
        this.backwardBtn = document.getElementById('backwardBtn');
        this.forwardBtn = document.getElementById('forwardBtn');

        // 드롭다운
        this.speedBtn = document.getElementById('speedBtn');
        this.speedDropdown = document.getElementById('speedDropdown');
        this.voiceBtn = document.getElementById('voiceBtn');
        this.voiceDropdown = document.getElementById('voiceDropdown');

        // 진행바
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');

    }

    initEventListeners() {
        // 홈 화면 - URL 추가
        this.addUrlBtn.addEventListener('click', () => this.addUrlToPlaylist());
        this.urlInputHome.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addUrlToPlaylist();
        });

        // 전체 재생 버튼
        this.playAllBtn.addEventListener('click', () => this.playAll());

        // 편집 버튼
        this.editPlaylistBtn.addEventListener('click', () => this.toggleEditMode());

        // 테마 토글
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.themeToggleHome.addEventListener('click', () => this.toggleTheme());

        // 네비게이션
        this.navHome.addEventListener('click', () => this.switchView('home'));
        this.navPlaylist.addEventListener('click', () => this.switchView('playlist'));

        // 모달
        this.addBtnPlaylist.addEventListener('click', () => this.openModal());
        this.closeModal.addEventListener('click', () => this.closeModalWindow());
        this.cancelModal.addEventListener('click', () => this.closeModalWindow());
        this.submitModal.addEventListener('click', () => this.submitModalUrl());
        this.urlInputModal.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitModalUrl();
        });
        // 모달 오버레이 클릭 시 닫기
        this.urlModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModalWindow());

        // 플레이어 컨트롤
        this.closePlayer.addEventListener('click', () => this.hidePlayer());
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.backwardBtn.addEventListener('click', () => this.skipBackward());
        this.forwardBtn.addEventListener('click', () => this.skipForward());

        // 진행바 클릭
        this.progressBar.addEventListener('click', (e) => this.seekTo(e));

        // 미니 플레이어 이벤트
        this.miniPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });

        this.miniPlayer.addEventListener('click', () => {
            this.expandToFullPlayer();
        });

        // 드롭다운 컨트롤
        this.initDropdowns();

        // 에러 재시도
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.hideError();
                this.switchView('home');
            });
        }
    }

    initDropdowns() {
        // 속도 드롭다운
        this.speedBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speedDropdown.style.display = this.speedDropdown.style.display === 'none' ? 'block' : 'none';
            this.voiceDropdown.style.display = 'none';
        });

        this.speedDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const speed = parseFloat(e.target.dataset.speed);
                this.currentSpeed = speed;
                this.audio.playbackRate = speed;
                this.speedBtn.textContent = `${speed}x`;
                this.speedDropdown.style.display = 'none';
            });
        });

        // 목소리 드롭다운
        this.voiceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.voiceDropdown.style.display = this.voiceDropdown.style.display === 'none' ? 'block' : 'none';
            this.speedDropdown.style.display = 'none';
        });

        this.voiceDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const newVoice = e.target.dataset.voice;
                const newVoiceLabel = e.target.dataset.label;

                // 목소리가 실제로 변경된 경우에만 처리
                if (newVoice !== this.currentVoice) {
                    this.currentVoice = newVoice;
                    this.currentVoiceLabel = newVoiceLabel;
                    this.voiceBtn.textContent = this.currentVoiceLabel;

                    // 현재 재생 중인 아티클이 있으면 캐시 삭제하고 다시 생성
                    if (this.currentArticle && this.currentText) {
                        const wasPlaying = this.isPlaying;

                        // 재생 중이면 일시정지
                        if (wasPlaying) {
                            this.audio.pause();
                            this.isPlaying = false;
                        }

                        // 캐시 삭제
                        delete this.chunkCache[this.currentArticle.id];

                        // 새 목소리로 오디오 준비
                        await this.prepareAudio(this.currentText);

                        // 이전에 재생 중이었으면 자동 재생
                        if (wasPlaying) {
                            this.togglePlay();
                        }
                    }
                }

                this.voiceDropdown.style.display = 'none';
            });
        });

        // 외부 클릭 시 드롭다운 닫기
        document.addEventListener('click', () => {
            this.speedDropdown.style.display = 'none';
            this.voiceDropdown.style.display = 'none';
        });
    }

    showPlayer() {
        this.isPlayerVisible = true;
        this.playerScreen.style.display = 'flex';
        this.bottomNav.style.display = 'none'; // 전체 플레이어에서는 네비게이션 숨김
        this.hideMiniPlayer(); // 미니 플레이어 숨김
    }

    hidePlayer() {
        this.isPlayerVisible = false;
        this.playerScreen.style.display = 'none';
        this.bottomNav.style.display = 'flex'; // 네비게이션 다시 표시

        // 재생 중이면 미니 플레이어 표시
        if (this.currentArticle && this.audio.src) {
            this.showMiniPlayer();
        }
    }

    initAudioListeners() {
        // 재생 시간 업데이트
        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration && this.totalChunks > 0) {
                // 진행률 계산
                const chunkProgress = this.currentChunkIndex / this.totalChunks;
                const currentChunkProgress = (this.audio.currentTime / this.audio.duration) / this.totalChunks;
                const totalProgress = (chunkProgress + currentChunkProgress) * 100;

                this.progressFill.style.width = `${totalProgress}%`;

                // 미니 플레이어 진행 바 업데이트
                if (this.miniProgressFill) {
                    this.miniProgressFill.style.width = `${totalProgress}%`;
                }

                // 시간 표시
                this.currentTime.textContent = this.formatTime(this.audio.currentTime);
                this.totalTime.textContent = this.formatTime(this.audio.duration);

                // 현재 문장 업데이트
                this.updateCurrentSentence(totalProgress);
            }
        });

        // 청크 종료 시 다음 청크 재생
        this.audio.addEventListener('ended', () => {
            if (this.currentChunkIndex < this.totalChunks - 1) {
                this.currentChunkIndex++;
                this.playChunk(this.currentChunkIndex);
            } else {
                this.isPlaying = false;
                this.updatePlayButton();
            }
        });

        // 재생/일시정지 상태 변경
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateMiniPlayButton();
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
            this.updateMiniPlayButton();
        });
    }

    // ===== LocalStorage 관리 =====
    loadPlaylist() {
        const saved = localStorage.getItem('podcast_playlist');
        this.playlist = saved ? JSON.parse(saved) : [];
        this.renderPlaylist();
    }

    savePlaylist() {
        localStorage.setItem('podcast_playlist', JSON.stringify(this.playlist));
    }

    addToPlaylist(article) {
        // 중복 체크
        const exists = this.playlist.find(item => item.url === article.url);
        if (exists) return;

        // ID 추가
        article.id = Date.now();
        article.addedAt = new Date().toISOString();

        this.playlist.unshift(article);
        this.savePlaylist();
        this.renderPlaylist();
    }

    // ===== UI 렌더링 =====
    renderPlaylist() {
        this.playlistContent.innerHTML = '';

        if (this.playlist.length === 0) {
            this.playlistContent.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <p>저장된 칼럼이 없습니다.</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">+ 버튼을 눌러 칼럼을 추가하세요.</p>
                </div>
            `;
            return;
        }

        this.playlist.forEach(item => {
            const card = document.createElement('div');
            card.className = 'playlist-item';
            if (this.currentArticle && this.currentArticle.id === item.id) {
                card.classList.add('active');
            }

            // 예상 시간 계산 (한국어 TTS 평균 속도: 분당 180자)
            const estimatedMinutes = item.wordCount ? Math.ceil(item.wordCount / 180) : null;

            // 현재 재생목록에서의 인덱스
            const itemIndex = this.playlist.findIndex(p => p.id === item.id);

            card.innerHTML = `
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${item.title}</div>
                    ${estimatedMinutes
                        ? `<div class="estimated-time">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            약 ${estimatedMinutes}분
                           </div>`
                        : ''}
                </div>
                ${this.isEditMode ? `
                    <div class="playlist-edit-controls">
                        <button class="btn-edit-control btn-move-up" data-id="${item.id}" title="위로 이동" ${itemIndex === 0 ? 'disabled' : ''}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                        </button>
                        <button class="btn-edit-control btn-move-down" data-id="${item.id}" title="아래로 이동" ${itemIndex === this.playlist.length - 1 ? 'disabled' : ''}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <button class="btn-edit-control btn-delete" data-id="${item.id}" title="삭제">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                ` : ''}
            `;

            // 편집 모드가 아닐 때만 클릭 이벤트 추가
            if (!this.isEditMode) {
                card.addEventListener('click', () => this.loadArticleData(item));
            } else {
                // 편집 모드일 때는 버튼 이벤트만 추가
                const moveUpBtn = card.querySelector('.btn-move-up');
                const moveDownBtn = card.querySelector('.btn-move-down');
                const deleteBtn = card.querySelector('.btn-delete');

                if (moveUpBtn) {
                    moveUpBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.movePlaylistItem(item.id, 'up');
                    });
                }

                if (moveDownBtn) {
                    moveDownBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.movePlaylistItem(item.id, 'down');
                    });
                }

                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`"${item.title}"을(를) 삭제하시겠습니까?`)) {
                            this.deletePlaylistItem(item.id);
                        }
                    });
                }
            }

            this.playlistContent.appendChild(card);
        });
    }

    // ===== 인기글 불러오기 =====
    async loadPopularArticles() {
        try {
            const response = await fetch('/api/fetch-popular');
            const data = await response.json();

            if (data.articles && data.articles.length > 0) {
                this.popularArticles = data.articles; // 인기글 저장
                this.renderPopularArticles(data.articles);
            } else {
                this.popularArticles = [];
                this.popularContent.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">인기글을 불러올 수 없습니다.</p>';
            }
        } catch (error) {
            console.error('인기글 로드 오류:', error);
            this.popularArticles = [];
            this.popularContent.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">인기글을 불러올 수 없습니다.</p>';
        }
    }

    renderPopularArticles(articles) {
        this.popularContent.innerHTML = '';

        articles.forEach(article => {
            const item = document.createElement('div');
            item.className = 'popular-item';
            item.innerHTML = `
                <div class="popular-info">
                    <div class="popular-title">${article.title}</div>
                </div>
                <div class="popular-actions">
                    <button class="btn-popular-add" data-url="${article.url}" title="재생목록에 추가">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    <button class="btn-popular-play" data-url="${article.url}" title="바로 재생">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </button>
                </div>
            `;

            // 추가 버튼
            const addBtn = item.querySelector('.btn-popular-add');
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadArticleFromUrl(article.url);
            });

            // 재생 버튼
            const playBtn = item.querySelector('.btn-popular-play');
            playBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.loadArticleFromUrl(article.url);
                // 재생목록에 추가된 후 자동 재생
                setTimeout(() => {
                    if (this.audioChunks[0]) {
                        this.togglePlay();
                    }
                }, 500);
            });

            this.popularContent.appendChild(item);
        });
    }

    // ===== URL로 칼럼 추가 =====
    async addUrlToPlaylist() {
        const url = this.urlInputHome.value.trim();
        if (!url) {
            alert('URL을 입력해주세요.');
            return;
        }

        await this.loadArticleFromUrl(url);
        this.urlInputHome.value = '';
    }

    // ===== 칼럼 로드 =====
    async loadArticleFromUrl(url) {
        if (!url) {
            alert('URL을 입력해주세요.');
            return;
        }

        try {
            this.showLoading();

            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '칼럼을 불러오는데 실패했습니다.');
            }

            // 플레이리스트에 추가
            this.addToPlaylist(data);

            // 재생목록 화면으로 전환
            this.switchView('playlist');

            // 현재 칼럼으로 설정
            this.loadArticleData(data);

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        }
    }

    // 인기글 전체 재생
    async playAll() {
        if (!this.popularArticles || this.popularArticles.length === 0) {
            alert('인기글을 불러오는 중입니다...');
            return;
        }

        try {
            this.showLoading();

            // 모든 인기글을 순차적으로 플레이리스트에 추가
            for (const article of this.popularArticles) {
                // 이미 플레이리스트에 있는지 확인
                const existsInPlaylist = this.playlist.some(item => item.id === article.url);
                if (existsInPlaylist) {
                    console.log(`이미 플레이리스트에 있음: ${article.title}`);
                    continue;
                }

                // API로 콘텐츠 가져오기
                const response = await fetch('/api/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: article.url })
                });

                const data = await response.json();

                if (response.ok) {
                    this.addToPlaylist(data);
                    console.log(`플레이리스트에 추가됨: ${article.title}`);
                } else {
                    console.error(`추가 실패: ${article.title}`);
                }
            }

            this.hideLoading();

            // 재생목록 화면으로 전환
            this.switchView('playlist');

            // 첫 번째 칼럼 재생
            if (this.playlist.length > 0) {
                this.loadArticleData(this.playlist[0]);
            }

        } catch (error) {
            console.error('전체 재생 오류:', error);
            this.hideLoading();
            this.showError('인기글을 불러오는 중 오류가 발생했습니다.');
        }
    }

    async loadArticleData(article) {
        this.currentArticle = article;
        this.hideLoading();

        // 재생목록 화면으로 전환
        this.switchView('playlist');

        this.renderPlaylist();

        // 플레이어 UI 업데이트
        this.updatePlayerUI(article);

        // 이미 content가 있으면 그대로 사용, 없으면 다시 fetch
        if (!article.content) {
            console.log('콘텐츠가 없어서 다시 불러옵니다...');
            try {
                const response = await fetch('/api/extract', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: article.url })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || '칼럼을 불러오는데 실패했습니다.');
                }
                article.content = data.content;
                article.wordCount = data.wordCount;
                // 플레이리스트에도 업데이트
                const playlistItem = this.playlist.find(item => item.id === article.id);
                if (playlistItem) {
                    playlistItem.content = data.content;
                    playlistItem.wordCount = data.wordCount;
                    this.savePlaylist();
                }
            } catch (error) {
                console.error('Error:', error);
                this.showError(error.message);
                return;
            }
        }

        // 텍스트 준비
        let fullText = article.content;

        this.currentText = fullText;
        this.sentences = this.splitIntoSentences(fullText);
        this.calculateSentenceTiming();

        // 첫 번째 문장 인덱스 설정
        this.currentSentenceIndex = 0;

        // 문장 리스트 렌더링
        this.renderLyrics();

        // 캐시 확인
        const cached = this.chunkCache[article.id];
        if (cached) {
            console.log('✅ 캐시된 청크 사용 중...');

            // 캐시된 데이터 복원
            this.audioChunks = cached.audioChunks;
            this.chunks = cached.chunks;
            this.totalChunks = cached.totalChunks;
            this.currentChunkIndex = 0;

            console.log(`📦 ${this.totalChunks}개의 청크를 캐시에서 불러왔습니다.`);
        } else {
            // 캐시 없으면 TTS 청크 생성
            await this.prepareAudio(fullText);
        }

        // 미니 플레이어 업데이트 및 표시
        this.updateMiniPlayer();
        this.showMiniPlayer();

        // 자동 재생 시작
        if (this.audioChunks[0]) {
            this.playChunk(0);
        }
    }

    updatePlayerUI(article) {
        // 플레이어 정보 업데이트
        this.playerTitle.textContent = article.title || '제목 없음';
        this.playerDuration.textContent = article.wordCount ? `${article.wordCount.toLocaleString()}자` : '';
    }

    splitIntoSentences(text) {
        const sentences = text
            .split(/[.!?]\s+|\n/)
            .filter(s => s.trim().length > 0)
            .map(s => s.trim());
        return sentences;
    }

    calculateSentenceTiming() {
        // 각 문장의 글자 수 기반으로 누적 비율 계산
        const charCounts = this.sentences.map(s => s.length);
        const totalChars = charCounts.reduce((sum, count) => sum + count, 0);

        let cumulativeChars = 0;
        this.sentenceCumulativePercent = this.sentences.map((_, i) => {
            cumulativeChars += charCounts[i];
            return (cumulativeChars / totalChars) * 100;
        });
    }

    renderLyrics() {
        if (!this.sentencesList) return;

        // 문장 리스트 렌더링
        this.sentencesList.innerHTML = '';

        this.sentences.forEach((sentence, index) => {
            const sentenceDiv = document.createElement('div');
            sentenceDiv.className = 'sentence-item';
            sentenceDiv.textContent = sentence;
            sentenceDiv.dataset.index = index;

            // 첫 번째 문장에 active 클래스 추가
            if (index === 0) {
                sentenceDiv.classList.add('active');
            }

            // 클릭 이벤트: 해당 문장으로 이동
            sentenceDiv.addEventListener('click', () => {
                this.jumpToSentence(index);
            });

            this.sentencesList.appendChild(sentenceDiv);
        });
    }

    updateCurrentSentence(progressPercent) {
        // 글자 수 기반 타이밍을 사용하여 현재 문장 인덱스 찾기
        let sentenceIndex = 0;
        if (this.sentenceCumulativePercent) {
            sentenceIndex = this.sentenceCumulativePercent.findIndex(percent => progressPercent <= percent);
            if (sentenceIndex === -1) {
                sentenceIndex = this.sentences.length - 1;
            }
        } else {
            // fallback: 기존 방식 (균등 분배)
            sentenceIndex = Math.floor((progressPercent / 100) * this.sentences.length);
        }

        if (sentenceIndex !== this.currentSentenceIndex && sentenceIndex < this.sentences.length) {
            this.currentSentenceIndex = sentenceIndex;

            // 문장 리스트에서 active 클래스 업데이트
            if (this.sentencesList) {
                const allSentences = this.sentencesList.querySelectorAll('.sentence-item');
                allSentences.forEach((item, index) => {
                    if (index === sentenceIndex) {
                        item.classList.add('active');
                        // 현재 문장이 보이도록 스크롤
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        item.classList.remove('active');
                    }
                });
            }
        }
    }

    jumpToSentence(sentenceIndex) {
        if (this.totalChunks === 0 || !this.audioChunks[0]) return;

        const targetProgress = (sentenceIndex / this.sentences.length) * 100;
        const targetChunkIndex = Math.floor((targetProgress / 100) * this.totalChunks);
        const safeChunkIndex = Math.max(0, Math.min(targetChunkIndex, this.totalChunks - 1));
        const chunkProgress = ((targetProgress / 100) * this.totalChunks) - targetChunkIndex;

        if (safeChunkIndex !== this.currentChunkIndex) {
            this.currentChunkIndex = safeChunkIndex;
            this.playChunk(safeChunkIndex).then(() => {
                if (this.audio.duration && chunkProgress > 0 && chunkProgress < 1) {
                    this.audio.currentTime = this.audio.duration * chunkProgress;
                }
            });
        } else {
            if (this.audio.duration && chunkProgress >= 0 && chunkProgress <= 1) {
                this.audio.currentTime = this.audio.duration * chunkProgress;
            }
        }

        this.currentSentenceIndex = sentenceIndex;
        this.updateCurrentSentence(targetProgress);
    }

    // ===== TTS 오디오 준비 =====
    async prepareAudio(text) {
        try {
            this.showLoading();

            // 청크 준비
            const response = await fetch('/api/prepare-chunks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '청크 준비에 실패했습니다.');
            }

            this.chunks = data.chunks;
            this.totalChunks = data.totalChunks;
            this.audioChunks = new Array(this.totalChunks).fill(null);

            console.log(`📦 ${this.totalChunks}개의 청크 준비 완료`);

            // 첫 번째 청크 즉시 생성
            await this.loadChunk(0);

            this.hideLoading();

            // 나머지 청크는 백그라운드에서 로드
            for (let i = 1; i < this.totalChunks; i++) {
                this.loadChunk(i);
            }

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message);
        }
    }

    async loadChunk(index) {
        if (index >= this.totalChunks || this.audioChunks[index]) return;

        try {
            const chunk = this.chunks[index];
            const voice = this.currentVoice;

            const response = await fetch('/api/synthesize-chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: chunk.text,
                    voice,
                    chunkIndex: index,
                    totalChunks: this.totalChunks
                })
            });

            if (!response.ok) {
                throw new Error('TTS 생성에 실패했습니다.');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            this.audioChunks[index] = audioUrl;

            console.log(`✅ 청크 ${index + 1}/${this.totalChunks} 로드 완료`);

            // 모든 청크 로드 완료 시 캐시에 저장
            const allLoaded = this.audioChunks.every(chunk => chunk !== null);
            if (allLoaded && this.currentArticle) {
                this.saveToCache();
            }

        } catch (error) {
            console.error(`청크 ${index} 로드 실패:`, error);
        }
    }

    saveToCache() {
        if (!this.currentArticle) return;

        this.chunkCache[this.currentArticle.id] = {
            audioChunks: [...this.audioChunks],
            chunks: [...this.chunks],
            totalChunks: this.totalChunks
        };

        console.log(`💾 청크를 캐시에 저장했습니다. (ID: ${this.currentArticle.id})`);
    }

    async playChunk(index) {
        if (!this.audioChunks[index]) {
            console.log(`청크 ${index} 대기 중...`);
            await this.loadChunk(index);
        }

        if (this.audioChunks[index]) {
            this.audio.src = this.audioChunks[index];
            this.audio.playbackRate = this.currentSpeed;
            await this.audio.play();
        }
    }

    // ===== 플레이어 컨트롤 =====
    async togglePlay() {
        if (!this.audioChunks[0]) {
            alert('오디오를 준비 중입니다. 잠시만 기다려주세요.');
            return;
        }

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            if (!this.audio.src || this.audio.ended) {
                await this.playChunk(this.currentChunkIndex);
            } else {
                await this.audio.play();
            }
        }
    }

    skipBackward() {
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
    }

    skipForward() {
        this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
    }

    seekTo(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percentage = (clickX / width) * 100;

        const targetChunkIndex = Math.floor((percentage / 100) * this.totalChunks);
        const safeChunkIndex = Math.max(0, Math.min(targetChunkIndex, this.totalChunks - 1));
        const chunkProgress = ((percentage / 100) * this.totalChunks) - targetChunkIndex;

        if (safeChunkIndex !== this.currentChunkIndex) {
            this.currentChunkIndex = safeChunkIndex;
            this.playChunk(safeChunkIndex).then(() => {
                if (this.audio.duration && chunkProgress > 0 && chunkProgress < 1) {
                    this.audio.currentTime = this.audio.duration * chunkProgress;
                }
            });
        } else {
            if (this.audio.duration && chunkProgress >= 0 && chunkProgress <= 1) {
                this.audio.currentTime = this.audio.duration * chunkProgress;
            }
        }
    }

    updatePlayButton() {
        const playIcon = this.playBtn.querySelector('.play-icon');

        if (this.isPlaying) {
            // 일시정지 아이콘으로 변경
            playIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        } else {
            // 재생 아이콘으로 변경
            playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        }
    }

    // ===== 유틸리티 =====
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    toggleTheme() {
        document.body.classList.toggle('light-mode');
        const icons = document.querySelectorAll('.theme-icon');

        if (document.body.classList.contains('light-mode')) {
            // 라이트 모드 → 달 아이콘 표시 (다크 모드로 전환 가능)
            icons.forEach(icon => {
                icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor');
                icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            });
            localStorage.setItem('theme', 'light');
        } else {
            // 다크 모드 → 해 아이콘 표시 (라이트 모드로 전환 가능)
            icons.forEach(icon => {
                icon.setAttribute('fill', 'currentColor');
                icon.setAttribute('stroke', 'none');
                icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
            });
            localStorage.setItem('theme', 'dark');
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-mode');
            const icons = document.querySelectorAll('.theme-icon');
            // 라이트 모드 → 달 아이콘 표시
            icons.forEach(icon => {
                icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor');
                icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
            });
        }
    }

    // ===== 화면 전환 =====
    switchView(view) {
        this.currentView = view;

        if (view === 'home') {
            this.homeView.style.display = 'flex';
            this.playlistView.style.display = 'none';
            this.navHome.classList.add('active');
            this.navPlaylist.classList.remove('active');

            // 홈 화면에서는 플레이어 숨김
            if (this.isPlayerVisible) {
                this.playerScreen.style.display = 'none';
            }
        } else if (view === 'playlist') {
            this.homeView.style.display = 'none';
            this.playlistView.style.display = 'flex';
            this.navHome.classList.remove('active');
            this.navPlaylist.classList.add('active');

            // 플레이어는 별도로 관리되므로 표시 상태 유지
            if (this.isPlayerVisible) {
                this.playerScreen.style.display = 'flex';
            }
        }
    }

    // ===== 편집 모드 토글 =====
    toggleEditMode() {
        this.isEditMode = !this.isEditMode;

        // 버튼 아이콘과 텍스트 변경
        const editBtn = this.editPlaylistBtn;
        if (this.isEditMode) {
            // 편집 모드: 체크 아이콘 (완료)
            editBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            editBtn.title = '완료';
        } else {
            // 일반 모드: 편집 아이콘
            editBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            `;
            editBtn.title = '편집';
        }

        // 재생목록 다시 렌더링
        this.renderPlaylist();
    }

    // ===== 재생목록 항목 삭제 =====
    deletePlaylistItem(itemId) {
        // 현재 재생 중인 항목인지 확인
        if (this.currentArticle && this.currentArticle.id === itemId) {
            this.audio.pause();
            this.isPlaying = false;
            this.hidePlayer();
        }

        // 재생목록에서 제거
        this.playlist = this.playlist.filter(item => item.id !== itemId);
        this.savePlaylist();
        this.renderPlaylist();
    }

    // ===== 재생목록 항목 이동 =====
    movePlaylistItem(itemId, direction) {
        const index = this.playlist.findIndex(item => item.id === itemId);
        if (index === -1) return;

        if (direction === 'up' && index > 0) {
            // 위로 이동
            [this.playlist[index - 1], this.playlist[index]] = [this.playlist[index], this.playlist[index - 1]];
        } else if (direction === 'down' && index < this.playlist.length - 1) {
            // 아래로 이동
            [this.playlist[index], this.playlist[index + 1]] = [this.playlist[index + 1], this.playlist[index]];
        }

        this.savePlaylist();
        this.renderPlaylist();
    }

    // ===== 모달 관리 =====
    openModal() {
        this.urlModal.style.display = 'flex';
        this.urlInputModal.value = '';
        this.urlInputModal.focus();
    }

    closeModalWindow() {
        this.urlModal.style.display = 'none';
        this.urlInputModal.value = '';
    }

    async submitModalUrl() {
        const url = this.urlInputModal.value.trim();
        if (!url) {
            alert('URL을 입력해주세요.');
            return;
        }

        this.closeModalWindow();
        await this.loadArticleFromUrl(url);
    }

    showLoading() {
        this.loadingState.style.display = 'flex';
    }

    hideLoading() {
        this.loadingState.style.display = 'none';
    }

    showError(message) {
        this.hideLoading();
        const errorMessage = this.errorState.querySelector('.error-message');
        errorMessage.textContent = message;
        this.errorState.style.display = 'flex';
    }

    hideError() {
        this.errorState.style.display = 'none';
    }

    // ===== 미니 플레이어 =====
    showMiniPlayer() {
        if (!this.currentArticle) return;

        this.miniPlayerVisible = true;
        this.bottomSheet.style.display = 'block';
        this.bottomNav.style.display = 'flex'; // 네비게이션 바 표시
        document.body.classList.add('mini-player-visible');
        this.updateMiniPlayer();
    }

    hideMiniPlayer() {
        this.miniPlayerVisible = false;
        this.bottomSheet.style.display = 'none';
        document.body.classList.remove('mini-player-visible');
    }

    updateMiniPlayer() {
        if (!this.currentArticle) return;

        // 썸네일
        if (this.currentArticle.image) {
            this.miniThumbnail.src = this.currentArticle.image;
            this.miniThumbnail.style.display = 'block';
        } else {
            this.miniThumbnail.style.display = 'none';
        }

        // 제목과 작성자
        this.miniTitle.textContent = this.currentArticle.title || '칼럼 제목';
        this.miniAuthor.textContent = this.currentArticle.author || '작성자';

        // 재생 버튼 상태
        this.updateMiniPlayButton();
    }

    updateMiniPlayButton() {
        if (!this.miniPlayBtn) return;

        const icon = this.miniPlayBtn.querySelector('.mini-play-icon');
        if (this.isPlaying) {
            // 일시정지 아이콘
            icon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
        } else {
            // 재생 아이콘
            icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
        }
    }

    expandToFullPlayer() {
        this.showPlayer();
    }
}

// 앱 초기화
const app = new PodcastPlayer();
