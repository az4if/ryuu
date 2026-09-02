// ============================================================
//  RYUU · SITE PICKS CONFIGURATION
// ============================================================
//  Edit the IDs below to change what appears in the Site Picks
//  slideshow on the home page.
//
//  primaryIds  — up to 8 AniList media IDs shown in the slideshow.
//                If AniList returns no data for an ID it is silently
//                skipped; fallbackIds fill the gap (up to 5 used).
//
//  fallbackIds — 5 reserve IDs drawn from when a primary ID fails.
//
//  Find any anime's AniList ID in its URL:
//    https://anilist.co/anime/[ID]/title-here
//
//  Picks are cached locally for 7 weeks. Changing an ID here
//  will only be reflected after the cache expires, or after the
//  user clears site data. A forced refresh can be triggered by
//  also bumping the cacheVersion number below.
// ============================================================

window.RYUU_SITE_PICKS = {

  // Bump this number to force a cache refresh for all visitors.
  cacheVersion: 1,

  // ── PRIMARY IDS ────────────────────────────────────────────
  // Up to 8 AniList anime IDs. Change freely.
  primaryIds: [
    1535,    // Death Note
    5114,    // Fullmetal Alchemist: Brotherhood
    11061,   // Hunter x Hunter (2011)
    16498,   // Attack on Titan
    21459,   // My Hero Academia
    101922,  // Demon Slayer: Kimetsu no Yaiba
    113415,  // Jujutsu Kaisen
    9253,    // Steins;Gate
  ],

  // ── FALLBACK IDS ───────────────────────────────────────────
  // Used (up to 5) when a primary ID returns no AniList data.
  fallbackIds: [
    21,      // One Piece
    20,      // Naruto
    1,       // Cowboy Bebop
    98478,   // Made in Abyss
    15417,   // Sword Art Online
  ],

};
