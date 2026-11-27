*This project has been created as part of the 42 curriculum by nbilyj, nbarbosa, gtourdia, kebertra.*

# SorryNotSorry

## Description

**SorryNotSorry** (SNS) is a real-time multiplayer card game website. Players shed their hand by matching the color or value of the top card, using action cards (Skip, Reverse, Draw 2, Wild, Wild Draw 4) to slow down their opponents. The first player with no card left wins.

It is the ft_transcendence project of the 42 Common Core (subject version 21.2): a full web application with a frontend, a backend split into microservices, a database, real-time communication and monitoring. Everything runs in Docker and starts with one command.

### Key features

- **Real-time multiplayer card game** for 2 to 4 players, played live over WebSockets on separate computers.
- **Rooms** with a name, a size, an optional password and a shareable 6-character code. The host picks the house rules: stacking, 7-0, jump-in, Wild +4 bluff challenge, catch a missed UNO.
- **AI opponents (bots)** that fill empty seats and play with human-like mistakes.
- **Ranked matchmaking** with an ELO rating, a leaderboard and a match history.
- **Spectator mode**: watch any game in progress, live.
- **Accounts**: sign-up and login with email and password (bcrypt), an HttpOnly JWT cookie, optional **two-factor authentication** (TOTP), profile, avatar upload, password change and account deletion.
- **Friends and chat**: friend requests in real time, direct messages with offline delivery, unread badges.
- **Customization**: 8 card skins and 5 table colors, saved per browser.
- **Responsive**: playable on desktop, laptop, tablet and phone, in landscape or portrait.
- **Monitoring**: Prometheus and Grafana, with alert rules.

---

## Table of contents

1. [Instructions](#instructions)
2. [Team information](#team-information)
3. [Project management](#project-management)
4. [Technical stack](#technical-stack)
5. [Architecture](#architecture)
6. [Database schema](#database-schema)
7. [Features list](#features-list)
8. [Game rules](#game-rules)
9. [Frontend: pages and behaviors](#frontend-pages-and-behaviors)
10. [REST API reference](#rest-api-reference)
11. [WebSocket reference](#websocket-reference)
12. [Friends system](#friends-system)
13. [Security](#security)
14. [Monitoring](#monitoring)
15. [Tests and CI](#tests-and-ci)
16. [Modules](#modules)
17. [Individual contributions](#individual-contributions)
18. [Known limitations](#known-limitations)
19. [Resources](#resources)

---

## Instructions

### Prerequisites

| Tool | Version | Why |
|---|---|---|
| Docker Engine | 24 or newer | runs every service |
| Docker Compose | v2 (`docker compose`) | starts the stack with one command |
| GNU Make | any | `make` shortcuts |
| OpenSSL | any | generates the self-signed TLS certificate (`make install`) |
| Node.js | **22.x** | only for `make lint` and `make test`, run on the host |
| Google Chrome | latest stable | supported browser |

Free ports on the host: **8080** (HTTP, redirects to HTTPS) and **8443** (HTTPS). Nothing else is published: Grafana and Prometheus are served over HTTPS by the gateway, at `/grafana/` and `/prometheus/`.

### Configuration

There are two kinds of configuration. `make install` creates both from templates, and never overwrites an existing file.

1. **`.env`** (ignored by Git), copied from **`.env.example`**: non-secret settings.

   | Variable | Default | Meaning |
   |---|---|---|
   | `DB_HOST`, `DB_PORT` | `postgres`, `5432` | database host and port, inside the Docker network |
   | `DB_NAME`, `DB_USER` | `transcendence_db`, `transcendence_user` | created on the first start of the database volume |
   | `HTTP_PORT`, `HTTPS_PORT` | `8080`, `8443` | public ports of the Nginx gateway |
   | `API_URL`, `WS_URL` | `https://localhost:8443/api`, `wss://localhost:8443/api/game/ws` | targets of the test scripts |
   | `NODE_TLS_REJECT_UNAUTHORIZED` | `0` | lets the **test scripts** accept the self-signed certificate. Never used by the services |

2. **`secrets/`** (ignored by Git), copied from **`secrets.example/`**: Docker secrets, mounted as files in `/run/secrets/` and never put in environment variables.

   | File | Content |
   |---|---|
   | `db_password.txt` | PostgreSQL password |
   | `db_url.txt` | `postgresql://<user>:<password>@postgres:5432/<db>?schema=public`, with the same user, password and database name |
   | `jwt_secret.txt` | key that signs the JWTs |
   | `grafana_admin_password.txt` | Grafana `admin` password (generated at random by `make`, not copied from the example) |
   | `prometheus_password.txt` | password asked by the gateway in front of Prometheus, user `admin` (generated at random by `make`) |
   | `prometheus_htpasswd` | the same password hashed for Nginx, rebuilt by `make` when `prometheus_password.txt` changes (then `docker compose restart gateway`) |

   The example values (`changeme`) are fine for a local evaluation. Change them anywhere else. Grafana applies the password of the secret on every start, so changing the file and restarting Grafana is enough.

Optional game-service variables (in `docker-compose.yml`, `game.environment`):

| Variable | Default | Meaning |
|---|---|---|
| `TURN_TIMEOUT_MS` | 20000 | length of a turn |
| `BLUFF_TIMEOUT_MS` | 10000 | time to accept or challenge a Wild +4 |
| `UNO_WINDOW_MS` | 5000 | time during which a forgotten UNO can be caught |
| `RECONNECT_GRACE_MS` | 30000 | time to come back after a disconnection before being removed |
| `GAME_JOIN_TIMEOUT_MS` | 15000 | a started game nobody joins is cancelled |
| `BOT_MIN_DELAY_MS`, `BOT_EXTRA_DELAY_MS` | 2500, 2000 | a bot thinks between 2.5 and 4.5 s |

### Run the project

```bash
git clone <repository-url> ft_transcendence
cd ft_transcendence
make up          # creates .env, secrets/ and the TLS certificate, builds and starts everything
```

Then open **https://localhost:8443**. The certificate is self-signed: accept the browser warning once.

The first start builds every image, which takes a few minutes. The database schema is pushed by Prisma when the services start.

### Make commands

| Command | What it does |
|---|---|
| `make` / `make all` | `install` and build the images (nothing is started) |
| `make install` | create what is missing: `.env`, `secrets/`, TLS certificate |
| `make up` | build and start the whole project in the background, **in production mode** |
| `make dev` | same, in development mode (hot reload). Never on a shared machine: it exposes the source code |
| `make down` / `make clean` | stop the project |
| `make ps` | state of the containers |
| `make logs` | follow the logs of every service |
| `make log SERVICE=game` | follow one service (`auth`, `user`, `chat`, `game`, `frontend`, `gateway`...) |
| `make lint` / `make lint-fix` | ESLint and Prettier check / auto-fix (Node 22 on the host) |
| `make test` | start the project, then run every test (see [Tests and CI](#tests-and-ci)) |
| `make seed PASSWORD=<pwd>` | create the debug users `alice`, `bob`, `charlie` and a sample conversation |
| `make seed-leaderboard PASSWORD=<pwd>` | create 10 ranked users to fill the leaderboard |
| `make fclean` | stop and **delete the volumes** (database, avatars) and the certificate |
| `make re` | `fclean`, then `all` |

### Development mode

`make up` always runs the **production** build: the frontend is a static Vite build served by Nginx, without source maps or debug tools, and the services run compiled JavaScript.

`make dev` adds `docker-compose.override.yml`: it builds the `dev` target of each image and mounts the sources, so the services reload on save (`tsx watch` for the backend, Vite for the frontend). The Vite dev server exposes the whole source code, so use it only on your own machine.

Plain `docker compose up` also loads the override (it is Docker's default), so prefer the Make commands.

In development mode, if the frontend keeps showing an old style after switching Git branches, restart it keeps showing an old style after switching Git branches, restart it with `docker restart ft_transcendence-frontend-1` (Vite cache inside Docker).

### Useful URLs

| URL | What |
|---|---|
| https://localhost:8443 | the website |
| https://localhost:8443/api/... | REST APIs, through the gateway |
| https://localhost:8443/adminer/ | Adminer, a database web client |
| https://localhost:8443/grafana/ | Grafana (user `admin`, password from `secrets/grafana_admin_password.txt`) |
| https://localhost:8443/prometheus/ | Prometheus (user `admin`, password from `secrets/prometheus_password.txt`) |

`make passwords` prints these URLs with their users and passwords (Grafana, Prometheus, Adminer).

---

## Team information

| Login | Role(s) | Responsibilities |
|---|---|---|
| **nbilyj** | _To complete by the team (e.g. Tech Lead, Developer)_ | Game service: rules engine, rooms, game WebSocket protocol, bots, matchmaking and ELO, reconnection and AFK handling, game tests. Later the frontend redesign (card skins, table colors, game effects, mobile layout) and the spectator page |
| **nbarbosa** | _To complete by the team (e.g. DevOps, Developer)_ | Infrastructure: Docker multi-stage builds, Compose, Docker secrets, Nginx gateway and HTTPS, CI pipeline, Prometheus and Grafana. Auth service (cookies, account deletion, password change), chat service (persistent DMs, offline delivery, friend event relay), Privacy Policy and Terms of Service pages |
| **gtourdia** | _To complete by the team (e.g. PO, Developer)_ | Frontend: friends drawer and chat UI, real-time friend requests and unread badges, home page, Rules page, leaderboard page, navbar drawer, debug header. Makefile rules (install, up/down, seed users, seed leaderboard) |
| **kebertra** | _To complete by the team (e.g. PM, Developer)_ | Frontend architecture: React Router tree, route guards, auth provider with the 2FA step, game and chat providers, WebSocket hook with reconnection, lobby and room pages, first game board, profile page with stats and history. `.env.example` and the idempotent Makefile |

> The subject requires PO, PM and Tech Lead roles to be stated clearly. The team must fill the "Role(s)" column above. The responsibilities column is written from the Git history.

---

## Project management

- **Work organization**: one feature per Git branch (`feat/...`, `fix/...`, `docs/...`). Each branch goes to `dev` through a GitHub pull request reviewed by another member, and `dev` goes to `main` for releases. Commit messages follow the Conventional Commits style (`feat(game): ...`, `fix(frontend): ...`).
- **Quality gate**: every pull request runs the CI pipeline (lint, security audit, unit and integration tests, Docker build and healthchecks, secret scanning). See [Tests and CI](#tests-and-ci).
- **Tools**: GitHub (repository, pull requests, reviews, Actions).
- **Meetings and communication**: _to complete by the team (e.g. weekly meeting, Discord server, task board used)._

---

## Technical stack

### Frontend

| Technology | Use |
|---|---|
| **React 18** + **TypeScript** | UI framework |
| **Vite 5** | dev server and production build |
| **React Router 6** | client-side routing, route guards |
| **Tailwind CSS 4** + **daisyUI 5** | styling, custom `sns` theme |
| Native **WebSocket** API | game and chat real-time channels |
| Google Font **Outfit** | typography |

### Backend

| Technology | Use |
|---|---|
| **Node.js 22** + **TypeScript** | runtime |
| **Fastify 5** | HTTP framework of every service |
| `@fastify/websocket` | WebSocket endpoints (game, chat) |
| `@fastify/jwt`, `@fastify/cookie` | JWT in an HttpOnly cookie |
| `@fastify/multipart`, `@fastify/static` | avatar upload and serving |
| **Prisma 7** | ORM, one schema shared by every service (`shared/prisma/schema.prisma`) |
| `bcrypt` | password hashing |
| `@otplib/preset-default`, `qrcode` | TOTP two-factor authentication |
| `prom-client` | Prometheus metrics (`shared/src/monitoring`) |

### Database

**PostgreSQL 16**. We chose a relational database because the data is relational: users, friendships (two users and a state), blocks, messages (sender and receiver) and matches. PostgreSQL gives unique constraints (one friendship per pair), cascading deletes (deleting an account removes its friendships and messages), serializable transactions (two users sending each other a request at the same time) and native arrays and JSON for match logs. Prisma gives typed queries shared by all the services.

### Infrastructure

| Technology | Use |
|---|---|
| **Docker** + **Docker Compose** | one container per service, one command to start |
| Docker **secrets** | passwords and keys as files, never in environment variables |
| **Nginx** | HTTPS gateway (TLS 1.2/1.3), reverse proxy, WebSocket upgrade |
| **Prometheus** + **Grafana** | metrics, dashboard, alerting |
| **Adminer** | database web client (development help) |
| **GitHub Actions** | CI |

### Why these choices

- **Fastify** rather than Express: built-in JSON schema validation (every body, param and query is validated by Ajv), good performance, a plugin system that fits small services.
- **Microservices**: auth, users, chat and game have different lifecycles (the game keeps state in memory and runs timers, chat keeps sockets open). Splitting them keeps each one small, and a crash in one does not take the others down.
- **Game state in memory, results in the database**: a turn must react in milliseconds. Live games live in the game service memory, and only the finished match is written to PostgreSQL.
- **JWT in an HttpOnly cookie**: JavaScript cannot read the token, which blocks token theft by XSS, and the same cookie authenticates both REST calls and WebSockets.
- **Tailwind + daisyUI**: one theme file controls every color, so the table colors and card skins could be added without touching the components.

---

## Architecture

```
                         Browser (React SPA)
                                 │  HTTPS 8443 / WSS
                                 ▼
                     ┌────────────────────────┐
                     │  Nginx gateway (TLS)    │  80 → 301 to HTTPS
                     └────────────────────────┘
   /            /api/auth/   /api/user/   /api/chat/ (+ /ws)   /api/game/ (+ /ws)   /uploads/   /adminer/
   │                │            │               │                     │                │           │
frontend:80      auth:3001    user:3004       chat:3003            game:3002         user:3004   adminer:8080
(static build)       │            │   │  POST /internal/events      │
                     │            │   └──────────► chat (friend events)
                     └────────────┴───────┬───────┴─────────────────┘
                                          ▼
                                 PostgreSQL 16 (Prisma)

      Prometheus scrapes /metrics of the 4 services → Grafana (both through the gateway: /prometheus/ and /grafana/)
```

| Service | Port | Responsibility |
|---|---|---|
| `gateway` | 80, 443 (host 8080, 8443) | TLS termination, routing, WebSocket upgrade, blocks `/api/*/metrics` and `/api/*/internal` from the outside (403) |
| `frontend` | 80 | serves the built React app |
| `auth` | 3001 | sign-up, login, logout, 2FA, password change, account deletion |
| `user` | 3004 | profiles, avatars, friends, leaderboard |
| `chat` | 3003 | direct messages (WebSocket + history), real-time friend events |
| `game` | 3002 | rooms, games, bots, matchmaking, ELO, spectators, match history |
| `postgres` | 5432 | database (internal only) |
| `adminer` | 8080 | database web client, behind the gateway |
| `prometheus`, `grafana` | none | monitoring, through the gateway (`/prometheus/` with a password, `/grafana/`) |

The `shared/` package holds the Prisma schema and client, the TypeScript types used by both frontend and backend (game state, WebSocket events, chat events) and the metrics helper.

Every backend service exposes `GET /health` (`{ "service": "<name>", "status": "ok" }`), used by the Docker healthchecks. The gateway only starts once all services are healthy.

---

## Database schema

```
┌──────────────────────────────┐        ┌─────────────────────────────┐
│ User                         │        │ Friendship                  │
├──────────────────────────────┤ 1    n ├─────────────────────────────┤
│ id            String (uuid)PK│◄───────┤ userId    String FK (sender)│
│ email         String  unique │◄───────┤ friendId  String FK (target)│
│ username      String  unique │        │ status    pending|accepted  │
│ password      String (bcrypt)│        │ createdAt DateTime          │
│ avatarUrl     String?        │        │ unique(userId, friendId)    │
│ twoFactorSecret        String?        └─────────────────────────────┘
│ twoFactorSecretEnabled Bool  │        ┌─────────────────────────────┐
│ elo           Int (1000)     │ 1    n │ DirectMessage               │
│ createdAt     DateTime       │◄───────┤ senderId    String FK       │
└──────────────────────────────┘◄───────┤ receiverId  String FK       │
        ▲            ▲                  │ content     String          │
        │            │                  │ messageType "text"|"game_invite"
        │            │                  │ gameRoomId  String?         │
        │            │                  │ delivered   Boolean         │
        │            │                  │ createdAt   DateTime        │
        │            │                  │ index(senderId, receiverId) │
        │            │                  │ index(receiverId, delivered)│
        │            │                  └─────────────────────────────┘
        │            │                  ┌─────────────────────────────┐
        │            └──────────────────┤ BlockedFriendship           │
        └───────────────────────────────┤ blockerId  String FK        │
                                        │ blockedId  String FK        │
                                        │ unique(blockerId, blockedId)│
                                        └─────────────────────────────┘
┌──────────────────────────────┐
│ Match                        │   players / ranking / winnerId hold user ids
├──────────────────────────────┤   (or bot ids "bot_..."), so a match keeps
│ id        String (uuid) PK   │   its history even after an account is deleted
│ mode      "classic"|"ranked" │
│ players   String[]           │
│ ranking   String[]           │   finishing order (classic: the winner only)
│ winnerId  String             │
│ chatLog   Json               │   in-game chat messages
│ moveLog   Json               │   every game action
│ startedAt DateTime           │
│ endedAt   DateTime           │
└──────────────────────────────┘
```

- Every foreign key to `User` uses `ON DELETE CASCADE`: deleting an account deletes its friendships, blocks and messages.
- Primary keys are UUIDs. Bots are not stored in `User`: their ids start with `bot_` and only appear in `Match`.
- Live rooms, games, the matchmaking queue and spectators are kept in the game service memory, not in the database.

---

## Features list

| Feature | Description | Main author(s) |
|---|---|---|
| Sign-up / login / logout | email + password, bcrypt, JWT in an HttpOnly cookie, validated on both sides | nbarbosa (back), gtourdia, kebertra (front) |
| Two-factor authentication | TOTP with QR code, enable/disable, 2FA step at login | nbarbosa (back), kebertra (front) |
| Password change, account deletion | with password (and 2FA code if enabled) | nbarbosa |
| Profiles and avatars | own and public profiles, username edit, avatar upload (PNG/JPG/WebP, 5 MB) | nbarbosa (back), kebertra (front) |
| Friends | requests, accept, decline, remove, real-time notifications | nbarbosa (back), gtourdia (front) |
| Direct chat | real-time messages, history, offline delivery, unread badges | nbarbosa (back), gtourdia (front) |
| Game engine | 108-card deck, every card effect, house rules | nbilyj |
| Rooms and lobby | create, join (list, code, password), host rules, bots | nbilyj (back), kebertra, nbilyj (front) |
| Real-time game | WebSocket protocol, turn timer, UNO call and catch, bluff challenge, reconnection, AFK | nbilyj |
| AI opponents | bots that play every rule with human-like mistakes | nbilyj |
| Ranked matchmaking and ELO | queue grouped by ELO, multi-player ELO update | nbilyj |
| Spectator mode | live games list and read-only board | nbilyj |
| Match history and stats | history, wins, losses, win rate, streak | nbilyj (back), kebertra (front) |
| Leaderboard | top players and own rank | nbarbosa / nbilyj (back), gtourdia (front) |
| Game UI and effects | felt table, animations, penalty bursts, bluff pop-up, playable-card highlight, multi-row hand | kebertra, nbilyj |
| Customization | 8 card skins, 5 table colors | nbilyj |
| Responsive design | desktop, laptop, landscape and portrait phones | kebertra, nbilyj |
| Legal pages | Privacy Policy and Terms of Service | nbarbosa |
| Infrastructure, HTTPS, secrets | Docker, Nginx, Compose, Makefile | nbarbosa, kebertra, gtourdia |
| Monitoring | Prometheus, Grafana dashboard, alert rules | nbarbosa |
| CI | lint, audit, tests, Docker build, secret scan | nbarbosa, nbilyj |

---

## Game rules

### Cards and setup

- **108 cards**. In each of the 4 colors (red, yellow, green, blue): one 0, two of each number from 1 to 9, two Skip, two Reverse and two Draw 2. Plus 4 Wild and 4 Wild Draw 4.
- Every player gets **7 cards**. The first card of the discard pile is never a Wild.
- Players take turns in a circle. The direction starts clockwise.

### Playing

- On your turn, play a card of the **current color** or of the **same value** as the top card, or any **Wild**.
- If you cannot (or do not want to) play, **draw** one card. Your turn ends.
- **Skip**: the next player loses their turn. **Reverse**: the direction changes. **Draw 2**: the next player draws 2 and loses their turn.
- **Wild**: you choose the next color. **Wild Draw 4**: you choose the color, and the next player draws 4 and loses their turn.
- **UNO**: when you are down to one card, say UNO.
- **Turn timer**: 20 s per turn. When it runs out, a card is drawn for you. Two timeouts in a row and you are removed from the game (AFK).

### Winning

- **Classic** (rooms): the first player with no card left wins, and the game ends.
- **Ranked** (matchmaking): the game goes on until one player is left. The finishing order is the ranking, and it changes everyone's ELO.

### House rules (chosen by the room host)

| Rule | Effect |
|---|---|
| **Stacking**: none / same type / any draw card | answer a +2 or +4 with another one instead of drawing. The first player who cannot answer draws the whole stack |
| **7-0** | playing a 7 swaps your hand with a player of your choice. Playing a 0 passes every hand to the next player, in the direction of play |
| **Jump-in** | play out of turn with the exact same card (color and value) as the top card. Play goes on from you |
| **Challenge a Wild +4** | a Wild +4 is only allowed without a card of the current color. The targeted player has **10 s** to accept or challenge. A bluff makes its player draw 4; a wrong challenge makes the challenger draw 6 |
| **Catch a missed UNO** | down to one card, say UNO within **5 s**, or any opponent can catch you and you draw 2 |

All rules are off by default.

### Bots

A bot plays after 2.5 to 4.5 s:
- it prefers action cards, then numbers, then wilds, but picks a random playable card 30 % of the time;
- it stacks when it can (and forgets 5 % of the time);
- it picks the color it has the most of after a Wild;
- with the 7-0 rule, it swaps with the player who has the fewest cards;
- it challenges a +4 more often when it holds the current color itself;
- it forgets to say UNO one time in ten.

Bots never get a turn timer and are never counted AFK.

---

## Frontend: pages and behaviors

### Routes

| Route | Access | Page |
|---|---|---|
| `/` | everyone | redirects to `/home` |
| `/home` | everyone | home page |
| `/rules` | everyone | game rules |
| `/leaderboard` | everyone (data needs a login) | top 10 and own rank |
| `/terms`, `/privacy` | everyone | Terms of Service, Privacy Policy |
| `/users/:id` | everyone | public profile |
| `/auth` (`?mode=register`) | visitors only (a connected user goes to `/home`) | sign-in / sign-up |
| `/play` | connected users (otherwise `/auth`) | lobby |
| `/play/rooms/:code` | connected users | waiting room |
| `/profile` | connected users | my profile |
| `/settings` | connected users | settings |
| `/games/:id` | connected users | game board |
| `/games/:id/spectate` | connected users | spectator view |
| any other URL | everyone | "not found" page inside the layout |

While the session is being checked (`GET /api/auth/me` on load), protected routes show a spinner instead of redirecting too early.

### Layout and navigation

- **Background**: a radial gradient in the chosen table color, with light rays and blurred cards.
- **Header** (sticky): the card-fan logo and "SORRY NOT SORRY", links Home / Play (connected only) / Leaderboard / Rules (the current page is a yellow pill), and on the right "Sign in" and "Sign up" for visitors, or the user's avatar and name with a menu (Profile, Settings, Log out). Under 1024 px the links move into a burger menu.
- **Footer**: logo, team, links to Terms of Service, Privacy Policy, Rules, Settings, Leaderboard and the GitHub profiles of the team.
- **Game pages** use a layout without footer. Below 760 px of height the header is hidden too, so the board has the whole screen.
- **"Back to game" banner**: on any other page while I still play a game, a banner says "You are still in a game" (or "It's your turn in your game!", pulsing) with a "Back to game" button. The game goes on without me in the meantime.
- **Friends button**: a vertical "Friends" tab on the right edge (connected users) opens the friends drawer (see [Friends system](#friends-system)).
- **Error toasts**: errors sent by the game or chat WebSocket appear bottom-right and disappear after 5 s or on click.
- **Real-time session**: as soon as a user is connected, one game WebSocket and one chat WebSocket stay open for the whole visit, whatever the page. They reconnect by themselves with an increasing delay (1 s, 2 s, 4 s... up to 10 s), except when the server refused the connection for good (invalid token). Several tabs or devices can be open at once: each one has its own sockets.

### Home (`/home`)

The big card-fan logo, "SORRY NOT SORRY", the "Play. Bluff. Win." headline, a "Play now" button (to `/play`, or to `/auth` for a visitor) and "How to play" (to `/rules`), plus badges for the main features. Cards float around on wide screens and are hidden on phones.

### Sign-in / sign-up (`/auth`)

- A fan of 7 cards alternating Sign-in and Sign-up. The front card holds the form, a click on another card brings it to the front, and the switch at the top left does the same. `?mode=register` opens on Sign-up.
- **Sign-up form**: username, email, password and confirmation, all validated in the browser before sending:
  - username: 3 to 20 letters (accents allowed), digits, `_`, `.` or `-`, no spaces;
  - email: valid address;
  - password: 8 characters or more;
  - the two passwords must match ("Passwords not matching.").
  On success the user is logged in and goes to `/home`. Server errors are shown in the card (e.g. "Email or username already taken").
- **Sign-in form**: email and password. "Invalid credentials" on failure. If the account has 2FA, the card switches to a **6-digit code** step. A wrong code shows "Invalid code"; an expired step (10 min) shows "Invalid or expired temporary token" and the user starts again.

### Lobby (`/play`)

From top to bottom:
1. **Title** "Game rooms" and a **"+ New room"** button. It opens a pop-up with name (1 to 30 characters), players (2, 3 or 4) and an optional password, then "Open the table". The creator lands in the room.
2. **Ranked game** banner with my ELO and **"Find a game"**. While searching, "Looking for an opponent of your level...", a pulsing ring and "Cancel". When a match is found I am sent to the game.
3. **Join with a code** banner: a 6-character code (letters and digits without the look-alikes I, O, 0, 1; typed in upper case) and an optional password. "Join" is enabled once the code has 6 characters.
4. **Open rooms**: the count and a "Refresh" button. Each room is a card with its name, 🔒 if private, mode, `#code`, one dot per seat (filled when taken), the host, the active rules ("Classic rules" when none) and "Join" ("Full" and disabled when full). A private room asks for its password in a pop-up. With no room, a 🃏 and "Create a room".
5. **Live games**: only shown when games are running. Each card has a pulsing "LIVE" dot, the mode, the players with their card count (the current player highlighted, a player at 1 card in yellow), and "👁 Watch", or "Back to my game" for my own game.

Rooms and live games refresh every 5 s. If I already am in a room or a new match starts, the lobby sends me there.

### Waiting room (`/play/rooms/:code`)

- Room name, mode badge, "Private" badge, and the **room code** on a white ticket to share.
- **Players**: avatar, name, "👑 Leader", "Bot", and dashed empty seats ("Waiting for a player..."). The leader can **"Add a bot"** (until the room is full) and **"Remove"** a bot.
- **Rules**: the stacking choice and four switches, each with an ⓘ help bubble. Only the leader can change them; the others see them read-only. Every change is shared live with everyone in the room.
- **Bottom**: "Leave", and for the leader "Start the game", disabled with "Add a player or a bot to start" while alone. Other players see "Waiting for the leader to start the game...".
- When the leader leaves, the next human becomes leader. When the last human leaves, the room is deleted.

### Game (`/games/:id`)

**Layout**
- A green felt table with a wooden edge.
- Opponents sit around it in turn order: 1 opponent on top, 2 on the left and right, 3 on the left, top and right. On a phone held upright they all sit in one row above the table.
- In the middle: the **draw pile** (a small stack), the **discard pile** with a ring and halo in the color to play, a pill with the color name ("Any color" before the first choice), and a dashed ring turning in the direction of play.
- Under the table, the **turn bar**: "Your turn!" (yellow, pulsing), or the avatar and name of the player ("is playing", or "is thinking" for a bot), the countdown, and the direction ("↻ Clockwise" / "↺ Counter-clockwise").
- At the bottom, **my hand**, sorted by color then value, slightly curved like held cards.

**My hand**
- On my turn, the cards I can play rise with a yellow glow. The others are dimmed and cannot be clicked. Out of my turn the hand is greyed, except a jump-in copy of the top card when that rule is on.
- A big hand goes on several overlapping rows, so each card keeps at least 45 % visible. From 3 rows the cards shrink (80 %, then 70 %) so the hand always fits.
- Clicking a **Wild** opens the color picker (four big colored squares). Clicking a **7** with the 7-0 rule opens the list of opponents to swap with (name and card count). Both pop-ups can be cancelled.

**Drawing**
- The draw pile can be clicked on my turn, unless a Wild +4 waits for an answer.
- When no card fits, the pile glows and hops with "Nothing to play: draw!", or "Take +N" when a stack is waiting.

**Opponents**
- Each seat shows the hidden hand as a fan of card backs (7 at most), the avatar, the name and "N cards" ("1 card" in yellow).
- The current player's seat has a pulsing yellow ring. A removed player is faded and grey.
- When an opponent is down to one card and has not said UNO, a red **"Catch UNO!"** button appears on their seat for 5 s.

**Effects and announcements**
- A played card flies from the player to the discard pile in an arc and lands with a shock wave. Drawn cards slide from the pile to the hand.
- **Penalties**: when someone draws 2 or more (Draw 2, Wild +4, a stack, a missed UNO), a giant "+2" / "+4" bursts in the middle with the reason ("Draw two!", "Wild +4!", "The stack lands!", "Forgot to say UNO!"). When it is me, it is red with "For you!", the screen edges flash red and the board shakes.
- **Callouts**: "⊘ Skip!", "⇄ Reverse!", "<player> chose <color>", "⚡ Jump-in by <player>!", "Stacked! +N waiting", hands swapped, "Every hand moves on!", "<player> finished #N", "<player> left the table (AFK)".
- **Turn pop-up**: "Your turn!" or "<player>'s turn" in a corner for 1.8 s at each new turn.
- **UNO pop-ups**: "<player>: UNO!", "You said UNO!", or "<catcher> caught <player>! +2 cards".

**UNO**
- With one card left (and the rule on), a red wobbling **"UNO!"** button appears next to my hand for 5 s.

**Bluff challenge (Wild +4)**
- The targeted player gets a pop-up "<player> hits you with a +4!". It shows the card, explains the rule and the stakes, has a 10 s countdown bar and two buttons, "Accept +4" and "Challenge!". Without an answer, the +4 is accepted.
- The other players see "<target> may challenge <player>'s +4..." with the same countdown.
- The result bursts in the middle: "BLUFF!" (the player of the +4 draws 4) or "No bluff!" (the challenger draws 6).

**End of the game**
- Confetti and a pop-up with 🏆 and "You won!" or "<player> won the game", then "Back to the lobby in Ns" with a progress bar (5 s), and "Back now".

**Errors**
- Opening a game that does not exist or is over shows a full screen "Game not found" with "Back to the lobby". A game of other players shows "Not your game".
- While the first state arrives: "Joining the game..." (or "Connecting..."), with a link back to the lobby.
- Reloading the page brings the player back into the same game (the game id is kept in the browser).

### Spectator view (`/games/:id/spectate`)

- A "👁 Spectating · A vs B vs C" banner and a "Leave" button.
- The real board in read-only mode. Every hand is hidden, and all players sit around the table (a 4th player at the bottom).
- Every update is live: timer, turn bar, flying cards, bursts, callouts and the bluff banner. No action is possible: no draw, no "Catch UNO", no pop-up.
- At the end, the winner pop-up sends back to the lobby. A game that does not exist shows "Game not found". Watching my own game redirects me to `/games/:id`.

### Profile (`/profile`, `/users/:id`)

- Avatar (or a letter on a color picked from the username), username, "You" badge on my profile, "Member since <date>".
- On my profile only:
  - **"Edit profile"**: a pop-up to change the username (same rules as sign-up, "Username already taken" on conflict) and the avatar (PNG, JPG or WebP, 5 MB at most);
  - **stats**: games played, wins and losses, win rate, current win streak;
  - **match history**: date, mode, my place and the winner.
- An unknown id shows "Oops!" and "User not found." with a link home.

### Leaderboard (`/leaderboard`)

The top 10 players by ELO: rank, username ("You" on my own line, highlighted) and ELO. Players with the same ELO share the same rank. If I am not in the top 10, my own line is added at the bottom with my real rank. Bots are never listed. A warning is shown if the data cannot be loaded.

### Settings (`/settings`)

- **Table color**: Midnight (default), Crimson, Ocean, Plum, Graphite. The whole site changes at once.
- **Card skin**: 8 skins with a preview hand and card back for each, used everywhere (hand, piles, opponents, flights, home):
  - **SNS** (default): white edge and the value in a diamond;
  - **Game Boy**: colored shell, tinted screen, pixel sprites;
  - **Win95 Vapor**: a tinted window with a synthwave screen;
  - **Ukiyo-e**: seigaiha waves and color kanji;
  - **Risograph**: one flat ink per color;
  - **Art Deco**: precious lacquers;
  - **Pop Art**: Ben-Day dots and comic bursts;
  - **Paper cut**: a paper landscape in the card color.
- Both choices are saved in the browser (`localStorage`), apply before the first render (no flash), and change nothing for the other players.
- **Change password**: current password, new password (8 characters or more, different from the current one), confirmation, and a 2FA code if enabled.
- **Two-factor authentication**: status badge. **Enable** shows a QR code to scan with an authenticator app (Google Authenticator, Authy...), then asks a first code to confirm. **Disable** asks the password and a code.
- **Delete account**: a confirmation pop-up asks the password (and a 2FA code if enabled). The account and everything linked to it are erased, and the user is logged out.

### Rules, Terms, Privacy

- `/rules` explains the cards, the turns, every house rule, the timers and ranked mode.
- `/terms` and `/privacy` are full pages about this project: data collected (email, username, avatar, games, messages), how it is used and stored, cookies (one HttpOnly authentication cookie, plus local settings), user rights (edit, delete the account) and contact.

### Accessibility and responsive design

- Works from 360 px wide phones to wide desktops, in portrait and landscape, with no horizontal scrolling. The board adapts to short screens (laptops, landscape phones) and narrow ones.
- Clickable cards are real buttons for the keyboard (Tab, Enter, Space) with accessible names ("Play red 7").
- Pop-ups use native `<dialog>`, live areas use `role="status"`, and decorative elements are hidden from screen readers.
- Animations are turned off for users who ask for reduced motion.

---

## REST API reference

Every route is reached through the gateway at `https://localhost:8443/api/<service>/...`.

**Authentication.** Routes marked 🔒 need the `access_token` cookie set by login or sign-up (a JWT valid 7 days, `HttpOnly`, `Secure`, `SameSite=Lax`). The token is never in a response body. Without a valid token, or with a revoked one (after a logout, a password change or a 2FA change), they answer **401**.

**Protections on every route.**
- `POST`, `PUT`, `PATCH`, `DELETE` sent from a page of another website (an `Origin` header naming another host) answer **403** `"Cross-site request refused"`.
- Login, sign-up and 2FA routes are limited to 30 attempts per minute per IP, after which they answer **429** `"Too many requests, try again in a minute"`.

**Error format.**
- Errors raised by a route: `{ "error": "<message>" }`.
- Validation errors (bad body, param or query, checked by JSON schema) and authentication errors: **400** / **401** with `{ "statusCode", "code", "error", "message" }`, for example `"message": "body/username must match pattern ..."`.
- Unexpected errors: **500** `{ "error": "Internal server error" }`. No stack trace is ever sent.
- Database conflicts caught globally: **409** `"Resource already exists"`, **404** `"Resource not found"`.

**Health.** `GET /api/<service>/health` (no auth) → **200** `{ "service": "<name>", "status": "ok" }`. `/metrics` and `/internal/*` are **403** from outside the Docker network.

### Auth service: `/api/auth`

| Method & path | Auth | Body | Responses |
|---|---|---|---|
| `POST /signup` | — | `email` (valid email, case-insensitive), `username` (3-20 letters, digits, `_ . -`, starting and ending with a letter or digit; unique without case), `password` (8 to 72 characters) | **201** `{ user }` + cookie · **400** validation · **409** `"Email or username already taken"` (also in another case) |
| `POST /login` | — | `email`, `password` | **200** `{ user }` + cookie · **200** `{ requiresTwoFactor: true, tempToken }` when 2FA is on (no cookie; `tempToken` valid 10 min, single use, only accepted by `/2fa/validate`) · **401** `"Invalid credentials"` |
| `POST /logout` | — | — | **200** `{ message: "Logged out" }`, cookie cleared. Revokes every session of the user, on every device |
| `GET /me` | 🔒 | — | **200** `{ user }` · **404** `"User not found"` |
| `POST /password` | 🔒 | `currentPassword`, `newPassword` (8+), `code` (6 digits, required if 2FA is on) | **200** `{ message: "Password updated successfully" }` · **400** `"New password must be different from current password"` · **401** `"Invalid current password or 2FA code"` · **404** `"User not found"` |
| `DELETE /account` | 🔒 | `password`, `code` (if 2FA) | **200** `{ message: "Account deleted" }`, cookie cleared · **401** `"Invalid password or 2FA code"` · **404** `"Account already deleted"` |
| `POST /2fa/enable` | 🔒 | — | **200** `{ qrCode }` (data URL of the QR code; the secret is stored but not active yet) · **409** `"2FA is already enabled"` · **404** |
| `POST /2fa/verify` | 🔒 | `code` (6 digits) | **200** `{ message: "2FA enabled", user }` · **401** `"Invalid code"` · **404** |
| `POST /2fa/validate` | — | `tempToken`, `code` | **200** `{ user }` + cookie · **401** `"Invalid or expired temporary token"` (also after use, or after 5 wrong codes), `"Invalid code"` (also a code already used) · **404** |
| `POST /2fa/disable` | 🔒 | `password`, `code` | **200** `{ message: "2FA disabled", user }` · **401** `"Invalid password or TOTP code"` · **404** |

`user` = `{ id, email, username, avatarUrl, createdAt, elo }` (plus `twoFactorSecretEnabled` on login and `/me`). The password and the 2FA secret are never returned.

### User service: `/api/user`

`profile` = `{ id, username, avatarUrl, createdAt, elo }`.

| Method & path | Auth | Body / params | Responses |
|---|---|---|---|
| `GET /profile/:id` | — | `id`: UUID | **200** `{ profile }` · **400** bad UUID · **404** `"User not found"` |
| `GET /profile` | 🔒 | — | **200** `{ profile }` (mine) · **404** |
| `PUT /profile` | 🔒 | `{ username }` (3-20 letters, digits, `_ . -`, starting and ending with a letter or digit; no other field allowed) | **200** `{ updatedProfile }` · **400** validation · **409** `"Username already taken"` · **404** |
| `PUT /profile/avatar` | 🔒 | multipart form, field `file`: `.png`, `.jpg`, `.jpeg` or `.webp`, 5 MB max | **200** `{ profile }` (the old avatar file is deleted) · **400** `"Request must be multipart/form-data"`, `"No file uploaded"`, `"Invalid file type"` · **413** `"File too large"` · **404** |
| `GET /users/by-username/:username` | 🔒 | — | **200** `profile` (case-insensitive search) · **404** `"User not found"` |
| `GET /friends` | 🔒 | — | **200** `{ friends: profile[] }` (accepted, both directions) |
| `GET /friends/requests/received` | 🔒 | — | **200** `{ receivedRequests: profile[] }` |
| `GET /friends/requests/sent` | 🔒 | — | **200** `{ sentRequests: profile[] }` |
| `POST /friends/request/:id` | 🔒 | `id`: target UUID | **200** `{ friendship }` · **400** `"Could not send friend request"` (myself, a block either way, or a request/friendship already exists in either direction) · **404** `"Target user not found"` · **409** concurrent conflict |
| `POST /friends/accept/:id` | 🔒 | `id`: the sender's UUID | **200** `{ friendship }` · **404** `"Friend request not found"` |
| `DELETE /friends/:id` | 🔒 | `id`: the other user's UUID | **200** `{ message: "Friendship deleted" }`. Removes a friend, declines a received request or cancels a sent one · **404** `"Friendship not found"` |
| `GET /leaderboard?limit=N` | 🔒 | `limit` 1-100, default 10 | **200** `{ leaderboard: [{ rank, id, username, avatarUrl, elo }] }`, ties share a rank, bots excluded |
| `GET /leaderboard/me` | 🔒 | — | **200** `{ rank, id, username, avatarUrl, elo }` · **404** |

`friendship` = `{ id, userId, friendId, status: "pending" | "accepted", createdAt }`. Uploaded avatars are served at `/uploads/avatars/<file>` and kept in the `user_uploads` volume.

### Chat service: `/api/chat`

| Method & path | Auth | Params | Responses |
|---|---|---|---|
| `GET /conversations/:otherUserId/messages?before=<ISO date>` | 🔒 | `otherUserId`: UUID; `before`: optional ISO 8601 date, for older pages | **200** `{ messages }`: the 50 latest messages of the conversation (older than `before`), oldest first · **400** bad UUID or `"Invalid 'before' timestamp"` · **401** `"Unauthorized"` · **403** `"Access denied: user is blocked"` |

`message` = `{ id, senderId, receiverId, content, messageType: "text" | "game_invite", gameRoomId, createdAt, delivered }`.

Internal only (403 through the gateway): `POST /internal/events` `{ targetUserId, event }`. The user service calls it to push friend events onto the chat socket of a connected user → **200** `{ delivered: true | false }` · **400** `"Invalid internal event payload"`.

### Game service: `/api/game`

| Method & path | Auth | Body | Responses |
|---|---|---|---|
| `GET /games/rooms` | 🔒 | — | **200** `RoomInfo[]`: `{ code, name, hasPassword, leaderId, maxPlayers, players: [{ id, username }], mode, settings }` (passwords never sent) |
| `GET /games/live` | 🔒 | — | **200** `[{ id, mode, players: [{ userId, username, cardCount, isCurrentTurn }] }]`, games in progress, no card is exposed |
| `GET /games/history` | 🔒 | — | **200** `[{ id, mode, players, ranking, winnerId, startedAt, endedAt }]`, my finished games, newest first |
| `POST /games/rooms` | 🔒 | `name` (1-50), `mode` (`classic`), `maxPlayers` (2-4), `password?` | **201** `{ roomCode }` · **400** `"Room name cannot be empty"`, `"Ranked games are only available through matchmaking"`, `"Max players must be between 2 and 4"` · **404** `"User not found"` |
| `POST /games/create` | 🔒 | `participants` (2-4 `{ id }`, the creator included), `mode` (`classic`), `settings?` | **201** `{ gameId }` · **400** `"Duplicate participants are not allowed"`, `"Ranked games are only available through matchmaking"`, `"Creator must be a participant"`, `"Invalid game settings"` |

The website creates rooms and games through the WebSocket. The two `POST` routes are kept for scripts and tests.

---

## WebSocket reference

There are two WebSockets, both authenticated by the `access_token` cookie (the chat one also accepts `?token=`). All messages are JSON objects with a `type`.

### Game socket: `wss://<host>/api/game/ws`

**Connection**
- The server answers `{ "type": "connected" }` when it accepts the socket.
- No cookie: `error "Unauthorized"` and close. Invalid token: `error "Invalid token"` and close.
- **Several sockets per user.** Each tab or device has its own socket and receives the user's events (room, game, matchmaking). A user leaves the queue or a room only when their last socket closes. The messages of one socket are handled one at a time, in order. Every socket is pinged every 30 s: one that did not answer the previous ping is closed.
- Malformed messages get `error "Invalid JSON"`, `"Invalid message"` or `"Invalid message format"`.

**Rooms (client → server)**

| Message | Payload | Answer / effect |
|---|---|---|
| `create_room` | `name`, `mode: "classic"`, `maxPlayers` 2-4, `password?` | `room_updated { room }` to the creator, who is the leader · `error` `"Ranked games are only available through matchmaking"`, `"User not found"` |
| `join_room` | `roomCode`, `password?` | `room_updated` to everyone in the room · `error` `"Can not find room with code X"`, `"Already in room"`, `"Max player capacity has already been reached for this room"`, `"Password is incorrect"` |
| `leave_room` | `roomCode` | `room_updated` to the others. The next human becomes leader; an empty room is deleted |
| `update_room` | `roomCode`, `settings` | `room_updated` to everyone · `error` `"Only the leader can update settings"`, `"Room not found"` |
| `add_bot` | `roomCode` | a bot joins (Alice, Bob, Charlie...) · `error` `"Only the owner can add bots"`, `"Max player capacity has already been reached for this room"` |
| `remove_bot` | `roomCode`, `botId` | `error` `"Only the owner can remove bots"`, `"Not a bot"` |
| `start_game` | `roomCode` | `game_started { gameId }` to every human of the room, and the room is deleted · `error` `"Only the leader can start"`, `"Need at least 2 players"` |

**Matchmaking (client → server)**

| Message | Answer / effect |
|---|---|
| `join_queue` | `queue_joined { elo }` · `error` `"Already in queue"`, `"Already in a game"` |
| `leave_queue` | `queue_left` · `error` `"Not in queue"` |

Every 2 s the server tries to form a ranked game of 4 players whose ELO spread fits everyone's range. Each player accepts ±100 ELO, +50 every 10 s of waiting, 500 at most. After 20 s of waiting a player accepts 3 players, after 40 s just 2. When a group is found, each player gets `match_found { gameId, players: [{ id, username, elo }] }`.

**In a game (client → server)**

| Message | Payload | Notes |
|---|---|---|
| `join_game` | `gameId` | sends back the current `game_updated`. Also used after a reload · `error` `"Game not found"`, `"You are not part of this game"` |
| `play_card` | `gameId`, `cardId`, `chosenColor?`, `targetUserId?` | `chosenColor` required for wilds, `targetUserId` for a 7 (7-0). Out of turn = jump-in · `error "Invalid move"` |
| `draw_card` | `gameId` | takes the whole stack if one is waiting · `error "Cannot draw card"` |
| `call_uno` | `gameId` | `error` `"Nothing to call"`, `"Player already called UNO or not in UNO state"` |
| `catch_uno` | `gameId`, `targetUserId` | `error` `"You cannot catch yourself"`, `"Target is not part of this game"`, `"Player already called UNO or not in UNO state"` |
| `challenge_bluff` | `gameId` | only the targeted player · `error` `"No bluff to challenge"`, `"Only the targeted player can respond to this card"` |
| `accept_wild_draw4` | `gameId` | only the targeted player · `error` `"Nothing to accept"`, `"Only the targeted player can respond to this card"` |
| `chat_message` | `gameId`, `content` (1-500 characters) | in-game chat, kept in the match log |
| `spectate_game` | `gameId` | `spectate_started { state }`, then every `game_updated` · `error` `"Game not found"` (or over), `"You are a player in this game"` |
| `leave_spectate` | `gameId` | stops the updates |

**Server → client**

| Event | Payload | When |
|---|---|---|
| `room_updated` | `room: RoomInfo` | any change in my room |
| `game_started` | `gameId` | the leader started the game |
| `game_updated` | `state: GameState` | after every change: move, timer, kick, reconnection, UNO window closing |
| `player_joined` | `userId` | a player (re)joins the game |
| `player_left` | `userId`, `reason` | `"disconnected"` (may come back), `"afk"` or `"abandoned"` (removed) |
| `uno_called` / `uno_caught` | `userId` / `targetUserId`, `catcherUserId` | notifications (also in `lastActions`) |
| `bluff_result` | `challengerUserId`, `targetUserId`, `wasBluff`, `penaltyCount` | notification |
| `chat_message` | `userId`, `username`, `content` | in-game chat |
| `game_ended` | `winnerId`, `ranking` | game over, after the final `game_updated` |
| `elo_updated` | `changes: [{ userId, oldElo, newElo }]` | after a ranked game |
| `queue_joined`, `queue_left`, `match_found` | see Matchmaking | |
| `spectate_started` | `state` | start of spectating |
| `error` | `message` | my last message was refused |

**`GameState`** is the whole truth: the client replaces its state with it on each `game_updated` and never patches it. Fields:
- `id`, `mode`, `status` (`in_progress` / `finished`), `settings`;
- `players[]`: `userId`, `username`, `hand`, `isCurrentTurn`, `disconnected`. Each player sees their own cards; other hands are placeholders, so only the count is meaningful;
- `topCard`, `currentColor` (the color to follow, differs from `topCard.color` after a wild), `direction` (1 / -1), `pendingDrawCount` (stack size), `drawPileCount`, `discardPile`;
- `ranking`, `winnerId`;
- `lastActions[]`: what produced this state. Each action has an increasing `seq` (clients play each action once) and `auto: true` when done by a timer. Types: `card_played`, `cards_drawn` (with a `reason`: `voluntary`, `stack`, `draw2`, `wild_draw4`, `bluff_penalty`, `uno_penalty`, `afk`; the drawn `cards` only for the player who draws), `hands_swapped`, `hands_rotated`, `uno_called`, `uno_caught`, `bluff_challenged`, `wild_draw4_accepted`, `player_finished`, `player_kicked`;
- `turnTimeLeftMs` (null for a bot or while a +4 waits);
- `pendingWildDraw4` `{ playerId, targetId, timeLeftMs }`;
- `unoVulnerable` (players who can be caught);
- `reconnecting` (players within the 30 s grace).

**Disconnections**
- A player whose socket drops stays in the game for **30 s** (`reconnecting`). Coming back with `join_game` restores everything.
- After 30 s they are removed (`abandoned`). Two turn timeouts in a row also remove a player (`afk`). On their turn the game moves on at once.
- When only one player is left, the game ends.
- A game nobody joins within 15 s of its start is cancelled.

**End of a game.** The final state and `game_ended` are sent, then the match is saved (`Match` table, with the chat and move logs). For a ranked game, ELO is updated and `elo_updated` is sent.

**ELO.** Every player starts at 1000. A ranked game of N players counts as every pair: each pair is a duel won by the better-placed player, with the standard expected score (`1 / (1 + 10^((Eb - Ea) / 400))`) and K = 16 / (N - 1). ELO never goes below 0.

The full guide for frontend developers is in [`game-websocket.md`](game-websocket.md).

### Chat socket: `wss://<host>/api/chat/ws`

**Connection.** No token: closed with code 1008 `"Token missing"`. Invalid token: 1008 `"Invalid token"`. On connection, every message received while offline is delivered, oldest first, and marked delivered.

**Client → server**

| Message | Payload | Answer |
|---|---|---|
| `direct_message` | `receiverId` (UUID), `content` (1-2000 characters, not blank), `messageType?` (`"text"` or `"game_invite"`), `gameRoomId?` (100 characters max) | the saved message is echoed to the sender and pushed to the receiver if online, else kept for later |

Errors (`{ type: "error", message }`): `"Invalid JSON format"`, `"Invalid message payload"`, `"Invalid gameRoomId format"`, `"Cannot send message to yourself"`, `"Cannot send message: user is blocked"`, `"Recipient not found"`, `"Failed to send message"`.

**Server → client**

| Event | Payload |
|---|---|
| `direct_message` | the message (`id`, `senderId`, `receiverId`, `content`, `messageType`, `gameRoomId`, `createdAt`) |
| `friend_request_received` | `sender: profile` |
| `friend_request_accepted` | `friend: profile` |
| `friend_removed` | `userId` |
| `error` | `message` |

---

## Friends system

**Flow.** A friendship is one row `Friendship(userId → friendId)`.
1. A sends a request to B: a `pending` row A → B is created, and B gets `friend_request_received` in real time.
2. B accepts: the row becomes `accepted`, and A gets `friend_request_accepted`.
3. B declines, or A cancels, or either removes the friend later: the row is deleted (`DELETE /friends/:id` works in both directions), and the other side gets `friend_removed`.

**Rules (server)**
- No request to myself.
- No request if either user has blocked the other.
- No request if any row already exists between the two users, in either direction.
- The check and the insert run in a **serializable transaction**, so A → B and B → A sent at the same time cannot create two rows. Accepting is an atomic `pending → accepted` update, so a double click cannot accept twice.

**Real time.** The user service makes the change in the database, then calls the chat service (`POST /internal/events`, unreachable from outside). The chat service pushes the event onto the target's chat socket if it is connected. If not, the change simply shows on their next load.

**Frontend: the Friends drawer** (the vertical "Friends" tab on the right)
- **Add a friend**: type a username → the user is looked up (`/users/by-username`) and a request is sent. "Cannot add yourself as a friend." for myself, and a confirmation when the request is sent.
- **Friend requests**: each received request with **Accept** (✓) and **Decline** (✗). New requests appear live, with a badge on the tab.
- **Friends list**: avatar and name. A click opens the **chat** with that friend; a **remove** button asks for confirmation.
- **Chat**: the history loads from the REST route, new messages arrive live, and unread messages show a badge on the friend until the chat is opened. On phones the chat replaces the drawer, with a "← Friends" back button.
- A friend removed while their chat is open closes the chat.

---

## Security

- **HTTPS everywhere**: Nginx serves TLS 1.2/1.3 only (`HIGH:!aNULL:!MD5`), and port 80 redirects to HTTPS. Inside the Docker network, services talk in plain HTTP, as the subject allows.
- **Passwords**: hashed and salted with bcrypt (cost 10), never returned by the API.
- **Sessions**: JWT signed with a secret from a Docker secret (a service refuses to start without it), valid 7 days, stored in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie that JavaScript cannot read, and never sent in a response body.
- **Revocation**: each session carries the user's `tokenVersion`. Logout, a password change or a 2FA change bumps it, and every older session is refused by every service, sockets included. The browser making the change gets a fresh session.
- **2FA step**: a separate 10-minute token signed with its own key, so no other service accepts it as a session. It works once, a TOTP code cannot be replayed, and 5 wrong codes burn it.
- **Brute force**: login, sign-up and 2FA are limited to 30 attempts per minute per IP. A login takes the same time whether the email exists or not, so accounts cannot be guessed from timing.
- **Identities**: emails and usernames are unique without case, and stored normalized.
- **Cross-site**: writes and WebSocket connections coming from another website are refused (`Origin` check), on top of the `SameSite` cookie.
- **WebSockets**: frames of 16 KB at most, flood limits per socket (game: bursts of 200 then 50 messages/s; chat: 20 then 5/s), every message validated, and a malformed message can never stop a service. Direct messages are only allowed between friends.
- **Headers**: HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` on the API, nginx version hidden, and a strict Content-Security-Policy on the site (scripts from the site only, no framing).
- **Production build**: `make up` serves the static Vite build (no source code, no source maps, no debug tools); the development server is only started by `make dev`.
- **2FA**: TOTP (RFC 6238), compatible with any authenticator app.
- **Validation on both sides**:
  - in the browser, `required`, `minLength`, `maxLength`, `pattern` and type checks on every form;
  - on the server, a JSON schema on every route (Ajv), with `additionalProperties: false` where it matters, UUID formats, and type checks on every WebSocket message.
- **Secrets**: database password, database URL, JWT key and Grafana password are Docker secrets read from `/run/secrets`. `.env` and `secrets/` are ignored by Git, and the CI scans every push for leaked secrets (gitleaks).
- **SQL injection**: every query goes through Prisma, with parameterized queries.
- **XSS**: React escapes every text, and no user content is rendered as HTML.
- **Uploads**: extension whitelist, the first bytes must be a real PNG, JPEG or WebP image of the announced type, 5 MB limit (also enforced by Nginx), files renamed `<userId>-<timestamp>`, the old file deleted, and partial files cleaned up on error.
- **Internal surfaces**: `/metrics` and `/internal/*` are refused by the gateway (403). Prometheus, Grafana and PostgreSQL are not exposed publicly.
- **Game integrity**: the server is authoritative. Every move is checked by the rules engine, and a client never sees the other players' cards (hands are replaced by placeholders before sending).
- **Concurrency**: messages of a socket handled in order, serializable friend transactions, atomic accepts, and per-game timers so simultaneous actions cannot corrupt a game.

---

## Monitoring

- **Prometheus** scrapes `/metrics` of the four services (`auth`, `game`, `chat`, `user`) through `prom-client`: HTTP request count and duration by route and status, CPU and Node.js memory.
- **Alert rules** (`monitoring/prometheus/alert_rules.yml`):
  - `ServiceDown`: a service unreachable for 30 s;
  - `HighHttpErrorRate`: more than 0.05 5xx errors per second for 1 min;
  - `HighResponseLatency`: p90 over 1 s for 1 min.

  There is no Alertmanager: firing alerts are shown in Prometheus only, at https://localhost:8443/prometheus/alerts (no mail or chat notification).
- **Grafana** is provisioned automatically with the Prometheus data source and the "Transcendence - Mission Control" dashboard: service status, HTTP error rate, 5xx errors, total traffic, errors by code and service, p95/p99 latency, CPU per core and V8 heap.
- **Access**: Grafana and Prometheus listen on `127.0.0.1` only. Grafana sign-up is disabled, and the admin password is a Docker secret.

More details in [`monitoring/README.md`](monitoring/README.md).

---

## Tests and CI

`make test` starts the project and runs `npm run test-all`. The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and pull request.

| Suite | Command | What it checks |
|---|---|---|
| Lint | `npm run lint` | ESLint (no warning allowed) and Prettier on the whole repository |
| Game engine | `npm run test-game` | deck, every card effect, every house rule, end conditions |
| AI | `npm run test-ai` | bot choices (cards, colors, bluffs, UNO, swaps) |
| Bots e2e | `npm run test-ai-e2e` | games with bots over a real WebSocket server |
| Rooms | `npm run test-rooms` | room lifecycle on the running stack |
| Game integration | `npm run test-game-integration` | REST + WebSocket on the running stack |
| Game actions e2e | `npm run test-game-actions` | timers, AFK, bluff, UNO window, jump-in, reconnection, end of game |
| Reconnection | `npm run test-reconnect` | grace period, kick after timeout |
| WebSocket session | `npm run test-ws-session` | one socket per user, reload detection |
| Spectators | `npm run test-spectator` | spectate, live updates, hidden hands |
| Matchmaking | `npm run test-matchmaking`, `test-matchmaking-e2e`, `test-queue` | ELO ranges, group sizes, queue |
| ELO | `npm run test-elo` | rating changes |
| Chat | `npm run test-chat` | chat socket, messages, offline delivery |
| API | `npm run test-api` | every route of auth and user, positive and negative cases |
| E2E | `npm run test-e2e` | gateway routing, sign-up, login, `/me`, 401 and 409 cases |

The CI also runs `npm audit --audit-level=high`, builds every Docker image and checks their healthchecks, and scans for secrets with gitleaks.

---

## Modules

The subject asks for **14 points** (Major = 2, Minor = 1); bonus modules count up to +5. We claim the modules below.

| # | Module | Type | Pts | How it is implemented | Who |
|---|---|---|---|---|---|
| 1 | **Web** — frameworks for frontend and backend | Major | 2 | React 18 (frontend) and Fastify 5 (every backend service) | all |
| 2 | **Web** — real-time features with WebSockets | Major | 2 | game socket (rooms, game, matchmaking, spectators) and chat socket (messages, friend events). Broadcast to rooms and spectators, reconnection with a grace period, dead-socket detection, offline message queue | nbilyj, nbarbosa, kebertra, gtourdia |
| 3 | **Web** — users interacting with other users | Major | 2 | direct chat, public profiles (`/users/:id`), friends system (add, accept, remove, list) | nbarbosa, gtourdia, kebertra |
| 4 | **Web** — ORM | Minor | 1 | Prisma 7 with one shared schema, typed client in every service, transactions | nbarbosa, nbilyj |
| 5 | **User management** — 2FA | Minor | 1 | TOTP with QR code, verify, login step with a temporary token, disable; required for password change and deletion when on | nbarbosa, kebertra |
| 6 | **User management** — game statistics and match history | Minor | 1 | every match saved; history, wins, losses, win rate, streak on the profile; ELO and leaderboard with own rank | nbilyj, kebertra, gtourdia |
| 7 | **AI** — AI opponent | Major | 2 | bots that play every card and every house rule (stacking, 7-0, bluff challenge, UNO), with random mistakes so they can lose and win; see [Bots](#bots) | nbilyj |
| 8 | **Gaming** — complete web-based game | Major | 2 | the card game: clear rules, win conditions, live matches | nbilyj, kebertra |
| 9 | **Gaming** — remote players | Major | 2 | each player on their own computer over WebSocket; 30 s reconnection grace, `reconnecting` state, AFK handling, state resent on reconnection | nbilyj |
| 10 | **Gaming** — multiplayer (more than two players) | Major | 2 | 2 to 4 players per game, the same state pushed to every client, a fair turn order | nbilyj |
| 11 | **Gaming** — game customization | Minor | 1 | five house rules chosen by the host (also used by the bots), 8 card skins, 5 table colors; defaults always available | nbilyj, kebertra |
| 12 | **Gaming** — spectator mode | Minor | 1 | live games list, read-only board with real-time updates | nbilyj |
| 13 | **DevOps** — monitoring with Prometheus and Grafana | Major | 2 | metrics from every service, provisioned dashboard, alert rules, Grafana secured | nbarbosa |
| 14 | **DevOps** — backend as microservices | Major | 2 | four single-purpose services (auth, user, chat, game) behind a gateway, REST between services (user → chat events), one container each | nbarbosa, nbilyj |
| 15 | **Modules of choice** — ranked matchmaking with ELO | Minor | 1 | see justification below | nbilyj |

**Total: 24 points** (14 required + bonus, capped at +5 by the subject).

### Justification: Modules of choice — ranked matchmaking with ELO (Minor)

- **Why**: a competitive mode gives players a reason to come back and makes the leaderboard meaningful.
- **Technical challenges**:
  - grouping 2 to 4 players with close ratings while keeping the wait short (the accepted range grows with waiting time, and the minimum group size goes down);
  - adapting ELO, designed for duels, to multiplayer games by scoring every pair;
  - continuing the game until the last player while a ranked player who finishes or leaves is handled cleanly.
- **Value**: fair games between players of the same level, a rating that evolves, and a full ranking instead of a single winner.
- **Why Minor**: it extends the game with a matchmaking queue and a rating algorithm, but reuses the existing game engine.

---

## Individual contributions

> Written from the Git history. Each member should check and complete their own part, in particular the challenges.

### nbilyj
- **Game service**, almost entirely:
  - rules engine (deck, every effect, the five house rules, end conditions);
  - room manager and WebSocket protocol;
  - turn timers, AFK and reconnection grace;
  - UNO window and bluff challenge;
  - bots (AI and turn scheduling);
  - ranked matchmaking and ELO;
  - spectators and match saving;
  - most of the game test suites.
- **Frontend**:
  - card-game redesign: own SNS identity, card skins, table colors;
  - game feedback: bluff pop-up, penalty bursts, callouts, playable-card highlight;
  - multi-row hand and the portrait phone layout;
  - live games list and spectator page.
- **Other**: the WebSocket guide (`game-websocket.md`) and API testing notes.
- **Challenges**:
  - keeping timers consistent when a player plays a few ms before the end of their turn (the next player's timer is always restarted);
  - never revealing hidden cards while keeping one state for players, spectators and reconnecting players (`lastActions` with `seq`).

### nbarbosa
- **Infrastructure**:
  - Docker multi-stage builds (dev and prod targets), Compose, Docker secrets, healthchecks;
  - Nginx gateway with HTTPS and WebSocket routing;
  - Adminer.
- **CI pipeline**: lint, audit, tests, Docker build validation, gitleaks.
- **Monitoring**: Prometheus scraping, alert rules, Grafana dashboard.
- **Auth service**:
  - JWT moved to HttpOnly Secure cookies across all services;
  - account deletion and password change.
- **Chat service**:
  - persistent direct messages and offline delivery;
  - game invites in messages;
  - real-time friend events relayed from the user service.
- **Legal pages**: Privacy Policy and Terms of Service.
- **Challenges**: _to complete._

### gtourdia
- **Friends drawer**: friend list, requests with accept and decline, confirm-before-remove, real-time friend events.
- **Chat UI**: chat view inside the drawer, unread and request badges.
- **Pages and navigation**: home hero, Rules page content, leaderboard page connected to the API, navbar drawer menu, footer sections.
- **Debug header**: a development tool.
- **Makefile rules**: `install`, `up`/`down`, `seed` (debug users and conversation), `seed-leaderboard`.
- **Challenges**: _to complete._

### kebertra
- **Frontend architecture**:
  - folder structure and the full React Router tree;
  - route guards and the auth provider (with the 2FA step on the sign-in card);
  - `useWebSocket` (status, send, reconnection with backoff);
  - `GameProvider` and `ChatProvider` mounted once for the whole session;
  - WebSocket errors shown as toasts, and form validation.
- **Game screens**: lobby and waiting room (join by code), the first game board, card animations between piles and hands.
- **UI components**: reusable `Card` and `Hand` components, navbar with user menu.
- **Profile page**: stats, history and edit.
- **Responsive work**: small screens and landscape phones.
- **Project setup**: `.env.example` with configurable ports and database settings, idempotent Makefile with `install` and help.
- **Challenges**: _to complete._

---

## Known limitations

- **No online status for friends**: the friends list does not show who is connected. The "Standard user management" module requires it, which is why that module is not claimed above.
- **In-game chat**: the server supports `chat_message` during a game and saves it with the match, but the in-game chat bubble (`FloatingMessageBox`) is not shown in the game screen yet.
- **Game state in memory**: restarting the game service ends the games in progress (finished matches are safely stored).
- **Match history** is only visible on my own profile (`/games/history` returns the connected user's games).
- **Self-signed certificate**: the browser shows a warning on the first visit.

---

## Resources

### Documentation
- [React](https://react.dev/) · [React Router](https://reactrouter.com/) · [Vite](https://vite.dev/guide/)
- [Tailwind CSS](https://tailwindcss.com/docs) · [daisyUI](https://daisyui.com/docs/intro/)
- [Fastify](https://fastify.dev/docs/latest/) and its plugins ([websocket](https://github.com/fastify/fastify-websocket), [jwt](https://github.com/fastify/fastify-jwt), [cookie](https://github.com/fastify/fastify-cookie), [multipart](https://github.com/fastify/fastify-multipart))
- [Prisma](https://www.prisma.io/docs) · [PostgreSQL 16](https://www.postgresql.org/docs/16/)
- [MDN — WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) · [RFC 6455 (WebSocket)](https://datatracker.ietf.org/doc/html/rfc6455)
- [RFC 6238 (TOTP)](https://datatracker.ietf.org/doc/html/rfc6238) · [otplib](https://github.com/yeojz/otplib)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [MDN — HTTP cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [Docker Compose](https://docs.docker.com/compose/) · [Docker secrets](https://docs.docker.com/compose/how-tos/use-secrets/) · [Nginx WebSocket proxying](https://nginx.org/en/docs/http/websocket.html)
- [Prometheus](https://prometheus.io/docs/) · [prom-client](https://github.com/siimon/prom-client) · [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Elo rating system](https://en.wikipedia.org/wiki/Elo_rating_system) · [Uno (card game) — rules and house rules, the game ours is based on](https://en.wikipedia.org/wiki/Uno_(card_game))
- [WCAG 2.1 quick reference](https://www.w3.org/WAI/WCAG21/quickref/)

### How AI was used

We used AI assistants (Claude) as a tool throughout the project:

- **Learning**: to understand technologies that were new to us, such as React, Fastify, Prisma, WebSockets, Docker and Tailwind, with explanations and examples.
- **Design**: to explore visual ideas for the interface (theme, logo, card skins, game animations).
- **Development help**: to help write and review parts of the frontend (game screen polish, responsive layout) and to help draft this documentation.

Every AI suggestion was read, adapted, tested and committed by a team member, who can explain it.

What AI was **not** used for: the choice of the project, the game design and rules, the architecture and the team organization.
