const API = {
    anilist: 'https://graphql.anilist.co',
    stream: 'https://megaplay.buzz/stream/ani'
};

const State = {
    trending: [],
    currentSlide: 0,
    slideTimer: null
};

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    setupEventListeners();
    fetchTrendingData();
    registerServiceWorker();
    setupInstallPrompt();
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(e.target.value.trim());
    });
    document.getElementById('brand-logo').addEventListener('click', resetToHome);
    document.getElementById('btn-back').addEventListener('click', closeDetail);
}

// ---- PWA: service worker registration ----
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .catch((err) => console.warn('Service worker registration failed:', err));
    });
}

// ---- PWA: "Install App" button ----
function setupInstallPrompt() {
    const installBtn = document.getElementById('btn-install');
    if (!installBtn) return;

    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        installBtn.hidden = false;
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
        installBtn.hidden = true;
        deferredPrompt = null;
    });
}

async function fetchTrendingData() {
    const query = `
        query {
            Page (perPage: 12) {
                media (sort: TRENDING_DESC, type: ANIME) {
                    id title { english romaji } coverImage { extraLarge large }
                    bannerImage episodes description genres meanScore
                }
            }
        }
    `;

    try {
        const response = await fetch(API.anilist, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        State.trending = data.data.Page.media;
        
        buildHeroCarousel(State.trending);
        renderGrid(State.trending);
    } catch (err) {
        console.error(err);
        document.getElementById('anime-grid').innerHTML = '<div class="state-msg">Network error. Check connection.</div>';
    }
}

function buildHeroCarousel(list) {
    const track = document.getElementById('hero-track');
    const dotsContainer = document.getElementById('hero-dots');
    
    track.innerHTML = ''; dotsContainer.innerHTML = '';

    list.forEach((item, idx) => {
        const title = item.title.english || item.title.romaji;
        const banner = item.bannerImage || item.coverImage.extraLarge;
        const cleanDesc = item.description ? item.description.replace(/<[^>]*>?/gm, '') : 'No description.';
        
        const slide = document.createElement('div');
        slide.className = `hero-slide ${idx === 0 ? 'active' : ''}`;
        slide.innerHTML = `
            <img class="hero-bg" src="${banner}" alt="${title}">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <span class="hero-badge">${item.genres[0] || 'ANIME'}</span>
                <h2 class="hero-title">${title}</h2>
                <p class="hero-desc">${cleanDesc}</p>
                <button class="btn-apple" onclick="openDetailById(${item.id})">Watch Now</button>
            </div>
        `;
        track.appendChild(slide);

        const dot = document.createElement('div');
        dot.className = `dot ${idx === 0 ? 'active' : ''}`;
        dot.onclick = () => setSlide(idx);
        dotsContainer.appendChild(dot);
    });
    startAutoSlide();
}

function setSlide(idx) {
    const slides = document.querySelectorAll('.hero-slide');
    const dots = document.querySelectorAll('.dot');
    if (!slides.length) return;

    slides[State.currentSlide].classList.remove('active');
    dots[State.currentSlide].classList.remove('active');

    State.currentSlide = idx;

    slides[State.currentSlide].classList.add('active');
    dots[State.currentSlide].classList.add('active');
}

function startAutoSlide() {
    clearInterval(State.slideTimer);
    State.slideTimer = setInterval(() => {
        setSlide((State.currentSlide + 1) % State.trending.length);
    }, 6000);
}

async function handleSearch(keyword) {
    if (!keyword) return;
    document.getElementById('grid-header-title').innerText = `Results for "${keyword}"`;
    document.getElementById('hero-carousel').style.display = 'none';
    
    const grid = document.getElementById('anime-grid');
    grid.innerHTML = '<div class="state-msg">Searching...</div>';

    const query = `
        query ($search: String) {
            Page (perPage: 24) {
                media (search: $search, type: ANIME, sort: POPULARITY_DESC) {
                    id title { english romaji } coverImage { extraLarge large } episodes description meanScore
                }
            }
        }
    `;

    try {
        const response = await fetch(API.anilist, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { search: keyword } })
        });
        const data = await response.json();
        renderGrid(data.data.Page.media);
    } catch (err) {
        grid.innerHTML = '<div class="state-msg">Search failed.</div>';
    }
}

function renderGrid(list) {
    const grid = document.getElementById('anime-grid');
    if (!list.length) { grid.innerHTML = '<div class="state-msg">No titles found.</div>'; return; }
    
    grid.innerHTML = '';
    list.forEach(item => {
        const title = item.title.english || item.title.romaji;
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openDetail(item);

        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${item.coverImage.extraLarge || item.coverImage.large}" alt="${title}">
                <div class="card-score">★ ${item.meanScore || '--'}%</div>
            </div>
            <div class="card-info">
                <div class="card-title">${title}</div>
                <div class="card-meta">${item.episodes || '?'} Episodes</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Ensure the openDetail function is globally accessible if called inline from dynamic HTML
window.openDetailById = function(id) {
    const item = State.trending.find(x => x.id === id);
    if (item) openDetail(item);
};

function openDetail(anime) {
    document.getElementById('browse-view').style.display = 'none';
    document.getElementById('hero-carousel').style.display = 'none';
    document.getElementById('detail-view').style.display = 'block';

    const title = anime.title.english || anime.title.romaji;
    document.getElementById('detail-title').innerText = title;
    document.getElementById('detail-img').src = anime.coverImage.extraLarge || anime.coverImage.large;
    document.getElementById('detail-desc').innerHTML = anime.description || 'No description available.';

    const epGrid = document.getElementById('episodes-grid');
    epGrid.innerHTML = '';
    const totalEps = anime.episodes || 12;

    for (let i = 1; i <= totalEps; i++) {
        const pill = document.createElement('div');
        pill.className = 'ep-pill';
        pill.innerText = i;
        pill.onclick = () => {
            document.querySelectorAll('.ep-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            playEpisode(anime.id, i, title);
        };
        epGrid.appendChild(pill);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToHome() {
    document.getElementById('search-input').value = '';
    document.getElementById('browse-view').style.display = 'block';
    document.getElementById('hero-carousel').style.display = 'block';
    document.getElementById('detail-view').style.display = 'none';
    document.getElementById('grid-header-title').innerText = 'Trending Now';
    renderGrid(State.trending);
}

function closeDetail() {
    resetToHome();
    document.getElementById('video-frame').src = '';
    document.getElementById('player-status-label').innerText = 'Select an episode to begin';
}

function playEpisode(id, ep, title) {
    const iframe = document.getElementById('video-frame');
    document.getElementById('player-status-label').innerText = `Streaming: ${title} — Episode ${ep}`;
    iframe.src = `${API.stream}/${id}/${ep}/sub`;
    iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
}