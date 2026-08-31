/* Mapper-backed episode metadata and the dedicated Ryuu watch page. */
PLAYER_SOURCES.megaplayAni.label = 'MegaPlay · AL';
PLAYER_SOURCES.anixoAni.label = 'AnixO · AL';
PLAYER_SOURCES.megavidAni.label = 'MegaVid · AL';

/* Lucide icons (stroke-based, inherits color via currentColor) used in the anime-stats row. */
const STAT_ICON_PATHS = {
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  'user-round': '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  tv: '<path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/>'
};
function statIcon(name) {
  return `<svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STAT_ICON_PATHS[name] || ''}</svg>`;
}
function cleanDescription(value = '') {
  const text = String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ');
  const decode = document.createElement('textarea');
  decode.innerHTML = text;
  return decode.value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function trimText(value, length) {
  const clean = cleanDescription(value);
  return clean.slice(0, length) + (clean.length > length ? '…' : '');
}

function mapperEndpoint(anilistId) {
  const base = CONFIG.episodeMapper?.baseUrl || 'https://api.ani.zip/';
  const url = new URL('mappings', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('anilist_id', anilistId);
  return url.toString();
}

async function fetchMappedEpisodes(anime) {
  try {
    const response = await fetch(mapperEndpoint(anime.id), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Mapper returned ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Episode mapping unavailable:', error);
    return null;
  }
}

function releasedEpisodeLimit(anime, mapped) {
  const now = Math.floor(Date.now() / 1000);
  const airedByAniList = (anime.airingSchedule?.nodes || []).filter(episode => Number(episode.airingAt) <= now).map(episode => Number(episode.episode)).filter(Number.isFinite);
  const releasedStreaming = (anime.streamingEpisodes || []).map((episode, index) => ({ number: Number((episode.title || '').match(/\d+(?:\.\d+)?/)?.[0]) || index + 1, date: episode.airingAt || 0 })).filter(episode => !episode.date || Number(episode.date) <= now).map(episode => episode.number);
  const releasedMapped = Object.values(mapped?.episodes || {}).filter(episode => !episode.airdate || Date.parse(episode.airdate) <= Date.now()).map(episode => Number(episode?.episode)).filter(Number.isFinite);
  const knownReleased = Math.max(0, ...airedByAniList, ...releasedStreaming, ...releasedMapped);
  const nextEpisode = Number(anime.nextAiringEpisode?.episode);
  if (anime.status === 'RELEASING') {
    if (Number.isFinite(nextEpisode) && nextEpisode > 0) return Math.max(0, Math.floor(nextEpisode) - 1);
    return knownReleased;
  }
  return Math.max(Number(anime.episodes) || 0, knownReleased);
}

async function episodeEntries(anime) {
  const mapping = await fetchMappedEpisodes(anime);
  const byNumber = new Map();
  Object.values(mapping?.episodes || {}).forEach(raw => {
    const number = Number(raw?.episode);
    if (!Number.isInteger(number) || number < 1) return;
    byNumber.set(number, {
      number,
      title: raw.title?.en || raw.title?.['x-jat'] || raw.title?.jp || `Episode ${number}`,
      overview: cleanDescription(raw.overview || ''),
      thumbnail: raw.image || '',
      airdate: raw.airdate || raw.airDate || '',
      mapped: true
    });
  });
  const total = releasedEpisodeLimit(anime, mapping);
  const fallbackImage = anime.bannerImage || coverOf(anime);
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const mapped = byNumber.get(number);
    return mapped ? { ...mapped, thumbnail: mapped.thumbnail || fallbackImage } : {
      number, title: `Episode ${number}`, overview: '', thumbnail: fallbackImage, airdate: '', mapped: false
    };
  });
}

async function openAnime(id) {
  state.returnRoute = state.route === 'detail' || state.route === 'watch' ? state.returnRoute : state.route;
  showRoute('detail');
  document.getElementById('detail-content').innerHTML = detailSkeletonMarkup();
  const query = `query Detail($id: Int) { Media(id: $id, type: ANIME) { id idMal title { romaji english native userPreferred } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes duration format status season seasonYear averageScore popularity genres source countryOfOrigin synonyms startDate { year month day } endDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } airingSchedule(notYetAired: false, perPage: 50) { nodes { episode airingAt } } streamingEpisodes { title thumbnail url site } mediaListEntry { id status progress score(format: POINT_10) } studios(isMain: true) { nodes { name } } relations { edges { relationType(version: 2) node { id type format status episodes seasonYear title { userPreferred } coverImage { medium } } } } } }`;
  try {
    state.currentAnime = (await anilist(query, { id })).Media;
    state.currentEpisode = 1;
    state.language = state.settings.defaultLanguage;
    state.source = state.settings.preferredSource;
    state.currentAnime.episodeEntries = await episodeEntries(state.currentAnime);
    renderDetail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    document.getElementById('detail-content').innerHTML = `<div class="empty-state">Could not load this anime. ${escapeHTML(error.message)}</div>`;
  }
}

function formatEpisodeAirdate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function episodeRow(entry) {
  const date = entry.airdate ? `<time class="episode-row-date" datetime="${escapeAttribute(entry.airdate)}">${escapeHTML(formatEpisodeAirdate(entry.airdate))}</time>` : '<span class="episode-row-date">Available</span>';
  return `<img class="episode-row-image" src="${escapeAttribute(entry.thumbnail)}" alt="" loading="lazy"><span class="episode-row-copy"><span class="episode-row-title"><span class="episode-row-number">${entry.number}.</span><span class="episode-row-name">${escapeHTML(entry.title)}</span></span>${entry.overview ? `<span class="episode-row-overview">${escapeHTML(entry.overview)}</span>` : ''}</span>${date}`;
}

function titleEpisodeRow(entry, progress) {
  return `<button class="episode-row ${entry.mapped ? '' : 'is-fallback'} ${entry.number <= progress ? 'is-watched' : ''}" type="button" data-watch-episode="${entry.number}" data-search="${escapeAttribute(`${entry.number} ${entry.title} ${entry.overview}`.toLowerCase())}" title="Watch episode ${entry.number}">${episodeRow(entry)}</button>`;
}

function watchEpisodeRow(entry) {
  return `<button class="episode-row ${entry.mapped ? '' : 'is-fallback'} ${entry.number === state.currentEpisode ? 'is-active' : ''}" type="button" data-play-episode="${entry.number}" data-search="${escapeAttribute(`${entry.number} ${entry.title} ${entry.overview}`.toLowerCase())}" title="Play episode ${entry.number}">${episodeRow(entry)}</button>`;
}

function renderEpisodeToolbar(entries) {
  const note = entries.some(entry => entry.mapped) ? 'Episode names, artwork, and summaries are from the episode mapper.' : 'Episode metadata is unavailable — showing numbered episode fallbacks.';
  return `<div class="episode-list-toolbar"><p>${note}</p><div class="episode-filter-wrap"><input class="episode-filter" type="search" placeholder="Filter episodes" aria-label="Filter episodes" autocomplete="off"><button class="filter-clear" type="button" aria-label="Clear filter" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div></div>`;
}

/* Filtering toggles a class instead of the `hidden` attribute: `.episode-row` sets its own
   `display: grid`, which ties with the browser's `[hidden]{display:none}` rule on specificity,
   so `row.hidden = true` alone never actually hid anything. */
function bindEpisodeFilter(scope) {
  const input = scope.querySelector('.episode-filter');
  const clearButton = scope.querySelector('.filter-clear');
  const emptyState = scope.querySelector('.episode-filter-empty');
  if (!input) return;
  const applyFilter = () => {
    const term = input.value.trim().toLowerCase();
    let visible = 0;
    scope.querySelectorAll('[data-search]').forEach(row => {
      const matches = !term || row.dataset.search.includes(term);
      row.classList.toggle('is-filtered-out', !matches);
      if (matches) visible += 1;
    });
    if (clearButton) clearButton.hidden = !input.value;
    if (emptyState) emptyState.hidden = !term || visible > 0;
  };
  input.addEventListener('input', applyFilter);
  clearButton?.addEventListener('click', event => {
    event.preventDefault();
    input.value = '';
    applyFilter();
    input.focus();
  });
  applyFilter();
}

function renderDetail() {
  const anime = state.currentAnime, title = titleOf(anime), total = Number(anime.episodes) || '?', entries = anime.episodeEntries || [];
  const year = anime.startDate?.year || anime.seasonYear || '—', banner = anime.bannerImage || coverOf(anime), studios = (anime.studios?.nodes || []).map(studio => studio.name).join(', ');
  const progress = anime.mediaListEntry?.progress || 0, description = cleanDescription(anime.description) || 'No synopsis is available for this title.';
  document.getElementById('detail-content').innerHTML = `<div class="detail-hero"><img class="detail-banner-glow" src="${escapeAttribute(banner)}" alt=""><div class="detail-banner">${anime.bannerImage ? `<img src="${escapeAttribute(anime.bannerImage)}" alt="">` : ''}</div></div><div class="detail-layout"><img class="detail-poster" src="${escapeAttribute(coverOf(anime))}" alt="${escapeAttribute(title)}"><div class="detail-body"><p class="detail-romaji">${escapeHTML(anime.title.romaji || title)}</p><h1>${escapeHTML(anime.title.english || title)}</h1><p class="detail-subtitle">${escapeHTML(anime.title.native || '')}</p><div class="metadata"><span>${escapeHTML(anime.format || 'ANIME')}</span><span>${total} episodes</span>${anime.duration ? `<span>${anime.duration} min</span>` : ''}<span>${escapeHTML(anime.status || 'UNKNOWN')}</span><span>${year}</span>${anime.averageScore ? `<span>★ ${anime.averageScore}/100</span>` : ''}<span>${Number(anime.popularity || 0).toLocaleString()} users</span></div>${state.auth.viewer ? `<div class="anilist-progress"><span>AniList progress</span><strong>${progress} / ${total}</strong></div>` : ''}${studios ? `<p class="detail-fact"><b>Studio</b> ${escapeHTML(studios)}</p>` : ''}${anime.source ? `<p class="detail-fact"><b>Source</b> ${escapeHTML(anime.source.replace(/_/g, ' '))}${anime.countryOfOrigin ? ` · ${escapeHTML(anime.countryOfOrigin)}` : ''}</p>` : ''}<div class="genre-list">${(anime.genres || []).map(genre => `<span class="genre">${escapeHTML(genre)}</span>`).join('')}</div><div class="description">${escapeHTML(description)}</div><div class="external-links"><a href="https://anilist.co/anime/${anime.id}" target="_blank" rel="noreferrer">AniList ↗</a>${anime.idMal ? `<a href="https://myanimelist.net/anime/${anime.idMal}" target="_blank" rel="noreferrer">MyAnimeList ↗</a>` : ''}${anime.trailer?.site === 'youtube' ? `<a href="https://www.youtube.com/watch?v=${anime.trailer.id}" target="_blank" rel="noreferrer">Trailer ↗</a>` : ''}</div></div></div><section class="episode-list-section"><div class="episode-list-header"><div><h2>Episodes</h2><p>${entries.length ? `${entries.length} released episode${entries.length === 1 ? '' : 's'} available to watch.` : 'No episodes are available yet.'}</p></div><button id="watch-first" class="button button-primary" type="button" ${entries.length ? '' : 'disabled'}>Watch now <span>→</span></button></div>${renderEpisodeToolbar(entries)}<div class="episode-list">${entries.map(entry => titleEpisodeRow(entry, progress)).join('') || '<div class="empty-state">AniList has not released an episode for this title yet.</div>'}</div><p class="episode-filter-empty" hidden>No episodes match your filter.</p></section>${relationsMarkup(anime)}`;
  const section = document.querySelector('.episode-list-section');
  bindEpisodeFilter(section);
  section.querySelectorAll('[data-watch-episode]').forEach(button => button.addEventListener('click', () => openWatchPage(Number(button.dataset.watchEpisode))));
  section.querySelector('#watch-first')?.addEventListener('click', () => openWatchPage(entries[0]?.number || 1));
}

function playerOptions(anime) {
  return Object.entries(PLAYER_SOURCES).map(([key, source]) => `<option value="${key}" ${key === state.source ? 'selected' : ''} ${source.build(anime, state.currentEpisode, state.language, state.settings.autoplay) ? '' : 'disabled'}>${source.label}${source.build(anime, state.currentEpisode, state.language, state.settings.autoplay) ? '' : ' (unavailable)'}</option>`).join('');
}

function playerMarkup() {
  const anime = state.currentAnime, url = PLAYER_SOURCES[state.source].build(anime, state.currentEpisode, state.language, state.settings.autoplay);
  if (!url) return '<div class="player-card is-active"><div class="player-toolbar"><strong>Playback unavailable</strong><span>This source needs a MyAnimeList ID.</span></div></div>';
  return `<div class="player-card is-active"><div class="player-toolbar"><strong>${escapeHTML(titleOf(anime))} · Episode ${state.currentEpisode}</strong><span>${PLAYER_SOURCES[state.source].label} · ${state.language.toUpperCase()}</span>${state.auth.viewer ? '<button id="mark-watched" class="mark-watched" type="button">Mark watched</button>' : ''}</div><iframe class="player-frame" src="${escapeAttribute(url)}" title="${escapeAttribute(titleOf(anime))} episode ${state.currentEpisode}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
}

function openWatchPage(episode = state.currentEpisode) {
  if (!state.currentAnime) return;
  state.currentEpisode = episode;
  showRoute('watch');
  renderWatchPage();
}

function renderWatchPage() {
  const anime = state.currentAnime;
  if (!anime) return;
  const entries = anime.episodeEntries || [], progress = anime.mediaListEntry?.progress || 0;
  document.getElementById('watch-content').innerHTML = `<section class="watch-page">${playerMarkup()}<div class="watch-header"><h2>${escapeHTML(titleOf(anime))}</h2><div class="watch-controls"><div class="language-toggle"><button class="${state.language === 'sub' ? 'is-active' : ''}" type="button" data-language="sub">Sub</button><button class="${state.language === 'dub' ? 'is-active' : ''}" type="button" data-language="dub">Dub</button></div><select id="source-select" class="source-select" aria-label="Playback source">${playerOptions(anime)}</select></div></div>${renderEpisodeToolbar(entries)}<div class="episode-list">${entries.map(watchEpisodeRow).join('')}</div><p class="episode-filter-empty" hidden>No episodes match your filter.</p><p class="player-note">Choose any released episode to switch playback source.</p></section>`;
  const page = document.querySelector('.watch-page');
  bindEpisodeFilter(page);
  page.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { state.language = button.dataset.language; renderWatchPage(); }));
  page.querySelector('#source-select')?.addEventListener('change', event => { state.source = event.target.value; renderWatchPage(); });
  page.querySelectorAll('[data-play-episode]').forEach(button => button.addEventListener('click', () => playEpisode(Number(button.dataset.playEpisode))));
  page.querySelector('#mark-watched')?.addEventListener('click', () => markEpisodeWatched(state.currentEpisode));
  page.querySelectorAll('[data-play-episode]').forEach(button => button.classList.toggle('is-watched', Number(button.dataset.playEpisode) <= progress));
}

function playEpisode(episode) {
  state.currentEpisode = episode;
  if (state.route !== 'watch') { openWatchPage(episode); return; }
  renderWatchPage();
  document.querySelector('.player-card')?.scrollIntoView({ behavior: state.settings.reducedMotion ? 'auto' : 'smooth', block: 'start' });
}

async function markEpisodeWatched(episode) {
  if (!state.auth.token) return;
  const button = document.getElementById('mark-watched');
  if (button) { button.disabled = true; button.textContent = 'Saving…'; }
  try {
    const data = await anilist(`mutation SaveProgress($mediaId: Int, $progress: Int) { SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: CURRENT) { id progress status } }`, { mediaId: state.currentAnime.id, progress: episode });
    state.currentAnime.mediaListEntry = data.SaveMediaListEntry;
    toast(`AniList updated to episode ${episode}.`);
    renderWatchPage();
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'Mark watched'; }
    toast(`Could not update AniList: ${error.message}`, true);
  }
}

function showRoute(route) {
  hideHoverCard();
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-active', view.id === `${route}-view`));
  state.route = route;
  window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });
}

function currentAniListSeason() {
  const now = new Date(), month = now.getMonth() + 1;
  if (month <= 2) return { season: 'WINTER', year: now.getFullYear() };
  if (month <= 5) return { season: 'SPRING', year: now.getFullYear() };
  if (month <= 8) return { season: 'SUMMER', year: now.getFullYear() };
  if (month <= 11) return { season: 'FALL', year: now.getFullYear() };
  return { season: 'WINTER', year: now.getFullYear() + 1 };
}

function gridSkeletonMarkup(count = 12) {
  return Array.from({ length: count }, () => '<article class="anime-skeleton" aria-hidden="true"><span class="skeleton-poster"></span><span class="skeleton-line skeleton-line-title"></span><span class="skeleton-line skeleton-line-meta"></span></article>').join('');
}

function sliderSkeletonMarkup() {
  return '<div class="feature-skeleton" aria-hidden="true"><span class="feature-skeleton-copy"><i></i><i></i><i></i><i></i></span></div>';
}

function activitySkeletonMarkup() {
  return '<div class="activity-skeleton" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>';
}

function detailSkeletonMarkup() {
  return '<div class="detail-skeleton" aria-hidden="true"><span class="detail-skeleton-banner"></span><div class="detail-skeleton-layout"><span class="detail-skeleton-poster"></span><span class="detail-skeleton-copy"><i></i><i></i><i></i><i></i><i></i></span></div><span class="detail-skeleton-episodes"><i></i><i></i><i></i></span></div>';
}

async function loadHome() {
  const current = currentAniListSeason();
  const query = `query Home($year: Int) { seasonal: Page(perPage: 8) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, season: ${current.season}, seasonYear: $year, isAdult: false) { ...AnimeCard } } airing: Page(perPage: 12) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, isAdult: false) { ...AnimeCard } } popular: Page(perPage: 12) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...AnimeCard } } } fragment AnimeCard on Media { id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } }`;
  try {
    const data = await anilist(query, { year: current.year });
    state.featured = data.seasonal.media.filter(anime => anime.bannerImage).slice(0, 5);
    if (!state.featured.length) state.featured = data.airing.media.filter(anime => anime.bannerImage).slice(0, 5);
    renderFeatured();
    renderAnimeGrid('top-airing-grid', data.airing.media);
    renderAnimeGrid('popular-grid', data.popular.media);
    renderAiring(data.airing.media.slice(0, 5));
    startFeatureAutoplay();
  } catch (error) {
    showNetworkError(['featured-carousel', 'top-airing-grid', 'popular-grid', 'airing-list'], error);
  }
}

function renderAiring(list) {
  state.airing = list || state.airing || [];
  const container = document.getElementById('airing-list');
  if (!container) return;
  if (state.settings.hideSiteBanner) { container.innerHTML = ''; return; }
  const tile = anime => `<article class="activity-tile" data-anime-id="${anime.id}" tabindex="0" role="button"><img src="${escapeAttribute(coverOf(anime))}" alt="${escapeAttribute(titleOf(anime))}" loading="lazy"><div class="activity-tile-copy"><strong>${escapeHTML(titleOf(anime))}</strong><span>${escapeHTML(anime.format || 'ANIME')} · ${anime.episodes || '?'} eps</span><small>★ ${anime.averageScore || '—'} · ${compactNumber(anime.popularity)} users</small></div></article>`;
  const left = state.airing.slice(0, 3), right = state.airing.slice(3, 5);
  container.innerHTML = `<div class="activity-lane activity-lane-left">${[...left, ...left, ...left].map(tile).join('')}</div><div class="activity-lane activity-lane-right">${[...right, ...right, ...right, ...right].map(tile).join('')}</div>`;
}

function applySettings() {
  document.documentElement.classList.toggle('reduced-motion', state.settings.reducedMotion);
  document.body.classList.toggle('no-glow', !state.settings.glow);
  document.body.classList.toggle('hide-site-banner', Boolean(state.settings.hideSiteBanner));
  document.getElementById('landing-hero')?.toggleAttribute('hidden', !state.settings.showHero || Boolean(state.settings.hideSiteBanner));
  if (state.airing) renderAiring(state.airing);
  if (!state.settings.hoverCards) hideHoverCard();
  if (state.settings.reducedMotion) { stopFeatureAutoplay(); stopTopAnimeAutoplay(); }
  else { if (state.featured.length) startFeatureAutoplay(); if ((state.topAnime || []).length) startTopAnimeAutoplay(); }
}

/* Electron-style preferences: a quiet title rail and simple filled setting rows. */
function renderSettings() {
  const settings = state.settings;
  const cards = [
    ['glow', 'Glow Effect', 'Enable the glow surrounding banners and the hover-triggered glow on anime cards.'],
    ['hideSiteBanner', 'Hide Site Banner', 'Hide the entire intro banner at the top of the home page, including the Ryuu logo and the artwork column.'],
    ['hoverCards', 'Modal popup when hovering over anime cards', 'Show the title detail popup on anime-card hover. Disabling it can improve scrolling performance.'],
    ['reducedMotion', 'Reduce Motion', 'Reduce carousel movement and interface animations.'],
    ['autoplay', 'Autoplay in web player', 'Request autoplay when your selected video provider supports it.']
  ];
  document.getElementById('settings-content').innerHTML = `<div class="electron-settings-title">Settings</div><div class="electron-settings-list">${anilistAccountMarkup()}${cards.map(([key, heading, description]) => `<article class="setting-card"><div><h2>${heading}</h2><p>${description}</p></div><input class="switch" type="checkbox" data-setting="${key}" ${settings[key] ? 'checked' : ''} aria-label="${heading}"></article>`).join('')}<article class="setting-card"><div><h2>Default Audio</h2><p>Choose the language preselected when opening a title.</p></div><select class="setting-choice" data-setting="defaultLanguage"><option value="sub" ${settings.defaultLanguage === 'sub' ? 'selected' : ''}>Japanese · Sub</option><option value="dub" ${settings.defaultLanguage === 'dub' ? 'selected' : ''}>English · Dub</option></select></article><article class="setting-card"><div><h2>Preferred Playback Source</h2><p>Select the provider used first on the watch page.</p></div><select class="setting-choice" data-setting="preferredSource">${Object.entries(PLAYER_SOURCES).map(([key, source]) => `<option value="${key}" ${settings.preferredSource === key ? 'selected' : ''}>${source.label}</option>`).join('')}</select></article></div>`;
  document.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('change', () => {
    state.settings[control.dataset.setting] = control.type === 'checkbox' ? control.checked : control.value;
    saveSettings(); applySettings(); toast('Settings saved.');
  }));
}

function closeAniListDropdown() {
  const menu = document.getElementById('anilist-dropdown');
  if (menu) menu.hidden = true;
}

function renderAniListDropdown() {
  const menu = document.getElementById('anilist-dropdown');
  const viewer = state.auth.viewer;
  if (!menu || !viewer) return;
  menu.innerHTML = `<div class="anilist-dropdown-user">${viewer.avatar?.large ? `<img src="${escapeAttribute(viewer.avatar.large)}" alt="">` : ''}<span>${escapeHTML(viewer.name)}</span></div><div class="anilist-dropdown-divider"></div><button type="button" data-anilist-menu="list">My List</button><button class="is-danger" type="button" data-anilist-menu="logout">Logout</button>`;
}

function updateAnilistUI() {
  const button = document.getElementById('anilist-auth');
  if (!button) return;
  const viewer = state.auth.viewer;
  if (viewer) {
    button.classList.add('is-connected');
    button.innerHTML = `${viewer.avatar?.large ? `<img src="${escapeAttribute(viewer.avatar.large)}" alt="">` : ''}<span>${escapeHTML(viewer.name)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>`;
    button.title = 'Open AniList menu';
    renderAniListDropdown();
  } else {
    button.classList.remove('is-connected');
    button.innerHTML = `<svg class="login-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg><span class="login-label">Login</span>`;
    button.title = 'Login with AniList';
    closeAniListDropdown();
  }
}

async function toggleAnilistAuth() {
  if (state.auth.token && state.auth.viewer) {
    const menu = document.getElementById('anilist-dropdown');
    if (menu) menu.hidden = !menu.hidden;
    return;
  }
  if (!CONFIG.anilist.clientId) { toast('AniList client ID is missing from key.js.', true); return; }
  const url = new URL(CONFIG.anilist.authorizeUrl);
  url.searchParams.set('client_id', CONFIG.anilist.clientId);
  url.searchParams.set('response_type', 'token');
  location.assign(url.toString());
}

function logoutAniList() {
  state.auth = { token: '', viewer: null };
  localStorage.removeItem('ryuu-anilist-token');
  closeAniListDropdown(); updateAnilistUI(); renderSettings(); toast('AniList disconnected.');
}

const baseSetupEvents = window.setupEvents || setupEvents;
setupEvents = function() {
  baseSetupEvents();
  setupSearchClear();
  setupSearchToggle();
  document.addEventListener('click', event => {
    const action = event.target.closest('[data-anilist-menu]')?.dataset.anilistMenu;
    if (action === 'logout') { logoutAniList(); return; }
    if (action === 'list') {
      closeAniListDropdown();
      const user = state.auth.viewer?.name;
      if (user) window.open(`https://anilist.co/user/${encodeURIComponent(user)}/animelist`, '_blank', 'noopener');
      return;
    }
    if (!event.target.closest('.anilist-menu')) closeAniListDropdown();
  });
}

/* Compact-header search: below the 620px breakpoint the inline bar becomes a toggle
   button. Opening it drops an edge-to-edge search bar under the header and swaps the
   icon to a close (X) glyph; closing it clears any in-progress search. Above 620px the
   bar stays inline and shrinks fluidly with the viewport — no intermediate jump. */
function setMobileSearchOpen(open) {
  const topbarEl = document.querySelector('.topbar');
  const toggle = document.getElementById('search-toggle');
  const input = document.getElementById('global-search');
  if (!topbarEl || !toggle || !input) return;
  topbarEl.classList.toggle('search-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  if (open) {
    input.focus();
  } else {
    input.blur();
    closeSearchDropdown();
  }
}

function setupSearchToggle() {
  const toggle = document.getElementById('search-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    setMobileSearchOpen(!document.querySelector('.topbar')?.classList.contains('search-open'));
  });
  document.addEventListener('click', event => {
    if (event.target.closest('.search-result')) { setMobileSearchOpen(false); return; }
    if (event.target.closest('.search-wrap') || event.target.closest('#search-toggle')) return;
    setMobileSearchOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMobileSearchOpen(false);
  });
}

/* Header search clear (X) button: shows once there's text, clears the field and dropdown. */
function setupSearchClear() {
  const input = document.getElementById('global-search');
  const clearButton = document.getElementById('search-clear');
  if (!input || !clearButton) return;
  const syncClearButton = () => clearButton.hidden = !input.value;
  input.addEventListener('input', syncClearButton);
  clearButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    input.value = '';
    syncClearButton();
    closeSearchDropdown();
    input.focus();
  });
  syncClearButton();
}

/* Header search: with no dedicated Browse page to land on, Enter jumps straight to the
   top AniList match instead of navigating anywhere — the live dropdown (app.js) still
   covers quick title lookups while typing. */
async function searchFromInput(term) {
  const input = document.getElementById('global-search');
  const value = (term ?? input?.value ?? '').trim();
  const dropdown = document.getElementById('search-dropdown');
  if (!value) { closeSearchDropdown(); return; }
  clearTimeout(state.searchTimer);
  dropdown.hidden = false;
  dropdown.innerHTML = '<div class="search-dropdown-loading">Searching…</div>';
  const query = `query Search($search: String) { Page(perPage: 8) { media(type: ANIME, search: $search, isAdult: false) { id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } } } }`;
  try {
    const data = await anilist(query, { search: value });
    const [first] = data.Page.media;
    if (!first) { renderSearchDropdown([]); return; }
    state.cardData.set(first.id, first);
    closeSearchDropdown();
    if (input) input.value = '';
    document.getElementById('search-clear')?.setAttribute('hidden', '');
    openAnime(first.id);
  } catch (error) {
    dropdown.innerHTML = '<div class="search-dropdown-empty">Could not search AniList.</div>';
  }
}

function renderFeatured() {
  const container = document.getElementById('featured-carousel');
  const anime = state.featured[state.featureIndex];
  if (!anime) { container.innerHTML = '<div class="empty-state">No seasonal anime found.</div>'; return; }
  const backdrop = anime.bannerImage || coverOf(anime);
  const romaji = anime.title.romaji || titleOf(anime);
  const english = anime.title.english || anime.title.native || '';
  const stats = `<div class="anime-stats"><span>${anime.episodes || '?'} EPS</span>${anime.averageScore ? `<span>${statIcon('star')} ${anime.averageScore}</span>` : ''}<span>${statIcon('user-round')} ${Number(anime.popularity || 0).toLocaleString()}</span><span>${statIcon('tv')} ${escapeHTML((anime.format || 'ANIME').slice(0, 3))}</span></div>`;
  container.innerHTML = `<div class="feature-shell"><img class="feature-glow" src="${escapeAttribute(backdrop)}" alt=""><article class="feature feature-enter" data-anime-id="${anime.id}" role="button" tabindex="0"><img class="feature-backdrop" src="${escapeAttribute(backdrop)}" alt=""><div class="feature-info"><h2>${escapeHTML(romaji)}</h2><p class="feature-native">${escapeHTML(english)}</p><p class="feature-desc">${escapeHTML(trimText(anime.description, 360) || 'No synopsis available.')}</p>${stats}</div></article></div>`;
}

function sliderControls(prefix, index, total) {
  return `<button class="slider-arrow slider-arrow-prev" type="button" data-slider-step="-1" aria-label="Previous slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button><span class="slide-position" aria-live="polite">${index + 1} of ${total}</span><button class="slider-arrow slider-arrow-next" type="button" data-slider-step="1" aria-label="Next slide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg></button>`;
}

function bindSliderControls(container, onStep) {
  container.querySelectorAll('[data-slider-step]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onStep(Number(button.dataset.sliderStep));
  }));
}

function sliderContent(anime) {
  const backdrop = anime.bannerImage || coverOf(anime);
  const romaji = anime.title.romaji || titleOf(anime);
  const english = anime.title.english || anime.title.native || '';
  const stats = `<div class="anime-stats"><span>${anime.episodes || '?'} EPS</span>${anime.averageScore ? `<span>${statIcon('star')} ${anime.averageScore}</span>` : ''}<span>${statIcon('user-round')} ${Number(anime.popularity || 0).toLocaleString()}</span><span>${statIcon('tv')} ${escapeHTML((anime.format || 'ANIME').slice(0, 3))}</span></div>`;
  return `<img class="feature-glow" src="${escapeAttribute(backdrop)}" alt=""><article class="feature feature-enter" data-anime-id="${anime.id}" role="button" tabindex="0"><img class="feature-backdrop" src="${escapeAttribute(backdrop)}" alt=""><div class="feature-info"><h2>${escapeHTML(romaji)}</h2><p class="feature-native">${escapeHTML(english)}</p><p class="feature-desc">${escapeHTML(trimText(anime.description, 360) || 'No synopsis available.')}</p>${stats}</div></article>`;
}

function renderFeatured() {
  const container = document.getElementById('featured-carousel');
  const anime = state.featured[state.featureIndex];
  if (!anime) { container.innerHTML = '<div class="empty-state">No seasonal anime found.</div>'; return; }
  container.innerHTML = `<div class="feature-shell">${sliderContent(anime)}${sliderControls('featured', state.featureIndex, state.featured.length)}</div>`;
  bindSliderControls(container, cycleFeature);
}

function cycleTopAnime(direction) {
  const list = state.topAnime || [];
  if (!list.length) return;
  state.topAnimeIndex = ((state.topAnimeIndex || 0) + direction + Math.min(list.length, 8)) % Math.min(list.length, 8);
  renderTopAnimeCarousel();
}

function stopTopAnimeAutoplay() {
  if (state.topAnimeTimer) { clearInterval(state.topAnimeTimer); state.topAnimeTimer = null; }
}

function startTopAnimeAutoplay() {
  stopTopAnimeAutoplay();
  if (!state.settings.reducedMotion && (state.topAnime || []).length > 1) state.topAnimeTimer = setInterval(() => cycleTopAnime(1), 5200);
}

function renderTopAnimeCarousel() {
  const container = document.getElementById('top-anime-carousel');
  const slides = (state.topAnime || []).slice(0, 8);
  if (!slides.length) { container.innerHTML = '<div class="empty-state">No top anime found.</div>'; return; }
  state.topAnimeIndex = Math.min(state.topAnimeIndex || 0, slides.length - 1);
  container.innerHTML = `<div class="feature-shell">${sliderContent(slides[state.topAnimeIndex])}${sliderControls('top-anime', state.topAnimeIndex, slides.length)}</div>`;
  bindSliderControls(container, cycleTopAnime);
}

function renderTopAnime() {
  renderTopAnimeCarousel();
  renderAnimeGrid('popular-grid', state.topAnime || []);
  const loader = document.getElementById('top-anime-load-sentinel');
  loader.hidden = !state.topAnimeLoading;
}

function setupTopAnimeLazyLoad() {
  state.topAnimeObserver?.disconnect();
  const sentinel = document.getElementById('top-anime-load-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;
  state.topAnimeObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMoreTopAnime();
  }, { rootMargin: '480px 0px' });
  state.topAnimeObserver.observe(sentinel);
}

async function loadMoreTopAnime() {
  if (state.topAnimeLoading || !state.topAnimeHasNext) return;
  state.topAnimeLoading = true;
  document.getElementById('top-anime-load-sentinel').hidden = false;
  document.getElementById('popular-grid').insertAdjacentHTML('beforeend', gridSkeletonMarkup(24));
  const query = `query TopAnime($page: Int) { Page(page: $page, perPage: 24) { pageInfo { hasNextPage } media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } } } }`;
  try {
    const data = await anilist(query, { page: state.topAnimePage });
    state.topAnime.push(...data.Page.media);
    state.topAnimePage += 1;
    state.topAnimeHasNext = data.Page.pageInfo.hasNextPage;
    renderTopAnime();
  } catch (error) {
    toast(`Could not load more top anime: ${error.message}`, true);
  } finally {
    state.topAnimeLoading = false;
    document.getElementById('top-anime-load-sentinel').hidden = true;
  }
}

async function loadHome() {
  const current = currentAniListSeason();
  document.getElementById('featured-carousel').innerHTML = sliderSkeletonMarkup();
  document.getElementById('top-airing-grid').innerHTML = gridSkeletonMarkup(50);
  document.getElementById('top-anime-carousel').innerHTML = sliderSkeletonMarkup();
  document.getElementById('popular-grid').innerHTML = gridSkeletonMarkup(24);
  document.getElementById('airing-list').innerHTML = '';
  const query = `query Home($year: Int) { seasonal: Page(perPage: 8) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, season: ${current.season}, seasonYear: $year, isAdult: false) { ...AnimeCard } } airing: Page(perPage: 50) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, isAdult: false) { ...AnimeCard } } popular: Page(page: 1, perPage: 24) { pageInfo { hasNextPage } media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...AnimeCard } } } fragment AnimeCard on Media { id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } }`;
  try {
    const data = await anilist(query, { year: current.year });
    state.featured = [...data.seasonal.media, ...data.airing.media.filter(anime => !data.seasonal.media.some(seasonal => seasonal.id === anime.id))].slice(0, 8);
    state.featureIndex = 0;
    state.topAnime = data.popular.media;
    state.topAnimeIndex = 0;
    state.topAnimePage = 2;
    state.topAnimeHasNext = data.popular.pageInfo.hasNextPage;
    state.topAnimeLoading = false;
    renderFeatured();
    renderAnimeGrid('top-airing-grid', data.airing.media);
    renderTopAnime();
    renderAiring(data.airing.media.slice(0, 5));
    setupTopAnimeLazyLoad();
    startFeatureAutoplay();
    startTopAnimeAutoplay();
  } catch (error) {
    showNetworkError(['featured-carousel', 'top-airing-grid', 'popular-grid', 'airing-list'], error);
  }
}
