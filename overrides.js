/* Mapper-backed episode metadata and the dedicated Ryuu watch page. */
PLAYER_SOURCES.megaplayAni.label = 'MegaPlay · AL';
PLAYER_SOURCES.anixoAni.label = 'AnixO · AL';
PLAYER_SOURCES.megavidAni.label = 'MegaVid · AL';

const baseAniListRequest = anilist;
anilist = (query, variables) => {
  if (!query.includes('mediaListEntry')) {
    query = query.replace(/nextAiringEpisode \{ episode airingAt \}/g, 'nextAiringEpisode { episode airingAt } mediaListEntry { status }');
  }
  return baseAniListRequest(query, variables);
};

document.addEventListener('click', event => {
  const popup = event.target.closest('.anime-hover-card');
  if (!popup || event.target.closest('.hover-actions')) return;
  const animeId = Number(popup.dataset.anchorId);
  if (animeId) openAnime(animeId);
});

const HOVER_ANILIST_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#02a9ff" d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96l-1.69-5.014-1.541 5.015h3.23z"/></svg>';
const HOVER_YOUTUBE_ICON = '<svg viewBox="0 0 256 180" aria-hidden="true"><path fill="red" d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134"/><path fill="#fff" d="m102.421 128.06l66.328-38.418l-66.328-38.418z"/></svg>';
const HOVER_CHEVRON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>';
const HOVER_ANILIST_STATUSES = [['PLANNING', 'Planning'], ['CURRENT', 'Current'], ['PAUSED', 'Paused'], ['COMPLETED', 'Completed'], ['DROPPED', 'Dropped'], ['REPEATING', 'Repeating']];

async function saveHoverAniListStatus(status) {
  if (!state.auth.token) { toast('Connect AniList to update your list.', true); return; }
  const popup = document.getElementById('anime-hover-card');
  const animeId = Number(popup?.dataset.anchorId);
  if (!animeId) return;
  try {
    await anilist('mutation SaveStatus($mediaId: Int, $status: MediaListStatus) { SaveMediaListEntry(mediaId: $mediaId, status: $status) { id status progress repeat } }', { mediaId: animeId, status });
    const anime = state.cardData.get(animeId);
    if (anime) anime.mediaListEntry = { ...(anime.mediaListEntry || {}), status };
    popup?.querySelector('.hover-anilist-label').replaceChildren(document.createTextNode(status[0] + status.slice(1).toLowerCase()));
    popup?.querySelector('.hover-status-menu')?.setAttribute('hidden', '');
    toast('AniList updated.');
  } catch (error) { toast(`Could not update AniList: ${error.message}`, true); }
}

function enhanceHoverActions(popup) {
  const oldButton = popup.querySelector('.hover-open');
  if (!oldButton || popup.querySelector('.hover-actions')) return;
  const anime = state.cardData.get(Number(popup.dataset.anchorId));
  const currentStatus = anime?.mediaListEntry?.status || '';
  const statusLabel = currentStatus ? currentStatus[0] + currentStatus.slice(1).toLowerCase() : 'Add to AniList';
  const trailer = anime?.trailer?.site === 'youtube' ? `https://www.youtube.com/watch?v=${encodeURIComponent(anime.trailer.id)}` : '';
  oldButton.outerHTML = `<div class="hover-actions"><div class="hover-anilist-wrap"><button class="hover-action-button hover-anilist" type="button">${HOVER_ANILIST_ICON}<span class="hover-anilist-label">${statusLabel}</span><span class="hover-action-chevron">${HOVER_CHEVRON_UP}</span></button><div class="hover-status-menu" hidden>${HOVER_ANILIST_STATUSES.map(([value, label]) => `<button type="button" data-hover-status="${value}">${label}</button>`).join('')}</div></div>${trailer ? `<button class="hover-action-button hover-trailer" type="button"><span>Trailer</span>${HOVER_YOUTUBE_ICON}</button>` : ''}</div>`;
  popup.querySelector('.hover-trailer')?.addEventListener('click', event => { event.stopPropagation(); window.open(trailer, '_blank', 'noopener'); });
}

const hoverPopupObserver = new MutationObserver(() => {
  const popup = document.getElementById('anime-hover-card');
  if (popup) enhanceHoverActions(popup);
});
hoverPopupObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener('click', event => {
  const anilistButton = event.target.closest('.hover-anilist');
  if (anilistButton) { event.stopPropagation(); const menu = anilistButton.parentElement.querySelector('.hover-status-menu'); menu.hidden = !menu.hidden; return; }
  const statusButton = event.target.closest('[data-hover-status]');
  if (statusButton) { event.stopPropagation(); saveHoverAniListStatus(statusButton.dataset.hoverStatus); }
});

document.addEventListener('mouseover', event => {
  const popup = event.target.closest('.anime-hover-card');
  const card = event.target.closest('.anime-card');
  if (!popup && !card) return;
  const anime = state.cardData.get(Number((popup || card).dataset.anchorId || (popup || card).dataset.animeId));
  if (!popup) return;
  popup.style.setProperty('--anime-accent', anime?.coverImage?.color || '#ffffff');
});

function routeHash(route) {
  if (route === 'detail' && state.currentAnime?.id) return `#detail/${state.currentAnime.id}`;
  if (route === 'watch' && state.currentAnime?.id) return `#watch/${state.currentAnime.id}/${state.currentEpisode}`;
  return `#${route}`;
}

function syncRouteUrl(route) {
  const hash = routeHash(route);
  if (location.hash !== hash) history.pushState(null, '', hash);
}

function openUrlRoute() {
  if (!location.hash) { syncRouteUrl('home'); return; }
  const match = location.hash.match(/^#(home|anilist|settings|detail(?:\/(\d+))?|watch(?:\/(\d+)(?:\/(\d+))?)?)$/);
  if (!match) return;
  const route = match[1].split('/')[0];
  if (route === 'detail' || route === 'watch') {
    const animeId = Number(match[2] || match[3]);
    if (!animeId) return;
    openAnime(animeId).then(() => {
      if (route === 'watch') openWatchPage(Number(match[4]) || 1);
    });
    return;
  }
  showRoute(route);
}

window.addEventListener('hashchange', openUrlRoute);
window.addEventListener('popstate', openUrlRoute);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash.includes('access_token=')) openUrlRoute();
});

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
  state.currentAnime = null;
  showRoute('detail');
  document.getElementById('detail-content').innerHTML = detailSkeletonMarkup();
  const query = `query Detail($id: Int) { Media(id: $id, type: ANIME) { id idMal title { romaji english native userPreferred } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes duration format status season seasonYear averageScore popularity genres source countryOfOrigin synonyms startDate { year month day } endDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } airingSchedule(notYetAired: false, perPage: 50) { nodes { episode airingAt } } streamingEpisodes { title thumbnail url site } mediaListEntry { id status progress repeat score(format: POINT_10) } studios(isMain: true) { nodes { name } } relations { edges { relationType(version: 2) node { id type format status episodes seasonYear title { userPreferred } coverImage { medium } } } } } }`;
  try {
    state.currentAnime = (await anilist(query, { id })).Media;
    state.currentEpisode = 1;
    state.language = state.settings.defaultLanguage;
    state.source = state.settings.preferredSource;
    state.currentAnime.episodeEntries = await episodeEntries(state.currentAnime);
    syncRouteUrl('detail');
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

function bindDetailAniListProgress() {
  const progressBox = document.querySelector('.anilist-progress');
  if (!progressBox || !state.currentAnime) return;
  const anime = state.currentAnime;
  const progress = Number(anime.mediaListEntry?.progress) || 0;
  const total = Number(anime.episodes) || '?';
  const status = anime.mediaListEntry?.status || '';
  const statusLabel = status ? status[0] + status.slice(1).toLowerCase() : 'Add to AniList';
  progressBox.innerHTML = `<div class="detail-anilist-status"><button class="hover-action-button hover-anilist detail-anilist-button" type="button">${HOVER_ANILIST_ICON}<span class="hover-anilist-label">${statusLabel}</span><span class="hover-action-chevron">${HOVER_CHEVRON_UP}</span></button><div class="hover-status-menu" hidden>${HOVER_ANILIST_STATUSES.map(([value, label]) => `<button type="button" data-detail-status="${value}">${label}</button>`).join('')}</div></div><div class="detail-progress-controls"><button type="button" class="detail-progress-step" data-progress-step="-1" aria-label="Decrease watched episodes">−</button><strong><input class="detail-progress-value" type="text" inputmode="numeric" pattern="[0-9]*" value="${progress}" aria-label="Watched episodes"> / ${total}</strong><button type="button" class="detail-progress-step" data-progress-step="1" aria-label="Increase watched episodes">+</button></div>`;
  progressBox.querySelector('.detail-anilist-button').addEventListener('click', event => { event.stopPropagation(); const menu = progressBox.querySelector('.hover-status-menu'); menu.hidden = !menu.hidden; });
  progressBox.querySelectorAll('[data-detail-status]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); saveDetailAniListStatus(button.dataset.detailStatus); }));
  const progressInput = progressBox.querySelector('.detail-progress-value');
  progressInput.addEventListener('input', () => { progressInput.value = progressInput.value.replace(/\D/g, ''); });
  progressInput.addEventListener('click', event => event.stopPropagation());
  progressInput.addEventListener('blur', () => saveDetailAniListProgress(Number(progressInput.value || 0)));
  progressInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); progressInput.blur(); } });
  progressBox.querySelectorAll('[data-progress-step]').forEach(button => button.addEventListener('click', () => saveDetailAniListProgress(progress + Number(button.dataset.progressStep))));
}

async function saveDetailAniListStatus(status) {
  try {
    const data = await anilist('mutation SaveStatus($mediaId: Int, $status: MediaListStatus) { SaveMediaListEntry(mediaId: $mediaId, status: $status) { id status progress repeat } }', { mediaId: state.currentAnime.id, status });
    state.currentAnime.mediaListEntry = data.SaveMediaListEntry;
    renderDetail();
    toast('AniList updated.');
  } catch (error) { toast(`Could not update AniList: ${error.message}`, true); }
}

async function saveDetailAniListProgress(progress) {
  const total = Number(state.currentAnime.episodes);
  const numericProgress = Number.isFinite(progress) ? Math.floor(progress) : 0;
  const nextProgress = Math.max(0, total ? Math.min(numericProgress, total) : numericProgress);
  const currentEntry = state.currentAnime.mediaListEntry || {};
  const restartingCompleted = currentEntry.status === 'COMPLETED' && nextProgress > 0 && nextProgress < total;
  const continuingRepeat = currentEntry.status === 'REPEATING' && nextProgress > 0;
  const nextStatus = total && nextProgress >= total ? 'COMPLETED' : restartingCompleted ? 'REPEATING' : continuingRepeat ? 'REPEATING' : nextProgress > 0 ? 'CURRENT' : currentEntry.status || 'PLANNING';
  const nextRepeat = restartingCompleted ? (Number(currentEntry.repeat) || 0) + 1 : Number(currentEntry.repeat) || 0;
  try {
    const data = await anilist('mutation SaveProgress($mediaId: Int, $progress: Int, $status: MediaListStatus, $repeat: Int) { SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status, repeat: $repeat) { id status progress repeat } }', { mediaId: state.currentAnime.id, progress: nextProgress, status: nextStatus, repeat: nextRepeat });
    state.currentAnime.mediaListEntry = data.SaveMediaListEntry;
    renderDetail();
    toast(`AniList updated to episode ${nextProgress}.`);
  } catch (error) { toast(`Could not update AniList: ${error.message}`, true); }
}

function renderDetail() {
  const anime = state.currentAnime, title = titleOf(anime), total = Number(anime.episodes) || '?', entries = anime.episodeEntries || [];
  const year = anime.startDate?.year || anime.seasonYear || '—', banner = anime.bannerImage || coverOf(anime), studios = (anime.studios?.nodes || []).map(studio => studio.name).join(', ');
  const progress = anime.mediaListEntry?.progress || 0, description = cleanDescription(anime.description) || 'No synopsis is available for this title.';
  document.getElementById('detail-content').innerHTML = `<div class="detail-hero"><img class="detail-banner-glow" src="${escapeAttribute(banner)}" alt=""><div class="detail-banner">${anime.bannerImage ? `<img src="${escapeAttribute(anime.bannerImage)}" alt="">` : ''}</div></div><div class="detail-layout"><img class="detail-poster" src="${escapeAttribute(coverOf(anime))}" alt="${escapeAttribute(title)}"><div class="detail-body"><p class="detail-romaji">${escapeHTML(anime.title.romaji || title)}</p><h1>${escapeHTML(anime.title.english || title)}</h1><p class="detail-subtitle">${escapeHTML(anime.title.native || '')}</p><div class="metadata"><span>${escapeHTML(anime.format || 'ANIME')}</span><span>${total} episodes</span>${anime.duration ? `<span>${anime.duration} min</span>` : ''}<span>${escapeHTML(anime.status || 'UNKNOWN')}</span><span>${year}</span>${anime.averageScore ? `<span>★ ${anime.averageScore}/100</span>` : ''}<span>${Number(anime.popularity || 0).toLocaleString()} users</span></div>${state.auth.viewer ? `<div class="anilist-progress"><span>AniList progress</span><strong>${progress} / ${total}</strong></div>` : ''}${studios ? `<p class="detail-fact"><b>Studio</b> ${escapeHTML(studios)}</p>` : ''}${anime.source ? `<p class="detail-fact"><b>Source</b> ${escapeHTML(anime.source.replace(/_/g, ' '))}${anime.countryOfOrigin ? ` · ${escapeHTML(anime.countryOfOrigin)}` : ''}</p>` : ''}<div class="genre-list">${(anime.genres || []).map(genre => `<span class="genre">${escapeHTML(genre)}</span>`).join('')}</div><div class="description">${escapeHTML(description)}</div><div class="external-links"><a href="https://anilist.co/anime/${anime.id}" target="_blank" rel="noreferrer">AniList ↗</a>${anime.idMal ? `<a href="https://myanimelist.net/anime/${anime.idMal}" target="_blank" rel="noreferrer">MyAnimeList ↗</a>` : ''}${anime.trailer?.site === 'youtube' ? `<a href="https://www.youtube.com/watch?v=${anime.trailer.id}" target="_blank" rel="noreferrer">Trailer ↗</a>` : ''}</div></div></div><section class="episode-list-section"><div class="episode-list-header"><div><h2>Episodes</h2><p>${entries.length ? `${entries.length} released episode${entries.length === 1 ? '' : 's'} available to watch.` : 'No episodes are available yet.'}</p></div><button id="watch-first" class="button button-primary" type="button" ${entries.length ? '' : 'disabled'}>Watch now <span>→</span></button></div>${renderEpisodeToolbar(entries)}<div class="episode-list">${entries.map(entry => titleEpisodeRow(entry, progress)).join('') || '<div class="empty-state">AniList has not released an episode for this title yet.</div>'}</div><p class="episode-filter-empty" hidden>No episodes match your filter.</p></section>${relationsMarkup(anime)}`;
  bindDetailAniListProgress();
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
  syncRouteUrl('watch');
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
    const currentEntry = state.currentAnime.mediaListEntry || {};
    const total = Number(state.currentAnime.episodes);
    const restartingCompleted = currentEntry.status === 'COMPLETED' && episode > 0 && episode < total;
    const continuingRepeat = currentEntry.status === 'REPEATING' && episode > 0;
    const status = total && episode >= total ? 'COMPLETED' : restartingCompleted ? 'REPEATING' : continuingRepeat ? 'REPEATING' : episode > 0 ? 'CURRENT' : currentEntry.status || 'PLANNING';
    const repeat = restartingCompleted ? (Number(currentEntry.repeat) || 0) + 1 : Number(currentEntry.repeat) || 0;
    const data = await anilist(`mutation SaveProgress($mediaId: Int, $progress: Int, $status: MediaListStatus, $repeat: Int) { SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status, repeat: $repeat) { id progress status repeat } }`, { mediaId: state.currentAnime.id, progress: episode, status, repeat });
    state.currentAnime.mediaListEntry = data.SaveMediaListEntry;
    toast(`AniList updated to episode ${episode}.`);
    renderWatchPage();
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'Mark watched'; }
    toast(`Could not update AniList: ${error.message}`, true);
  }
}

function showRoute(route) {
  if (state.route === 'watch' && route !== 'watch') {
    document.getElementById('watch-content')?.replaceChildren();
  }
  hideHoverCard();
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('is-active', view.id === `${route}-view`));
  state.route = route;
  if (route !== 'detail' && route !== 'watch' || state.currentAnime?.id) syncRouteUrl(route);
  if (route === 'anilist') initAnilistBrowse();
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
  if (state.settings.reducedMotion) { stopFeatureAutoplay(); stopTopAnimeAutoplay(); stopTopAiringAutoplay(); }
  else { if (state.featured.length) startFeatureAutoplay(); if ((state.topAnime || []).length) startTopAnimeAutoplay(); if ((state.topAiring || []).length) startTopAiringAutoplay(); }
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
  menu.innerHTML = `<div class="anilist-dropdown-user">${viewer.avatar?.large ? `<img src="${escapeAttribute(viewer.avatar.large)}" alt="">` : ''}<span>${escapeHTML(viewer.name)}</span></div><div class="anilist-dropdown-divider"></div><button type="button" data-anilist-menu="list"><span>Anilist</span><svg class="external-link-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></button><button class="is-danger" type="button" data-anilist-menu="logout"><span>Logout</span><svg class="log-out-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg></button>`;
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
    button.innerHTML = `<span class="login-label">Login</span><svg class="login-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>`;
    button.title = 'Login with AniList';
    closeAniListDropdown();
  }
  updateAnilistBrowseAuthUI();
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

function renderTopAiringCarousel() {
  const container = document.getElementById('top-airing-carousel');
  const slides = (state.topAiring || []).slice(0, 8);
  if (!container || !slides.length) return;
  state.topAiringIndex = Math.min(state.topAiringIndex || 0, slides.length - 1);
  container.innerHTML = `<div class="feature-shell">${sliderContent(slides[state.topAiringIndex])}${sliderControls('top-airing', state.topAiringIndex, slides.length)}</div>`;
  bindSliderControls(container, direction => {
    state.topAiringIndex = ((state.topAiringIndex || 0) + direction + slides.length) % slides.length;
    renderTopAiringCarousel();
  });
}

function stopTopAiringAutoplay() {
  if (state.topAiringTimer) { clearInterval(state.topAiringTimer); state.topAiringTimer = null; }
}

function startTopAiringAutoplay() {
  stopTopAiringAutoplay();
  if (!state.settings.reducedMotion && (state.topAiring || []).length > 1) state.topAiringTimer = setInterval(() => {
    const slides = state.topAiring.slice(0, 8);
    state.topAiringIndex = ((state.topAiringIndex || 0) + 1) % slides.length;
    renderTopAiringCarousel();
  }, 5200);
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
  document.getElementById('top-airing-carousel').innerHTML = sliderSkeletonMarkup();
  document.getElementById('top-airing-grid').innerHTML = gridSkeletonMarkup(50);
  document.getElementById('top-anime-carousel').innerHTML = sliderSkeletonMarkup();
  document.getElementById('popular-grid').innerHTML = gridSkeletonMarkup(24);
  document.getElementById('airing-list').innerHTML = '';
  const query = `query Home($year: Int) { seasonal: Page(perPage: 8) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, season: ${current.season}, seasonYear: $year, isAdult: false) { ...AnimeCard } } airing: Page(perPage: 50) { media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING, isAdult: false) { ...AnimeCard } } popular: Page(page: 1, perPage: 24) { pageInfo { hasNextPage } media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ...AnimeCard } } } fragment AnimeCard on Media { id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } }`;
  try {
    const data = await anilist(query, { year: current.year });
    state.featured = [...data.seasonal.media, ...data.airing.media.filter(anime => !data.seasonal.media.some(seasonal => seasonal.id === anime.id))].slice(0, 8);
    state.topAiring = data.airing.media;
    state.topAiringIndex = 0;
    state.featureIndex = 0;
    state.topAnime = data.popular.media;
    state.topAnimeIndex = 0;
    state.topAnimePage = 2;
    state.topAnimeHasNext = data.popular.pageInfo.hasNextPage;
    state.topAnimeLoading = false;
    renderTopAiringCarousel();
    startTopAiringAutoplay();
    renderAnimeGrid('top-airing-grid', data.airing.media);
    renderTopAnime();
    renderAiring(data.airing.media.slice(0, 5));
    setupTopAnimeLazyLoad();
    startFeatureAutoplay();
    startTopAnimeAutoplay();
  } catch (error) {
    showNetworkError(['featured-carousel', 'top-airing-carousel', 'top-airing-grid', 'popular-grid', 'airing-list'], error);
  }
}

const ANILIST_BROWSE_FRAGMENT = `id idMal title { romaji english native } coverImage { extraLarge large medium color } bannerImage description(asHtml: false) episodes format status season seasonYear averageScore popularity genres startDate { year month day } trailer { id site thumbnail } nextAiringEpisode { episode airingAt } mediaListEntry { status }`;

const AF_ICON_PATHS = {
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  tv: '<rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  sort: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h4"/><path d="M11 8h7"/><path d="M11 12h10"/>',
  calendarRange: '<path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>'
};

const AF_CURRENT_YEAR = new Date().getFullYear();

const BROWSE_FILTERS = [
  { key: 'genre', icon: 'mountain', label: 'GENRE', options: ['Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'].map(v => ({ value: v, label: v })) },
  { key: 'format', icon: 'tv', label: 'FORMAT', options: [['TV', 'TV'], ['TV_SHORT', 'TV Short'], ['MOVIE', 'Movie'], ['SPECIAL', 'Special'], ['OVA', 'OVA'], ['ONA', 'ONA'], ['MUSIC', 'Music']].map(([value, label]) => ({ value, label })) },
  { key: 'season', icon: 'leaf', label: 'SEASON', options: [['WINTER', 'Winter'], ['SPRING', 'Spring'], ['SUMMER', 'Summer'], ['FALL', 'Fall']].map(([value, label]) => ({ value, label })) },
  { key: 'year', icon: 'calendarRange', label: 'YEAR', options: Array.from({ length: AF_CURRENT_YEAR + 2 - 1972 + 1 }, (_, i) => String(AF_CURRENT_YEAR + 2 - i)).map(v => ({ value: v, label: v })) },
  { key: 'status', icon: 'radio', label: 'STATUS', options: [['RELEASING', 'Releasing'], ['NOT_YET_RELEASED', 'Not Yet Released'], ['FINISHED', 'Finished'], ['HIATUS', 'Hiatus'], ['CANCELLED', 'Cancelled']].map(([value, label]) => ({ value, label })) },
  { key: 'sort', icon: 'sort', label: 'SORT', options: [['POPULARITY_DESC', 'Popularity'], ['SCORE_DESC', 'Score'], ['TRENDING_DESC', 'Trending'], ['START_DATE_DESC', 'Newest'], ['TITLE_ROMAJI', 'Title A-Z']].map(([value, label]) => ({ value, label })) }
];

const WATCH_STATUS_FILTER = { key: 'watchStatus', icon: null, label: 'WATCH STATUS', options: [['PLANNING', 'Planning'], ['CURRENT', 'Watching'], ['COMPLETED', 'Completed'], ['DROPPED', 'Dropped'], ['PAUSED', 'Paused']].map(([value, label]) => ({ value, label })) };

function afFieldMarkup(def) {
  const optionsHTML = def.options.map(o => `<button type="button" class="af-option" data-value="${escapeAttribute(o.value)}">${escapeHTML(o.label)}</button>`).join('');
  const iconHTML = def.icon ? `<svg class="af-icon" viewBox="0 0 24 24" aria-hidden="true">${AF_ICON_PATHS[def.icon]}</svg>` : '';
  return `<div class="af-field" data-filter="${def.key}"><button type="button" class="af-trigger" aria-haspopup="true" aria-expanded="false">${iconHTML}<span class="af-label">${escapeHTML(def.label)}</span><svg class="af-chevron" viewBox="0 0 24 24" aria-hidden="true">${AF_ICON_PATHS.chevron}</svg></button><div class="af-menu" hidden role="listbox">${optionsHTML}<div class="af-menu-divider"></div><button type="button" class="af-option af-option-any" data-value="">Any</button></div></div>`;
}

function initAnilistBrowse() {
  if (state.browse) return;
  state.browse = { search: '', genre: '', format: '', season: '', year: '', status: '', sort: '', watchStatus: '', page: 1, hasNext: true, loading: false, items: [], searchTimer: null, requestId: 0 };
  document.getElementById('anilist-browse-filters').innerHTML = BROWSE_FILTERS.map(afFieldMarkup).join('') + afFieldMarkup(WATCH_STATUS_FILTER);

  const searchInput = document.getElementById('anilist-browse-search');
  searchInput.addEventListener('input', () => {
    clearTimeout(state.browse.searchTimer);
    state.browse.searchTimer = setTimeout(() => {
      state.browse.search = searchInput.value.trim();
      runAnilistBrowse(true);
    }, 380);
  });

  const filtersRoot = document.getElementById('anilist-browse-filters');
  filtersRoot.addEventListener('click', event => {
    const trigger = event.target.closest('.af-trigger');
    if (trigger) { toggleAnilistFilterMenu(trigger.closest('.af-field')); return; }
    const option = event.target.closest('.af-option');
    if (option) selectAnilistFilterOption(option.closest('.af-field'), option.dataset.value, option.textContent);
  });
  document.addEventListener('click', event => { if (!event.target.closest('.af-field')) closeAnilistFilterMenus(); });

  document.getElementById('anilist-filter-clear').addEventListener('click', () => {
    Object.assign(state.browse, { search: '', genre: '', format: '', season: '', year: '', status: '', sort: '', watchStatus: '' });
    searchInput.value = '';
    filtersRoot.querySelectorAll('.af-field').forEach(field => {
      field.classList.remove('has-value');
      const def = field.dataset.filter === 'watchStatus' ? WATCH_STATUS_FILTER : BROWSE_FILTERS.find(f => f.key === field.dataset.filter);
      field.querySelector('.af-label').textContent = def.label;
    });
    runAnilistBrowse(true);
  });

  setupAnilistBrowseLazyLoad();
  updateAnilistBrowseAuthUI();
  runAnilistBrowse(true);
}

function closeAnilistFilterMenus(except) {
  document.querySelectorAll('.af-field.is-open').forEach(field => {
    if (field === except) return;
    field.classList.remove('is-open');
    field.querySelector('.af-menu').hidden = true;
    field.querySelector('.af-trigger').setAttribute('aria-expanded', 'false');
  });
}

function toggleAnilistFilterMenu(field) {
  const isOpen = field.classList.contains('is-open');
  closeAnilistFilterMenus();
  if (isOpen) return;
  field.classList.add('is-open');
  field.querySelector('.af-menu').hidden = false;
  field.querySelector('.af-trigger').setAttribute('aria-expanded', 'true');
}

function selectAnilistFilterOption(field, value, labelText) {
  const key = field.dataset.filter;
  const def = key === 'watchStatus' ? WATCH_STATUS_FILTER : BROWSE_FILTERS.find(f => f.key === key);
  state.browse[key] = value;
  field.querySelector('.af-label').textContent = value ? labelText.trim() : def.label;
  field.classList.toggle('has-value', Boolean(value));
  closeAnilistFilterMenus();
  runAnilistBrowse(true);
}

function updateAnilistBrowseAuthUI() {
  const field = document.querySelector('.af-field[data-filter="watchStatus"]');
  if (!field) return;
  const loggedIn = Boolean(state.auth.viewer);
  field.hidden = !loggedIn;
  if (!loggedIn && state.browse) {
    state.browse.watchStatus = '';
    field.classList.remove('has-value');
    field.querySelector('.af-label').textContent = WATCH_STATUS_FILTER.label;
  }
}

function setupAnilistBrowseLazyLoad() {
  state.browseObserver?.disconnect();
  const sentinel = document.getElementById('anilist-load-sentinel');
  if (!sentinel || !('IntersectionObserver' in window)) return;
  state.browseObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) runAnilistBrowse(false);
  }, { rootMargin: '480px 0px' });
  state.browseObserver.observe(sentinel);
}

async function runAnilistBrowse(reset = false) {
  const b = state.browse;
  if (!b) return;
  if (reset) {
    b.page = 1;
    b.hasNext = true;
    b.items = [];
    b.requestId += 1;
    document.getElementById('anilist-grid').innerHTML = gridSkeletonMarkup(24);
    document.getElementById('anilist-empty').hidden = true;
  }
  if (b.loading || !b.hasNext) return;
  const requestId = b.requestId;
  b.loading = true;
  const sentinel = document.getElementById('anilist-load-sentinel');
  sentinel.hidden = false;
  if (!reset) document.getElementById('anilist-grid').insertAdjacentHTML('beforeend', gridSkeletonMarkup(12));
  try {
    let media, hasNext;
    if (b.watchStatus) {
      // Mirrors Zenshin's searchAnilist(): a watch-status filter switches to
      // MediaListCollection instead of Page(media), and only returns page 1.
      if (b.page > 1) {
        media = [];
        hasNext = false;
      } else {
        const data = await anilist(`query MyAnilistList($userId: Int, $status: MediaListStatus) { MediaListCollection(userId: $userId, type: ANIME, status: $status, forceSingleCompletedList: true) { lists { entries { media { ${ANILIST_BROWSE_FRAGMENT} } } } } }`, { userId: state.auth.viewer?.id, status: b.watchStatus });
        media = (data.MediaListCollection.lists || []).flatMap(list => list.entries.map(entry => entry.media));
        hasNext = false;
      }
    } else {
      const variables = { page: b.page, perPage: 24, sort: [b.sort || 'POPULARITY_DESC'] };
      const mediaArguments = ['type: ANIME', 'sort: $sort', 'isAdult: false'];
      const optionalFilters = [
        ['search', 'String', b.search],
        ['genre', 'String', b.genre],
        ['format', 'MediaFormat', b.format],
        ['season', 'MediaSeason', b.season],
        ['seasonYear', 'Int', b.year ? Number(b.year) : 0],
        ['status', 'MediaStatus', b.status]
      ];
      optionalFilters.forEach(([key, type, value]) => {
        if (!value) return;
        variables[key] = value;
        mediaArguments.push(`${key}: $${key}`);
      });
      const variableDefinitions = ['$page: Int', '$perPage: Int', '$sort: [MediaSort]', ...optionalFilters.filter(([, , value]) => value).map(([key, type]) => `$${key}: ${type}`)].join(', ');
      const data = await anilist(`query BrowseAnilist(${variableDefinitions}) { Page(page: $page, perPage: $perPage) { pageInfo { hasNextPage } media(${mediaArguments.join(', ')}) { ${ANILIST_BROWSE_FRAGMENT} } } }`, variables);
      media = data.Page.media;
      hasNext = data.Page.pageInfo.hasNextPage;
    }
    if (requestId !== b.requestId) return;
    b.items.push(...media);
    b.page += 1;
    b.hasNext = hasNext;
    renderAnilistBrowseGrid(b.items);
    const emptyState = document.getElementById('anilist-empty');
    emptyState.hidden = b.items.length !== 0;
  } catch (error) {
    if (requestId !== b.requestId) return;
    document.getElementById('anilist-grid').innerHTML = `<div class="empty-state">Could not load AniList results. ${escapeHTML(error.message)}</div>`;
    b.hasNext = false;
  } finally {
    if (requestId === b.requestId) {
      b.loading = false;
      sentinel.hidden = true;
    }
  }
}

function renderAnilistBrowseGrid(list) {
  const grid = document.getElementById('anilist-grid');
  if (!list.length) { grid.innerHTML = ''; return; }
  renderAnimeGrid('anilist-grid', list);
}
