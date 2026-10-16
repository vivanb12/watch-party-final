# 🎬 Watch Party

Watch movies with friends, **at the same moment**, even when you are in different places.
One person creates a room, shares a 6-character code, and everyone's video plays, pauses and
skips together. You can also chat, send emoji reactions, find a movie everyone likes, and let
the host share their screen.

**🔗 Live app:** https://watch-party-one-weld.vercel.app/

---

## Table of contents

1. [How to use it (2 minutes)](#how-to-use-it-2-minutes)
2. [Features](#features)
3. [How it works (plain English)](#how-it-works-plain-english)
4. [Performance and latency](#performance-and-latency)
5. [Failure handling](#failure-handling)
6. [Tech stack](#tech-stack)
7. [Run it on your own computer](#run-it-on-your-own-computer)
8. [Environment variables](#environment-variables)
9. [Set up the database](#set-up-the-database)
10. [Deploy to Vercel](#deploy-to-vercel)
11. [Project structure](#project-structure)
12. [Known limitations](#known-limitations)

---

## How to use it (2 minutes)

### Start a party (host)

1. Open the live app.
2. Pick a screen: **Romantic**, **Sports** or **Friends & Family**. The choice only changes the look of the room.
3. Your room opens with a movie already loaded (*Big Buck Bunny*). Type your name when asked.
4. Click the **room code button** at the top (for example `K7M2QX`). This copies the **invite link**. Send it to your friends.

### Join a party (guest)

- **With a link:** just open it. Enter your name and you're in.
- **With a code:** on the home page click **Join with code**, type the 6 characters and press **Take me there**.

### Watching together

- **Play / Pause:** press the button. Everyone's video follows.
- **Chat:** type in the chat box. Your message pops up in a speech bubble above your seat.
- **React:** tap an emoji (😂 😍 😱 👏 🔥 😭). It floats up from your seat for everyone.
- **Group Pick:** tick the genres and moods you like. Everyone's choices are counted live. Press **Suggest for the group** to get up to 5 movies that suit the whole room.
- **Host controls:** the host can **Make host** (hand over the room to someone else) and switch **Controls** between *everyone* and *host only*.

### Sharing the host's screen

1. The host clicks **Share screen** and picks a tab, window or screen. **Tick "share audio"** in the browser popup if you want sound.
2. Viewers will see the host's screen in the video area.
3. ⚠️ **Viewers must click on the shared screen once to see it.** Browsers block videos with sound from starting by themselves, so one click is needed.
4. The host clicks **Stop sharing** when done.

### Browse movies without a room

Click **Browse movies** on the home page to search the catalogue. Movies that have a play button can be started as a brand-new room. Inside a room, the host (or anyone, in *everyone* mode) can switch movies with the ▶ button next to a **Group Pick** suggestion.

---

## Features

| Feature | Where it happens |
| --- | --- |
| Create and join rooms by **invite link** or **6-character room code** | Home page, `/room/CODE` |
| **Synced play, pause and seek** for everyone | Room page |
| **Movie discovery**: categories, filters, **fuzzy (typo-tolerant) search** | Browse movies page |
| **Emoji reactions** and **live chat** (speech bubbles above each seat) | Room page |
| **Group Pick**: everyone's genres and moods are tallied, then movies are suggested for the group | Room page |
| **Host transfer**, manual or automatic when the host leaves | Room page |
| **Host-only mode**: lock playback controls to the host | Room page |
| **Automatic drift detection and correction** | Runs in the background |
| **Late joins and reconnects** handled automatically | Runs in the background |
| **Concurrent actions** handled safely (two people clicking at once) | Runs in the background |
| **Host screen sharing** (WebRTC) | Room page |
| **Three themed rooms** | Home page |
| **Live stats panel**: drift, p95 propagation and clock round-trip time | Under the video |

### Movie search and filters

You can search titles, actors and directors, and typos are forgiven (try `chrstopher nolan`).
Filter by **genre, actor, director, language, release year, minimum rating and maximum runtime**,
and sort by best match, rating, year, popularity, title or runtime.
Ready-made rows: *Free to play now, Date night, Game day, Family movie night, Mind-benders, Under 2 hours*.

> The catalogue is a small sample of **50 movies**. Only a few have a real video
> (the free Blender sample films *Big Buck Bunny, Sintel, Tears of Steel* and *Elephants Dream*), so those are the ones you can actually play.

---

## How it works (plain English)

Think of the room as a **shared remote control** that lives in the cloud.

**1. The database is the boss.**
Every room is one row in a [Supabase](https://supabase.com) (Postgres) table. It stores
*"is the movie playing? at what position? since when?"*. This is the single source of truth.
Clients never trust each other. They ask the database.

**2. Nobody sends "the current time".**
Instead the room stores *"at server time T the movie was at 12.0 seconds and playing"*.
Each person's browser works out where the movie **should** be right now:

```
expected position = saved position + (time now − saved time)
```

Because everyone does the same sum, everyone lands on the same frame.

**3. Clocks are aligned first.**
Computers' clocks are never exactly equal. Each browser pings the database every 3 seconds,
measures the round trip and calculates its clock offset (an NTP-style method that keeps the
best, lowest-latency samples). All maths uses this corrected "server time".

**4. Changes are announced instantly.**
When you press Play, your browser asks the database to apply it. If accepted, the new state
is **broadcast** to the room over Supabase Realtime (WebSockets), so others react within
a few milliseconds without waiting to poll.

**5. Version numbers stop clashes.**
Every change bumps a `version` number. If two people press buttons at the same instant,
the database locks the room row, accepts one, and tells the other *"someone acted first"* and sends them the latest state. Nobody ends up in a different state.

**6. Drift is corrected quietly.** Every 200 ms each browser compares its video to where it should be:

| Difference from the room | What happens |
| --- | --- |
| under 40 ms | nothing, you're in sync |
| 40 ms to 1.5 s | the video speeds up or slows down slightly (1.05× or 0.95×), so you catch up smoothly |
| over 1.5 s | the video jumps straight to the right spot |

**7. Screen sharing is peer-to-peer.**
The host's screen goes straight to each viewer using WebRTC. The room's realtime channel is only used
to exchange the connection details (this is called "signalling").

---

## Performance and latency

The room page shows three live numbers under the video so you can check it yourself:

| Number | Meaning |
| --- | --- |
| **drift (ms)** | how far *your* video is from where it should be |
| **p95 propagation (ms)** | for 95% of button presses, the time from the click to it arriving at your device |
| **clock RTT (ms)** | round-trip time to the server clock |

**Targets from the task:** at least 10 users per room · control propagation ≤ 250 ms (p95, local network) · drift ≤ 500 ms after correction.

### How to test it yourself

1. Open a room on one device (host) and join it from several other tabs or devices on the **same Wi-Fi**. Use 10 or more.
2. Press play, pause and seek about 50 times. The panel keeps the last 50 samples.
3. Read **p95 propagation** and each person's **drift** (the host sees every guest's drift next to their name).
4. Write the results in the table below.

### My results

> Fill this in after you test. Don't guess. Write what the panel actually showed.

| Test | Conditions | Result |
| --- | --- | --- |
| Users in one room | _e.g. 10 browser tabs + 2 phones, same Wi-Fi_ | _ |
| p95 control propagation | _50 clicks, same Wi-Fi_ | _ ms (target ≤ 250) |
| Drift after correction | _after 5 minutes of playback_ | _ ms (target ≤ 500) |
| Clock RTT | _typical_ | _ ms |

---

## Failure handling

| Situation | What the app does |
| --- | --- |
| **Someone joins late** | Asks the database for the current state and jumps to the right second. |
| **Wi-Fi drops and comes back** | Reconnects, asks for a fresh snapshot, and discards any stale one. |
| **Tab was in the background** | Refreshes the state when you return to the tab. |
| **No updates for 6 seconds** | Safety check: re-fetches the state from the database. |
| **Two people press buttons at once** | One wins, the other is told and re-synced (version check). |
| **Host closes the tab** | After a 12-second grace period the longest-present member automatically becomes the new host. |
| **Someone leaves** | Their seat fades, then is removed after 12 seconds, so a quick refresh does not lose it. |
| **Host-only mode and a guest clicks play** | Ignored, with a friendly message. |
| **Room code doesn't exist** | Shows "Room not found" with a way back home. |
| **AI suggestions not set up or out of credit** | Shows a clear message instead of crashing. |

---

## Tech stack

| Part | Tool |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + TypeScript) |
| Styling | Tailwind CSS 4, shadcn/Radix UI components, Framer Motion animations |
| Realtime and database | [Supabase](https://supabase.com): Postgres functions, Realtime broadcast and presence |
| Screen share | WebRTC (Google STUN servers) |
| AI suggestions (optional) | Any OpenAI-compatible API |
| Tests | Vitest |
| Hosting | Vercel (built with Nitro) |

---

## Run it on your own computer

You need [Node.js](https://nodejs.org) (version 20 or newer) and [Git](https://git-scm.com).

```bash
# 1. Download the code
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO

# 2. Install the libraries
npm install

# 3. Create your settings file (then open .env and fill it in)
cp .env.example .env        # on Windows Command Prompt: copy .env.example .env

# 4. Start it
npm run dev
```

Open **http://localhost:8080**. To test with several people on the same Wi-Fi, open
`http://YOUR-COMPUTER-IP:8080` on the other devices.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Make the production version |
| `npm start` | Run the production version (after build) |
| `npm test` | Run the automated tests |
| `npm run lint` | Check the code for mistakes |

---

## Environment variables

Copy `.env.example` to `.env` and fill these in. **Never upload your real `.env` to GitHub.**

| Name | Needed? | What it is |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Your Supabase public (anon) key |
| `SUPABASE_URL` | Yes | Same URL, used by the server |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Same public key, used by the server |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | 🔒 **Secret** admin key. Server only, never share it |
| `AI_API_KEY` | No | For "Suggest for the group". Leave empty to switch the feature off |
| `AI_BASE_URL` | No | AI provider address (default: OpenAI) |
| `AI_MODEL` | No | AI model name (default: `gpt-4o-mini`) |
| `CRON_SECRET`, `DATABASE_URL` | No | Only for scheduled jobs and database migrations |

Find the Supabase values in your project under **Project Settings → API**.

---

## Set up the database

Do this once for a new Supabase project:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**.
3. Paste the whole contents of `drizzle/migrations/0000_migration.sql` and click **Run**.

This creates the `rooms` table, the room functions (`create_room`, `get_room`, `room_command`, `room_admin`, `server_ms`), the movie tables with fuzzy-search functions, and the 50 sample movies.

---

## Deploy to Vercel

1. Push this project to GitHub (without `node_modules` and `.env`).
2. On [vercel.com](https://vercel.com) click **Add New → Project** and import the repo.
3. Open **Environment Variables** and add every variable from the table above.
4. Click **Deploy**. Every later `git push` redeploys automatically.

If a build fails, open the failed deployment and read the red error line. It usually says which file or variable is missing.

---

## Project structure

```
watch-party/
├── src/
│   ├── routes/                 # One file per page
│   │   ├── index.tsx           #   Home: pick a screen, join with code
│   │   ├── create.$theme.tsx   #   Creates a room, then redirects
│   │   ├── room.$code.tsx      #   The watch room
│   │   └── discover.tsx        #   Movie browser
│   ├── components/
│   │   ├── room/               # Audience seats, Group Pick
│   │   ├── discovery/          # Movie browser, cards, drawer
│   │   └── ui/                 # Buttons, dialogs, etc.
│   ├── lib/
│   │   ├── useRoom.ts          # Realtime connection, state, host handoff
│   │   ├── clock.ts            # Clock sync with the server
│   │   ├── useDrift.ts         # Drift detection and correction
│   │   ├── useScreenShare.ts   # WebRTC screen sharing
│   │   ├── suggest.functions.ts# AI movie suggestions (server)
│   │   └── movies.ts           # Movie search helpers
│   └── integrations/supabase/  # Supabase client setup
├── drizzle/migrations/         # Database SQL (tables, functions, sample movies)
├── public/                     # Favicon, robots.txt
├── .env.example                # Template for your settings
└── package.json                # Libraries and commands
```

---

## Known limitations

Being honest about what this version does not do:

- **Small catalogue:** 50 sample movies, and only 4 have a playable video.
- **No accounts:** your identity is a random ID and name saved in your browser. Clearing browser data makes you a new person.
- **Screen share needs a click for viewers** (browser autoplay rules), and uses only free STUN servers. On strict networks (some offices, schools, mobile data) it may fail without a TURN server.
- **Screen share load:** the host sends a separate stream to every viewer, so many viewers need a fast upload connection.
- **Group Pick is a taste tally plus AI suggestions**, not a vote with a winner. It needs `AI_API_KEY` to work.
- **No shared playlist or poll feature yet.**
- **Rooms are never deleted** and anyone who knows a room code can join.
- **Real-world drift depends on each person's internet.** Video from a far-away server can buffer, and a buffering viewer falls behind until correction catches them up.

---

## Credits

Sample videos are the open Blender Foundation films hosted by Google's sample bucket. Movie details are sample data for demonstration.
