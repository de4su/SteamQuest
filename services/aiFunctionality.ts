/**
 * aiFunctionality.ts
 *
 * Core AI service for SteamQuest.  Handles all Groq LLM interactions:
 *   - getGameRecommendations: powers the 4-step quiz, returning up to 10 ranked
 *     game suggestions with match percentages, playtime estimates, Steam prices,
 *     and GG.deals links.
 *   - searchSpecificGame: resolves a free-text query to a single confirmed Steam game.
 *
 * Both functions validate and enrich raw AI output by cross-referencing the Steam
 * Store API (via rotating CORS proxies) to confirm titles and App IDs before
 * results are shown to the user.  Quiz results are cached in Supabase so repeat
 * identical answers never cost an extra API call.
 */
import { QuizAnswers, RecommendationResponse, GameRecommendation } from "../types";
import { supabase } from "./supabaseClient";

/**
 * Produces a deterministic Base64 hash of the quiz answers used as a cache key
 * in the Supabase quiz_results table.  Fields are normalised (sorted genres,
 * trimmed/lowercased keywords) before hashing so semantically identical answers
 * always map to the same cache entry.
 */
function hashAnswers(answers: QuizAnswers): string {
  const normalized = {
    genres: [...answers.preferredGenres].sort().join(','),
    playstyle: answers.playstyle,
    time: answers.timeAvailability,
    keywords: answers.specificKeywords.trim().toLowerCase(),
    difficulty: answers.difficultyPreference,
  };
  return btoa(JSON.stringify(normalized));
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Calls the Groq LLM API and returns the raw content string.
 * Validates that the response is OK, has the expected structure, and contains
 * parseable JSON before returning. Throws with a clear error label on failure.
 */
async function callGroq(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  onRetry?: (attempt: number, maxRetries: number) => void,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithRetry(
      GROQ_API_URL,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(45000),
      },
      3,
      1000,
      onRetry,
    );
  } catch (fetchErr: any) {
    throw new Error("[callGroq] Network error contacting Groq API: " + fetchErr.message);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "(unreadable)");
    throw new Error("[callGroq] Groq API error " + response.status + ": " + errText);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error("[callGroq] Failed to parse Groq API response as JSON.");
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("[callGroq] Groq API returned unexpected response structure (no content).");
  }

  // Validate the content itself is valid JSON before returning
  try {
    JSON.parse(content);
  } catch {
    console.error("[callGroq] Groq content is not valid JSON. Sample:", content.slice(0, 200));
    throw new Error("[callGroq] Groq API returned non-JSON content.");
  }

  return content;
}

const CORS_PROXIES = [
  (url: string) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  (url: string) => "https://corsproxy.io/?" + encodeURIComponent(url),
  (url: string) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url),
  (url: string) => url,
];

const getSteamImageUrl = (steamAppId: string): string =>
  "https://cdn.akamai.steamstatic.com/steam/apps/" + steamAppId + "/header.jpg";

const createGGDealsSlug = (title: string): string =>
  title.toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function isRetryableError(err: any): boolean {
  if (err?.name === 'AbortError') return false;
  return err?.name === 'TypeError' || /failed to fetch|networkerror|cors/i.test(err?.message ?? '');
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelayMs = 1000,
  onRetry?: (attempt: number, maxRetries: number) => void,
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoffMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.info(`[fetchWithRetry] Retry ${attempt}/${maxRetries} after ${backoffMs}ms`);
      await delay(backoffMs);
      onRetry?.(attempt, maxRetries);
    }
    try {
      const response = await fetch(url, options);
      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        console.warn(`[fetchWithRetry] Status ${response.status} on attempt ${attempt + 1}, retrying...`);
        continue;
      }
      return response;
    } catch (err: any) {
      if (attempt === maxRetries || !isRetryableError(err)) throw err;
      console.warn(`[fetchWithRetry] Attempt ${attempt + 1} network error: ${err.message}. Retrying...`);
    }
  }
  throw new Error('Request failed after all retries');
}

const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

const wordOverlap = (a: string, b: string): number => {
  const wa = new Set(a.split(" ").filter(w => w.length > 1));
  const wb = new Set(b.split(" ").filter(w => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) { if (wb.has(w)) shared++; }
  return shared / Math.max(wa.size, wb.size);
};

/**
 * Returns a confidence score in [0,1] for how well two titles match.
 * Used for both acceptance checks and debug logging.
 */
const titleMatchConfidence = (a: string, b: string): number => {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1.0;
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(wordOverlap(na, nb), 0.75);
  }
  return wordOverlap(na, nb);
};

const titlesMatch = (a: string, b: string): boolean => {
  const confidence = titleMatchConfidence(a, b);
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.includes(shorter) && wordOverlap(na, nb) >= 0.75) return true;
  return confidence >= 0.80;
};

/**
 * Searches the Steam store by title and returns the first confirmed matching App ID.
 * Validates that the API returns an items array. Prevents empty search terms.
 * Logs each proxy attempt and validation result.
 */
const searchSteamAppIdByName = async (title: string): Promise<string | null> => {
  if (!title || title.trim().length === 0) {
    console.warn("[searchSteamAppIdByName] Skipping search — empty title.");
    return null;
  }

  const searchUrl = "https://store.steampowered.com/api/storesearch/?term=" + encodeURIComponent(title) + "&l=en&cc=us";
  console.info("[searchSteamAppIdByName] Searching Steam for:", title);

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const proxyUrl = CORS_PROXIES[i](searchUrl);
      console.info("[searchSteamAppIdByName] Attempt " + (i + 1) + "/" + CORS_PROXIES.length + " via proxy index " + i);

      const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        console.warn("[searchSteamAppIdByName] Proxy " + (i + 1) + " returned status " + response.status + ". Trying next.");
        continue;
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        console.warn("[searchSteamAppIdByName] Proxy " + (i + 1) + " returned non-JSON. Trying next.");
        continue;
      }

      // Validate that the API returned an items array
      if (!data || !Array.isArray(data.items)) {
        console.warn("[searchSteamAppIdByName] Proxy " + (i + 1) + " response missing items array. Sample:", JSON.stringify(data).slice(0, 100));
        continue;
      }

      const items: Array<{ id: number; name: string }> = data.items;
      console.info("[searchSteamAppIdByName] Proxy " + (i + 1) + " returned " + items.length + " items.");

      const match = items.find(item => {
        if (!item || typeof item.name !== "string") return false;
        const confidence = titleMatchConfidence(item.name, title);
        console.info("[searchSteamAppIdByName] Checking '" + item.name + "' vs '" + title + "' — confidence: " + confidence.toFixed(2));
        return titlesMatch(item.name, title);
      });

      if (match) {
        console.info("[searchSteamAppIdByName] Confirmed match: '" + match.name + "' (App ID: " + match.id + ")");
        return String(match.id);
      }

      // No confirmed match — do NOT fall back to items[0]
      console.warn("[searchSteamAppIdByName] No confirmed match among " + items.length + " results for '" + title + "'.");
    } catch (err: any) {
      console.warn("[searchSteamAppIdByName] Proxy " + (i + 1) + " threw an error: " + err.message);
      if (i < CORS_PROXIES.length - 1) { await delay(500); continue; }
    }
  }
  console.warn("[searchSteamAppIdByName] All proxies exhausted for '" + title + "'. Returning null.");
  return null;
};

const fetchSteamGameDetails = async (steamAppId: string) => {
  // Validate steamAppId before making the request
  if (!steamAppId || steamAppId.trim().length === 0) {
    console.warn("[fetchSteamGameDetails] Invalid steamAppId (empty). Skipping.");
    return null;
  }

  const steamUrl = "https://store.steampowered.com/api/appdetails?appids=" + steamAppId + "&cc=us";

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const proxyUrl = CORS_PROXIES[i](steamUrl);
      console.info("[fetchSteamGameDetails] Attempt " + (i + 1) + "/" + CORS_PROXIES.length + " for App ID " + steamAppId + " via proxy index " + i);

      const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });

      if (!response.ok) {
        console.warn("[fetchSteamGameDetails] Proxy " + (i + 1) + " failed with status " + response.status);
        continue;
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        console.warn("[fetchSteamGameDetails] Proxy " + (i + 1) + " returned non-JSON for App ID " + steamAppId + ".");
        continue;
      }

      const gameData = data?.[steamAppId]?.data;

      if (!gameData || data[steamAppId]?.success === false) {
        console.warn("[fetchSteamGameDetails] No valid data for Steam App ID: " + steamAppId);
        return null;
      }

      const priceData = gameData.price_overview;
      const steamPrice = priceData ? "$" + (priceData.final / 100).toFixed(2) : "Free";

      return {
        title: typeof gameData.name === "string" ? gameData.name : "Unknown Game",
        description: typeof gameData.short_description === "string"
          ? gameData.short_description
          : (typeof gameData.detailed_description === "string" ? gameData.detailed_description : "No description available"),
        developer: Array.isArray(gameData.developers) && typeof gameData.developers[0] === "string"
          ? gameData.developers[0]
          : "Unknown",
        steamPrice,
      };

    } catch (error: any) {
      console.warn("[fetchSteamGameDetails] Proxy " + (i + 1) + " error for " + steamAppId + ": " + error.message);
      if (i < CORS_PROXIES.length - 1) { await delay(500); continue; }
    }
  }

  console.error("[fetchSteamGameDetails] All proxies failed for Steam App ID: " + steamAppId);
  return null;
};

const fetchGGDealsInfo = async (steamAppId: string, title: string) => {
  const ggDealsApiKey = import.meta.env.VITE_GGDEALS_API_KEY || "";
  const dealUrl = "https://gg.deals/game/" + createGGDealsSlug(title) + "/";

  if (!ggDealsApiKey) return { cheapestPrice: "View Deals", dealUrl };

  try {
    const ggResponse = await fetch(
      "https://api.gg.deals/v1/games?key=" + ggDealsApiKey + "&steamAppId=" + steamAppId,
      { signal: AbortSignal.timeout(5000) }
    );
    const ggData = await ggResponse.json();
    const gameData = ggData?.data?.[0];
    return {
      cheapestPrice: typeof gameData?.price?.amount === "number" ? "$" + gameData.price.amount : "View Deals",
      dealUrl: gameData?.url ? "https://gg.deals" + gameData.url : dealUrl,
    };
  } catch {
    return { cheapestPrice: "View Deals", dealUrl };
  }
};

type SteamDetails = NonNullable<Awaited<ReturnType<typeof fetchSteamGameDetails>>>;

/**
 * 3-check pipeline to resolve an AI-suggested game to the correct Steam App ID.
 *
 * Check 1: Fetch Steam details for the AI-provided App ID.
 *           Fail (no data) -> go to Check 3.
 * Check 2: Compare Steam title vs aiTitle using strict titlesMatch.
 *           Mismatch -> go to Check 3.
 * Check 3: Name-search Steam store for aiTitle (no blind fallback).
 *           Re-fetch details for the found App ID.
 *           Final titlesMatch confirmation — if still fails -> return null (game dropped).
 */
const resolveGameToSteam = async (
  aiTitle: string,
  candidateAppId: string
): Promise<{ appId: string; details: SteamDetails } | null> => {

  // Validate candidateAppId length before using it
  const hasValidCandidateId = typeof candidateAppId === "string" && candidateAppId.trim().length > 0;
  console.info("[resolveGameToSteam] Resolving '" + aiTitle + "' with candidate App ID: " + (hasValidCandidateId ? candidateAppId : "(none)"));

  // Check 1
  if (hasValidCandidateId) {
    const initialDetails = await fetchSteamGameDetails(candidateAppId);

    if (initialDetails) {
      const confidence = titleMatchConfidence(initialDetails.title, aiTitle);
      console.info("[resolveGameToSteam] Check 2 confidence for App ID " + candidateAppId + ": " + confidence.toFixed(2) + " ('" + initialDetails.title + "' vs '" + aiTitle + "')");

      // Check 2
      if (titlesMatch(initialDetails.title, aiTitle)) {
        console.info("[resolveGameToSteam] Check 2 PASS — using App ID " + candidateAppId + " for '" + aiTitle + "'.");
        return { appId: candidateAppId, details: initialDetails };
      }
      console.warn("[resolveGameToSteam] Check 2 FAIL - App ID " + candidateAppId + " returned title '" + initialDetails.title + "' but AI wanted '" + aiTitle + "'. Running name search.");
    } else {
      console.warn("[resolveGameToSteam] Check 1 FAIL - No Steam data for App ID " + candidateAppId + " ('" + aiTitle + "'). Running name search.");
    }
  } else {
    console.warn("[resolveGameToSteam] Candidate App ID missing or empty for '" + aiTitle + "'. Skipping to name search.");
  }

  // Check 3
  const foundAppId = await searchSteamAppIdByName(aiTitle);
  if (!foundAppId) {
    console.warn("[resolveGameToSteam] Check 3 FAIL - Name search returned no confirmed match for '" + aiTitle + "'. Dropping game.");
    return null;
  }

  const foundDetails = await fetchSteamGameDetails(foundAppId);
  if (!foundDetails) {
    console.warn("[resolveGameToSteam] Check 3 FAIL - Could not fetch Steam details for found App ID " + foundAppId + ". Dropping game.");
    return null;
  }

  if (!titlesMatch(foundDetails.title, aiTitle)) {
    const confidence = titleMatchConfidence(foundDetails.title, aiTitle);
    console.warn("[resolveGameToSteam] Check 3 FINAL FAIL - Found title '" + foundDetails.title + "' still does not match '" + aiTitle + "' (confidence: " + confidence.toFixed(2) + "). Dropping game.");
    return null;
  }

  console.info("[resolveGameToSteam] Check 3 SUCCESS - Corrected '" + aiTitle + "' from App ID " + candidateAppId + " to " + foundAppId + " ('" + foundDetails.title + "').");
  return { appId: foundAppId, details: foundDetails };
};

/**
 * Validates that a game object from the AI response has the minimum required fields
 * for enrichment. Returns false (with a warning) if critical fields are missing.
 */
function validateRawGame(game: any, index: number): boolean {
  if (!game || typeof game !== "object") {
    console.warn("[validateRawGame] Game at index " + index + " is not an object. Skipping.");
    return false;
  }
  const aiTitle = game.aiTitle || game.title;
  if (typeof aiTitle !== "string" || aiTitle.trim().length === 0) {
    console.warn("[validateRawGame] Game at index " + index + " has no aiTitle/title. Skipping. Sample:", JSON.stringify(game).slice(0, 100));
    return false;
  }
  return true;
}

/**
 * Generates up to 10 personalised game recommendations from the Groq LLM based
 * on the user's quiz answers.
 *
 * Flow:
 * 1. Hash the answers and check Supabase for a cached result — return immediately if found.
 * 2. Build a structured prompt and call the Groq API (llama-3.3-70b-versatile).
 * 3. Validate and enrich each AI-suggested game via the Steam Store API (title + App ID verification).
 * 4. Optionally filter out games already owned by the user (requires Steam login).
 * 5. Cache the final result in Supabase for future identical quiz submissions.
 *
 * @param answers  - User's quiz answers (genres, playstyle, time, keywords, owned-game filter).
 * @param steamId  - Optional Steam ID used for caching and owned-game filtering.
 * @param onRetry  - Optional callback invoked on each API retry attempt (for UI progress display).
 * @returns RecommendationResponse with ranked game list and overall accuracy metadata.
 */
export const getGameRecommendations = async (
  answers: QuizAnswers,
  steamId?: string,
  onRetry?: (attempt: number, maxRetries: number) => void,
  onProgress?: (completed: number, total: number) => void,
): Promise<RecommendationResponse> => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) {
    throw new Error("API key missing. Set VITE_GROQ_API_KEY in your environment variables.");
  }

  const answersHash = hashAnswers(answers);
  if (steamId) {
    try {
      const { data: cached } = await supabase
        .from("quiz_results")
        .select("results")
        .eq("steam_id", steamId)
        .eq("answers_hash", answersHash)
        .maybeSingle();
      if (cached?.results) {
        return cached.results as RecommendationResponse;
      }
    } catch (cacheErr) {
      console.warn("[getGameRecommendations] Supabase cache lookup failed, proceeding with Groq:", cacheErr);
    }
  }

  const systemPrompt = `You are an expert Steam game curator. Always respond with valid JSON matching this exact structure:
{
  "recommendations": [
    {
      "id": "string",
      "aiTitle": "string",
      "steamAppId": "string",
      "genres": ["string"],
      "tags": ["string"],
      "mainStoryTime": 1,
      "completionistTime": 1,
      "suitabilityScore": 1,
      "reasonForPick": "string"
    }
  ],
  "accuracy": { "percentage": 1, "reasoning": "string" }
}

KNOWN STEAM APP IDs (use these exactly):
Elden Ring=1245620, CS2=730, Dota 2=570, GTA V=271590, Red Dead Redemption 2=1174180,
Skyrim=489830, Fallout 4=377160, The Forest=242760, The Swapper=231160, The Witness=210970,
Darkest Dungeon=262060, Hollow Knight=367520, Hades=1145360, Celeste=504230,
Stardew Valley=413150, Terraria=105600, RimWorld=294100, Factorio=427520,
Subnautica=264710, Deep Rock Galactic=548430, Valheim=892970, 7 Days to Die=251570,
Rust=252490, ARK=346110, Cyberpunk 2077=1091500, Witcher 3=292030, Monster Hunter World=582010,
Dark Souls III=374320, Sekiro=814380, Bloodborne is NOT on Steam,
Dead Cells=588650, Slay the Spire=646570, Into the Breach=590380, FTL=212680,
Disco Elysium=632470, Divinity Original Sin 2=435150, Baldurs Gate 3=1086940,
Pathfinder Wrath=1184370, Wasteland 3=719040, XCOM 2=268500, Civilization VI=289070,
Total War Warhammer 3=1142710, Stellaris=281990, Cities Skylines=255710,
Portal 2=620, Half-Life 2=220, Left 4 Dead 2=550, Team Fortress 2=440,
Among Us=945360, Fall Guys=1097150, Phasmophobia=739630, Lethal Company=1966720`;

  const userPrompt = "Suggest 6 video games on Steam matching these preferences:\n" +
    "- Genres: " + answers.preferredGenres.join(", ") + "\n" +
    "- Playstyle: " + answers.playstyle + "\n" +
    "- Time available: " + answers.timeAvailability + "\n" +
    "- Keywords: " + answers.specificKeywords + "\n\n" +
    "CRITICAL: The aiTitle field must be the EXACT game title. The steamAppId must be the correct numeric Steam App ID. " +
    "Use the known App IDs list above when available. Provide accurate playtime estimates in hours.";

  try {
    console.info("[getGameRecommendations] Calling Groq API for recommendations.");
    const responseText = await callGroq(apiKey, systemPrompt, userPrompt, onRetry);

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error("[getGameRecommendations] Failed to parse Groq response as JSON. Sample:", responseText.slice(0, 200));
      throw new Error("[getGameRecommendations] Groq returned invalid JSON.");
    }

    // Validate the recommendations array exists
    if (!parsed || !Array.isArray(parsed.recommendations)) {
      console.error("[getGameRecommendations] Groq response missing 'recommendations' array. Parsed:", JSON.stringify(parsed).slice(0, 200));
      throw new Error("[getGameRecommendations] Groq response does not contain a recommendations array.");
    }

    const rawGames: any[] = parsed.recommendations;
    console.info("[getGameRecommendations] Received " + rawGames.length + " raw game(s) from Groq.");

    // Filter out invalid entries before parallel enrichment
    const validGames = rawGames.filter((game, idx) => validateRawGame(game, idx));

    let completedCount = 0;

    // Enrich each game in parallel — all 3 hallucination checks preserved inside resolveGameToSteam
    const enrichResults = await Promise.allSettled(
      validGames.map(async (game) => {
        const aiTitle: string = (game.aiTitle || game.title || "").trim();
        const candidateAppId: string = typeof game.steamAppId === "string" ? game.steamAppId.trim() : "";

        console.info("[getGameRecommendations] Processing: '" + aiTitle + "' (candidate App ID: " + (candidateAppId || "none") + ")");

        const resolved = await resolveGameToSteam(aiTitle, candidateAppId);

        completedCount++;
        onProgress?.(completedCount, validGames.length);

        if (!resolved) {
          console.warn("[getGameRecommendations] Dropping game '" + aiTitle + "' - could not resolve to confirmed Steam App ID.");
          return null;
        }

        const { appId, details } = resolved;
        const ggDealsInfo = await fetchGGDealsInfo(appId, details.title);

        // Apply enrichment with type-guarded fallbacks for optional fields
        const enriched: GameRecommendation = {
          ...game,
          steamAppId: appId,
          title: details.title,
          description: details.description,
          developer: details.developer,
          imageUrl: getSteamImageUrl(appId),
          steamPrice: details.steamPrice,
          cheapestPrice: ggDealsInfo.cheapestPrice,
          dealUrl: ggDealsInfo.dealUrl,
          id: typeof game.id === "string" && game.id.trim() ? game.id : appId,
          genres: Array.isArray(game.genres) ? game.genres.filter((g: any) => typeof g === "string") : [],
          tags: Array.isArray(game.tags) ? game.tags.filter((t: any) => typeof t === "string") : [],
          mainStoryTime: typeof game.mainStoryTime === "number" ? game.mainStoryTime : 0,
          completionistTime: typeof game.completionistTime === "number" ? game.completionistTime : 0,
          suitabilityScore: typeof game.suitabilityScore === "number" ? game.suitabilityScore : 0,
          reasonForPick: typeof game.reasonForPick === "string" ? game.reasonForPick : "",
        };

        console.info("[getGameRecommendations] Successfully enriched: '" + details.title + "' (App ID: " + appId + ")");
        return enriched;
      })
    );

    const enrichedGames: GameRecommendation[] = enrichResults
      .filter((r): r is PromiseFulfilledResult<GameRecommendation | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((g): g is GameRecommendation => g !== null);

    console.info("[getGameRecommendations] Enrichment complete. " + enrichedGames.length + "/" + rawGames.length + " games resolved.");

    const finalResult: RecommendationResponse = {
      recommendations: enrichedGames,
      accuracy: parsed.accuracy && typeof parsed.accuracy === "object"
        ? parsed.accuracy
        : { percentage: 0, reasoning: "Evaluation failed." },
    };

    if (answers.excludeOwned && steamId) {
      try {
        const libRes = await fetch("/api/steam-library?steamid=" + encodeURIComponent(steamId), { signal: AbortSignal.timeout(10000) });
        if (libRes.ok) {
          const { appIds } = await libRes.json() as { appIds: string[] };
          const ownedSet = new Set(appIds);
          finalResult.recommendations = finalResult.recommendations.filter(
            g => !g.steamAppId || !ownedSet.has(g.steamAppId)
          );
        } else {
          console.warn("[getGameRecommendations] Steam library fetch returned status " + libRes.status + ". Skipping owned-game filter.");
        }
      } catch (libErr: any) {
        console.warn("[getGameRecommendations] Failed to fetch Steam library for filtering:", libErr.message);
      }
    }

    if (steamId) {
      try {
        await supabase.from("quiz_results").upsert({
          steam_id: steamId,
          answers_hash: answersHash,
          answers,
          results: finalResult,
        }, { onConflict: "steam_id,answers_hash" });
      } catch (cacheWriteErr) {
        console.warn("[getGameRecommendations] Supabase cache write failed:", cacheWriteErr);
      }
    }

    return finalResult;
  } catch (err) {
    console.error("[getGameRecommendations] Failure:", err);
    throw err;
  }
};

/**
 * Resolves a free-text game query to a fully enriched GameRecommendation object.
 * Used by the "Search specific game" feature on the Search page.
 *
 * Flow:
 * 1. Ask the Groq LLM for the canonical title and Steam App ID for the query.
 * 2. Run the 3-check Steam resolution pipeline (same as recommendations) to confirm
 *    the App ID and fetch live price + description from the Steam Store API.
 * 3. Return the enriched game or throw if no confirmed match is found.
 *
 * @param query    - Free-text game name entered by the user.
 * @param onRetry  - Optional callback for retry progress in the UI.
 * @returns A fully enriched GameRecommendation for the matched game.
 * @throws If the Groq API fails, returns invalid JSON, or no Steam match is confirmed.
 */
export const searchSpecificGame = async (
  query: string,
  onRetry?: (attempt: number, maxRetries: number) => void,
): Promise<GameRecommendation> => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY || "";
  if (!apiKey) throw new Error("[searchSpecificGame] API key missing.");

  // Prevent empty search terms
  if (!query || query.trim().length === 0) {
    throw new Error("[searchSpecificGame] Search query must not be empty.");
  }

  const systemPrompt = `You are an expert video game database. Always respond with valid JSON:
{
  "id": "string",
  "aiTitle": "string",
  "steamAppId": "string",
  "mainStoryTime": 1,
  "completionistTime": 1,
  "suitabilityScore": 1,
  "reasonForPick": "string"
}`;

  const userPrompt = "Find the Steam game: " + query.trim() + ". Use the correct numeric Steam App ID. Set aiTitle to the exact game title.";

  console.info("[searchSpecificGame] Calling Groq API for query: '" + query + "'");

  let responseText: string;
  try {
    responseText = await callGroq(apiKey, systemPrompt, userPrompt, onRetry);
  } catch (err: any) {
    throw new Error("[searchSpecificGame] Groq API call failed: " + err.message);
  }

  let game: any;
  try {
    game = JSON.parse(responseText);
  } catch {
    console.error("[searchSpecificGame] Failed to parse Groq response. Sample:", responseText.slice(0, 200));
    throw new Error("[searchSpecificGame] Groq returned invalid JSON.");
  }

  if (!game || typeof game !== "object") {
    throw new Error("[searchSpecificGame] Groq response was not a valid game object.");
  }

  const aiTitle: string = typeof game.aiTitle === "string" && game.aiTitle.trim()
    ? game.aiTitle.trim()
    : query.trim();
  const candidateAppId: string = typeof game.steamAppId === "string" ? game.steamAppId.trim() : "";

  console.info("[searchSpecificGame] AI title: '" + aiTitle + "', candidate App ID: " + (candidateAppId || "none"));

  const resolved = await resolveGameToSteam(aiTitle, candidateAppId);

  if (!resolved) {
    throw new Error("[searchSpecificGame] Could not resolve '" + aiTitle + "' to a confirmed Steam game.");
  }

  const { appId, details } = resolved;
  const ggDealsInfo = await fetchGGDealsInfo(appId, details.title);

  const enriched: GameRecommendation = {
    ...game,
    steamAppId: appId,
    title: details.title,
    description: details.description,
    developer: details.developer,
    imageUrl: getSteamImageUrl(appId),
    steamPrice: details.steamPrice,
    cheapestPrice: ggDealsInfo.cheapestPrice,
    dealUrl: ggDealsInfo.dealUrl,
    id: typeof game.id === "string" && game.id.trim() ? game.id : appId,
    mainStoryTime: typeof game.mainStoryTime === "number" ? game.mainStoryTime : 0,
    completionistTime: typeof game.completionistTime === "number" ? game.completionistTime : 0,
    suitabilityScore: typeof game.suitabilityScore === "number" ? game.suitabilityScore : 0,
    reasonForPick: typeof game.reasonForPick === "string" ? game.reasonForPick : "",
  };

  console.info("[searchSpecificGame] Successfully enriched: '" + details.title + "' (App ID: " + appId + ")");
  return enriched;
};