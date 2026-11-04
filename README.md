# Catholic Krillion ("Credillion")

A real-time, 3-screen 2v2 Catholic word-association party game.
- **Screen 1 (Host / Projector Display)**: Shows match countdown, Vatican Vault descent depth meters for both teams, live answer alerts, audio chimes, and podiums.
- **Screen 2 (Team 1 Controller / St. Peter Gold)**: Interactive mobile/laptop buzzer & word input.
- **Screen 3 (Team 2 Controller / St. Paul Crimson)**: Interactive mobile/laptop buzzer & word input.

---

## Quick Start on Any Device (with Antigravity or Terminal)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer)

### Step 1: Install Dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### Step 2: Start the Game
```bash
node server.js
```
*(On Windows, you can also just double-click `start.bat`)*

The server will automatically detect your local network IP and start on port `3000`:
- **Host / Big Screen**: `http://localhost:3000/`
- **Team 1 Controller**: `http://localhost:3000/team1` (or scan the on-screen QR code)
- **Team 2 Controller**: `http://localhost:3000/team2` (or scan the on-screen QR code)

---

## Playing with Remote Devices (Internet Play)

To let players connect from their own phones or computers over the internet:

### Option A: Cloudflare Quick Tunnel (Free, Zero Setup)
1. Run:
   ```bash
   .\cloudflared.exe tunnel --url http://127.0.0.1:3000
   ```
   *(Or on Mac/Linux: `brew install cloudflare/cloudflare/cloudflared && cloudflared tunnel --url http://localhost:3000`)*
2. It outputs a public URL like `https://*.trycloudflare.com`.
3. Open `https://*.trycloudflare.com/` on the main screen, and have teams join at `/team1` and `/team2`!

### Option B: Local Wi-Fi / Hotspot (No Internet Needed)
Both phones and the host laptop just connect to the same Wi-Fi or phone hotspot. Teams open the local IP printed in the terminal (e.g. `http://192.168.1.X:3000/team1`).

---

## Game Rules & Features
- **30-Second Category Rotation**: Prompts change every 30 seconds automatically.
- **5 Rarity Depth Tiers**: From Pew Warmer (10m) to One-in-a-Credillion (100m).
- **Match-Wide Duplicate Prevention**: Once an answer is scored by a team, it cannot be reused again in later categories during that match.
- **Anti-Spam Cooldown**: Built-in 350ms throttle prevents rapid button mashing.
