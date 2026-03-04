# SteamQuest: AI-Powered Game Discovery Engine

**SteamQuest** is an AI-powered game discovery application that helps users find their next favorite game across **all gaming platforms** — not just Steam. It combines a Groq LLM recommendation engine, a universal cross-platform game search powered by RAWG, a smart favorites system with purchase links, and deep Steam integration.

## Core Features

- **Personalized AI Recommendations** — A 4-step quiz (genre → playstyle → session length → keywords) sends your preferences to the Groq LLM (llama-3.3-70b-versatile), which returns up to 10 ranked game suggestions with match percentages, playtime estimates, Steam prices, and GG.deals links.
- **Universal Platform Search** — Search spans every platform RAWG covers: PC, PlayStation, Xbox, Nintendo, iOS, Android, and more. You are not limited to Steam games.
- **Smart Favorites System** — Add *any* game found via search (regardless of platform) to your favorites list. Favorites stored in Supabase display Steam store links and GG.deals cheapest-price links so you can buy or wishlist them later.
- **Steam Login & Integration** — Sign in with Steam to unlock your profile page, quiz history, and the "exclude owned games" filter on quiz results.
- **Advanced Search Filters** — Filter by platform, genre, tag, Metacritic score, and sort order via the search filter panel.
- **Quiz History & PNG Export** — Completed quizzes are saved to your Supabase profile. Expand any quiz result and export it as a shareable PNG card (3-column grid layout). Your full favorites list can also be exported as a PNG.
- **Live Steam Stats** — The Steam Stats tab on your profile shows total games, playtime, Steam level, recently played, and top played games — fetched live from the Steam API with Supabase caching.
- **Exclude Owned Games** — Opt to remove games you already own on Steam from quiz recommendations (requires Steam login and a public Steam profile).
- **"Already Owned" Badge** — Games you own on Steam are highlighted with a ✓ Owned badge in your quiz history and favorites, replacing the store links.

## Search & Favorites — Primary Use Case

The **Search** page is a key feature of SteamQuest. Users can search for any game from any console or platform (e.g., a PlayStation exclusive, a mobile game, or a PC title) and add it to their favorites. The favorites list then shows:

- **Steam store link** with current price (if the game is available on Steam)
- **GG.deals link** with the cheapest reseller price found

This lets users build a cross-platform wishlist and easily find the best place to buy each game.

## Quiz Options

The quiz walks you through four steps:

| Step | Question | Options |
|------|----------|---------|
| 1 | **Genre** | Action, RPG, Strategy, Indie, Adventure, Simulation, Horror, Puzzle, Sports, Racing (multi-select) |
| 2 | **Playstyle** | Casual · Balanced · Hardcore |
| 3 | **Session length** | Short (< 1 h) · Medium (1–3 h) · Long (3 h+) |
| 4 | **Specific keywords** | Free-text (themes, vibes, settings) + optional *"Exclude owned games"* checkbox |

After submission the AI generates up to 10 ranked recommendations with match percentage, playtime estimates, Steam price, and a deal link.

## Exporting a Card (PNG)

Once you have quiz results or favorites saved to your profile:

1. Open your **Profile** page (top-right corner after logging in with Steam).
2. In the **Quiz History** tab, expand any quiz result and click **⬇ Export as PNG**.
3. In the **♥ Wishlist** tab, click **⬇ Export Wishlist as PNG**.
4. A preview of the card appears — click **Save as PNG** to download the image.

Cards use a compact **3-column grid layout** so up to 12 games fit per image. Quiz exports include a **Genres** header strip listing the genres chosen for that session (e.g., "Genres: Action · RPG"). Wishlist exports show all real platform icons for each game.

## Static Assets

The app logo is referenced as `/logo.png` in `App.tsx`, `components/ExportableCard.tsx`, and `index.html`. For Vite to serve it at that path, the file must be placed in the `public/` folder:

```
public/logo.png
```

Copy `logo.png` from the repo root into the `public/` directory before running or deploying the app. The `public/` folder is tracked via a `.gitkeep` placeholder — the binary `logo.png` file itself is not committed to git.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment:
   Create a `.env.local` file in the root directory with the following variables:

   ```env
   # Groq LLM (required for AI game recommendations)
   VITE_GROQ_API_KEY=your_groq_api_key

   # Steam (required for Steam login and user profiles)
   STEAM_API_KEY=your_steam_web_api_key
   AUTH_SECRET=a_random_secret_string_at_least_32_chars
   APP_URL=http://localhost:3000

   # RAWG (required for universal game search)
   VITE_RAWG_API_KEY=your_rawg_api_key

   # Supabase (required for quiz result caching, favorites, and profile history)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # GG.deals (optional — enables cheapest-price display on game cards)
   VITE_GGDEALS_API_KEY=your_ggdeals_api_key
   ```

   - **Groq API key**: [console.groq.com](https://console.groq.com/) — free tier available
   - **RAWG API key**: [rawg.io/apidocs](https://rawg.io/apidocs) — free tier available
   - **Steam API key**: [Steam Web API](https://steamcommunity.com/dev/apikey)
   - **Supabase**: [supabase.com](https://supabase.com/) — create a project and copy the URL & anon key from *Settings → API*
   - **GG.deals API key**: [gg.deals](https://gg.deals/) — optional, enables live price data

3. Create the required Supabase tables:

   Run the following SQL in your Supabase SQL editor (*Database → SQL Editor*):

   ```sql
   CREATE TABLE IF NOT EXISTS quiz_results (
     id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
     steam_id    text        NOT NULL,
     answers_hash text       NOT NULL,
     answers     jsonb       NOT NULL,
     results     jsonb       NOT NULL,
     created_at  timestamptz DEFAULT now()
   );

   CREATE UNIQUE INDEX IF NOT EXISTS quiz_results_steam_id_answers_hash
     ON quiz_results (steam_id, answers_hash);
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

> **Note for Steam login during local development:** Steam OpenID requires a publicly reachable callback URL.  
> Either use a tunnel like [ngrok](https://ngrok.com/) (`ngrok http 3000`) and set `APP_URL` to the tunnel URL, or test the Steam login flow on your Vercel deployment where the callback URL is public.

## Vercel Deployment

All environment variables listed above (except `APP_URL` which should be your Vercel deployment URL, e.g. `https://yourapp.vercel.app`) must be configured in your Vercel project settings under *Settings → Environment Variables*.

The `STEAM_API_KEY` and `AUTH_SECRET` variables are **server-side only** (no `VITE_` prefix) and are never exposed to the browser.

## Excluding Owned Games from Quiz Results

At the last step of the quiz you will see an **"Exclude games I already own"** checkbox.

- **Requires Steam login.** If you are not signed in, the checkbox is replaced by a prompt to log in with Steam.
- When checked, the app calls the server-side `/api/steam-library` endpoint, which uses your `STEAM_API_KEY` to query the Steam Web API for your owned titles. Any recommended game already in your library is removed from the results.
- The underlying recommendations are still cached as normal; filtering is applied at display time so toggling the option costs no extra AI calls.

## Steam Playtime & Achievements on Profile

When you open your Profile page:

- The app calls `/api/steam-playtime` with your Steam ID and the app IDs of every game in your quiz history and wishlist.
- **Playtime** is fetched strictly from `IPlayerService/GetOwnedGames` — shown as green "🎮 Xh played" text next to each game. If you don't own the game or your profile is private, a "⏱ ~10h avg play time" fallback is shown instead.
- **Achievement progress** is fetched from `ISteamUserStats/GetPlayerAchievements` — shown as "🏆 unlocked / total". If no achievement data is available (not owned, private profile, or game has no achievements), "🏆 Achievements: N/A" is shown instead.
- Both fields require your Steam profile and game stats to be **public**. No fake or randomly assigned data is ever displayed — all values come directly from the Steam API.

## Steam Stats Tab

The **📊 Steam Stats** tab on your Profile page provides a comprehensive snapshot of your Steam account, loaded lazily when you first click the tab.

### What's shown

- **Overview cards**: total games, number of games played (with percentage), total playtime, and average playtime per played game.
- **Steam Level card**: your current level with an XP progress bar and XP-to-next-level counter.
- **Recently Played**: up to 5 games you've played recently (this week + all-time hours).
- **Top Played**: your 5 most-played games by all-time hours.
- **Account info strip**: country flag and Steam account age in years.

### Caching

Stats are stored in the Supabase `steam_stats_cache` table so they survive page refreshes and tab switches without extra API calls. Use the **⟳ Refresh Stats** button to fetch fresh data from Steam and update the cache.

Run the following SQL in your Supabase SQL editor to create the required table:

```sql
CREATE TABLE IF NOT EXISTS steam_stats_cache (
  steam_id   text        PRIMARY KEY,
  stats      jsonb       NOT NULL,
  updated_at timestamptz DEFAULT now()
);
```

The `/api/steam-stats` endpoint makes exactly **4 parallel Steam API calls** (no per-game fan-out), so it is fast regardless of library size.

## "Already Owned" Badge

In the **Quiz History** and **♥ Wishlist** tabs, games you already own on Steam are highlighted with a green **✓ Owned** badge in place of the Steam/Deal store links. Ownership is determined from:

1. Per-game playtime data fetched by `/api/steam-playtime` (populated for games in your history/wishlist).
2. The `ownedAppIds` list from `/api/steam-stats` (populated after opening the Steam Stats tab), which covers your entire library — useful as a fallback for games not yet checked individually.

The badge only appears for Steam-sourced games. RAWG-sourced favorites continue to show their regular store links.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build tool**: Vite
- **AI / LLM**: [Groq](https://console.groq.com/) (llama-3.3-70b-versatile) — powers quiz recommendations and game search
- **Game database**: [RAWG API](https://rawg.io/apidocs) — universal cross-platform game search
- **Steam integration**: Steam OpenID (auth), Steam Web API (library, playtime, achievements, stats)
- **Pricing**: [GG.deals](https://gg.deals/) API — cheapest reseller price for PC games
- **Backend / database**: [Supabase](https://supabase.com/) — profiles, favorites, quiz history, Steam stats cache
- **PNG export**: [html-to-image](https://github.com/bubkoo/html-to-image)

