# Catholic Krillion ("Credillion") — Project Context & Handover Guide

> **For Antigravity AI Assistant & Developer Handover**  
> *Last Updated: November 4, 2026*  
> *Version: 3.0.0 (Pure Catholic Catalog, Doctors of the Church Tier 4 Elevation, Strict Singapore Catholic Parishes)*  
> *Google Drive Backup: [https://drive.google.com/drive/folders/1-AIxQmQbDKMmHGgfqFFK03mkwPGJwwNt](https://drive.google.com/drive/folders/1-AIxQmQbDKMmHGgfqFFK03mkwPGJwwNt)*  
> *Portable Zip: `catholic-krillion.zip` (root directory)*

---

## 1. Project Overview & Concept

**Catholic Krillion** (branded in-game as **"Credillion"**) is a fast-paced, real-time multiplayer Catholic word-association trivia game designed for university student ministry, youth groups, and parish community nights.

- **Main Display (Projector / Screen 1):** Displayed on a large TV or projector. Shows the match clock, active category prompt, 30-second category rotation progress bar, real-time live typing streams from both teams, vault depth descent meters, and scored discoveries.
- **Controllers (Mobile / Screen 2):** Two teams compete on mobile smartphones:
  - **Team 1 / Team A (St. Peter's Keys):** Gold / Cathedral Blue theme (`/team1`).
  - **Team 2 / Team B (St. Paul's Sword):** Crimson / Silver theme (`/team2`).
- **Core Loop:** Teams race against the clock to type and submit Catholic words or phrases associated with the active category. Higher rarity answers score more points and propel the team deeper into the theological vault.

---

## 2. Match Rules & Game Mechanics

### Match Structure
1. **Lobby (`phase: 'lobby'`):** Displays QR codes and URLs for mobile controllers to connect. Host clicks **"Start Match"** to begin.
2. **Round 1 — Foundation (`phase: 'round1'`, 180s / 3 mins):** Base point scoring.
3. **Halftime Intermission (`phase: 'halftime'`, 30s):** Scores pause, comparative stats displayed. Host can skip with "Continue to Round 2".
4. **Round 2 — *Duc In Altum* (`phase: 'round2'`, 180s / 3 mins):** **1.5× score multiplier** across all tiers.
5. **Game Over / Victory Podium (`phase: 'gameover'`):** Confetti/fanfare, winner announcement, full breakdown of top discoveries.

### 60-Second Category Rotation & 6 Curated Categories
- Prompts rotate every **60 seconds (1 minute)** during active gameplay.
- **Round 1:** 3 categories (3 minutes total).
- **Halftime:** 30 seconds pause with comparative score breakdown.
- **Round 2:** 3 remaining categories (3 minutes total, 1.5× multiplier).
- The 6 official categories are:
  1. **Saints** (`saints`)
  2. **Physical Ways to Pray** (`physical_ways_to_pray`)
  3. **Worship Songs** (`worship_songs`)
  4. **Types of Prayers** (`types_of_prayers`)
  5. **Biblical Characters** (`biblical_characters`)
  6. **Churches in Singapore** (`churches_in_singapore`)
- Synced across both the projector display and mobile controllers with visual countdown progress indicators.

### Scoring Tiers (Duc In Altum Multipliers)
| Tier | Name | Round 1 Base | Round 2 (1.5×) | Sound Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | Pew Warmer | 10 pts / 100m | 15 pts / 150m | Silver Handbell |
| **Tier 2** | Altar Server | 30 pts / 300m | 45 pts / 450m | Brass Altar Bell |
| **Tier 3** | Theologian | 60 pts / 600m | 90 pts / 900m | Cathedral Bronze Bell |
| **Tier 4** | Doctor of the Church | 85 pts / 850m | 128 pts / 1275m | Westminster Double Bell |
| **Tier 5** | One-in-a-Credillion | 100 pts / 1000m | 150 pts / 1500m | Pipe Organ Flourish |

### Anti-Spam & Validation Rules
- **Per-Category Duplicate Prevention:** Once a word/phrase is scored by a team within an active category, they cannot submit it again within that category. However, legitimate words can be scored across different categories (e.g. *"Peter"* is valid in Saints and also in Biblical Characters; *"Rosary"* is valid in Physical Ways to Pray and also in Types of Prayers).
- **Multi-Word Acceptance:** Multi-word terms (e.g., *"Divine Mercy Chaplet"*, *"Saint Thérèse"*, *"Our Lady of Guadalupe"*) are fully valid.
- **Rate-Limiting Cooldown:** 350ms–400ms cooldown enforced on client and server to prevent automated spamming.
- **8-Stage Normalization Pipeline:**
  1. Trim & lowercase
  2. Unicode NFD diacritic stripping (`Thérèse` -> `therese`)
  3. Ligature decomposition (`æ` -> `ae`, `œ` -> `oe`, `ß` -> `ss`)
  4. Hyphen-to-space conversion
  5. Punctuation stripping
  6. Whitespace collapsing
  7. Honorific, church & article prefix stripping (`saint `, `st `, `ste `, `san `, `santa `, `church of `, `cathedral of `, `the `, `a `, `an `)
  8. Length-gated Levenshtein typo tolerance (distance ≤ 1 for length 5–8; distance ≤ 2 for length > 8)

---

## 3. Architecture & File Structure

```text
web/krillion/
├── server.js               # Authoritative Node.js Express + WebSocket server
├── package.json            # Dependencies: ws, qrcode, mqtt, puppeteer-core
├── start.bat               # 1-click Windows startup script
├── Dockerfile              # Container spec for Docker/cloud deployments
├── render.yaml             # Render.com Blueprint configuration
├── cloudflared.exe         # Cloudflare Tunnel binary for public tunneling
│
├── data/
│   └── questions.json      # 30 categories with 5 difficulty tiers each (50KB)
│
├── engine/
│   └── validator.js        # Isomorphic 8-stage normalization & validation engine
│
├── public/
│   ├── index.html          # Projector / Host view (Screen 1)
│   ├── team.html           # Mobile controller view for Team 1 & Team 2 (Screen 2)
│   ├── styles.css          # Sacred ecclesiastical styling (Cinzel + Inter, gold & crimson)
│   ├── audio.js            # 100% Procedural Web Audio API synthesizer (no audio files)
│   ├── game-engine.js      # ClientGameEngine + CloudRelay for serverless fallback
│   ├── validator.js        # Browser bundle of KrillionValidator
│   ├── questions-bundle.js # Synchronous browser bundle of questions.json
│   ├── mqtt.min.js         # Offline client bundle for MQTT WebSocket broker
│   ├── qrcode.min.js       # Offline QR code generator for browser
│   └── _redirects          # Netlify routing rules (/team1 -> team.html?team=1)
│
└── test/
    ├── adversarial_fuzzy_oracle.js      # Fuzzy match edge case testing
    ├── check_browser_live.js            # Headless Chrome live verification test
    ├── e2e_harness.js                   # End-to-end integration harness
    ├── stress_test.js                   # High-frequency submission stress test
    ├── test_browser_flow.js             # Browser flow validation
    ├── test_game_engine_rotation.js     # 30s category rotation test
    ├── test_spam_prevention.js          # Duplicate & rate limit verification
    ├── test_validator.js                # Core validator unit tests
    └── verify_krillion.js               # Overall smoke verification script
```

---

## 4. Dual-Mode Deployment Architecture

Catholic Krillion supports two operational modes:

### Mode A: Authoritative Node Server + Cloudflare Tunnel (Current Preferred)
- **Local Server:** `server.js` runs on Node.js port 3000.
- **Cloudflare Tunnel:** `cloudflared.exe tunnel --url http://127.0.0.1:3000` exposes the server globally over HTTPS/WSS with 0 port-forwarding.
- **Latency:** `< 50ms` real-time WebSocket communication.
- **Controller QR Codes:** Projector screen automatically detects the public tunnel URL (via `scratch/public_url.txt` or `PUBLIC_URL` env) and renders scannable QR codes for mobile players.

### Mode B: Static Serverless Cloud Relay (Netlify / GitHub Pages)
- **Static Host:** Pure HTML/CSS/JS hosted on any static CDN (e.g. Netlify).
- **Relay Broker:** Free global WSS MQTT broker (`wss://broker.emqx.io:8084/mqtt`).
- **Game Engine:** Runs inside the Host browser tab (`ClientGameEngine`), which acts as room referee and broadcasts state to mobile controllers.
- **Zero Maintenance:** 0 cold starts, 0 spin-downs, 100% free forever without requiring a running computer.

---

## 5. How to Run on a New Computer

### Option 1: Running the Local Server
```bash
# 1. Navigate to the project directory
cd web/krillion

# 2. Install dependencies (if fresh clone)
npm install

# 3. Start the game server
node server.js
```
- Open **Host / Projector:** `http://localhost:3000`
- Open **Team 1:** `http://localhost:3000/team1`
- Open **Team 2:** `http://localhost:3000/team2`

### Option 2: Running with Public Mobile Access (Cloudflare Tunnel)
```powershell
# In Terminal 1:
cd web/krillion
node server.js

# In Terminal 2:
cd web/krillion
.\cloudflared.exe tunnel --url http://127.0.0.1:3000
```
- Cloudflare will print an active URL: e.g. `https://<random-name>.trycloudflare.com`
- Save that URL into `scratch/public_url.txt` (or pass `PUBLIC_URL=https://... node server.js`) so the host screen updates its QR codes.
- Players anywhere in the room scan the QR code to connect their phones.

---

## 6. Key Configuration Values

| Setting | Location | Value | Purpose |
| :--- | :--- | :--- | :--- |
| `ROUND_1_DURATION_MS` | `server.js` & `game-engine.js` | `180 * 1000` (3m) | Duration of Round 1 (3 categories) |
| `HALFTIME_DURATION_MS` | `server.js` & `game-engine.js` | `30 * 1000` (30s) | Duration of Halftime intermission |
| `ROUND_2_DURATION_MS` | `server.js` & `game-engine.js` | `180 * 1000` (3m) | Duration of Round 2 (3 categories, 1.5× mult) |
| `CATEGORY_ROTATION_MS` | `server.js` & `game-engine.js` | `60 * 1000` (60s) | 1-minute prompt rotation |
| `SUBMIT_COOLDOWN_MS` | `server.js` & `game-engine.js` | `350ms` | Minimum gap between submissions |
| `matchWideUnique` | `validator.js` constructor | `false` | Enables legitimate reuse across distinct categories |

---

## 7. Useful Test Commands

To verify that all engines, timers, and validations are working properly on a new machine:

```bash
# Test validation engine (normalization, diacritics, tiers)
node web/krillion/test/test_validator.js

# Test 30s category rotation engine
node web/krillion/test/test_game_engine_rotation.js

# Test spam prevention & duplicate rejection
node web/krillion/test/test_spam_prevention.js

# Test full end-to-end integration harness
node web/krillion/test/e2e_harness.js
```

---

## 8. Where Everything is Backed Up

1. **Google Drive (Full Folder, Unzipped):**  
   [https://drive.google.com/drive/folders/1-AIxQmQbDKMmHGgfqFFK03mkwPGJwwNt](https://drive.google.com/drive/folders/1-AIxQmQbDKMmHGgfqFFK03mkwPGJwwNt)
2. **Packaged ZIP Archive:**  
   `c:\Users\beril\Downloads\Faith-20261005T143257Z-1-001\Faith\catholic-krillion.zip` (285 KB, excludes `node_modules` for easy transport).
3. **Current Live Cloudflare Tunnel URL:**  
   `https://shoulder-generate-september-ridge.trycloudflare.com`
