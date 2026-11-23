# Game WebSocket - Frontend Guide

How the game service talks to the browser during a game, and how to render it
so that every client (players, spectators, a player coming back after a
refresh) shows the same thing.

Types live in `shared/src/types/game.ts` and `shared/src/types/websocket-events.ts`.
After pulling changes to `shared/`, rebuild it: `npm --prefix shared run build`.

---

## 1. The one rule

**`game_updated` carries the full game state. Replace your state with it, never patch it.**

Everything you need to draw the screen is in that state, including what just
happened (`lastActions`) and the live timers (`turnTimeLeftMs`,
`pendingWildDraw4`, ...). The other events (`uno_called`, `bluff_result`, ...)
are optional notifications, handy for a toast or a sound. Never build
game logic on them alone.

```ts
case "game_updated":
  setGameState(event.state);          // the whole truth
  playNewActions(event.state.lastActions);
  break;
```

Why: a spectator or a player who reconnects only gets the current state, not
the history of events. If the UI only relies on the state, everyone sees the
same screen.

---

## 2. Connection and lifecycle

| Step | Client sends | Server answers |
|---|---|---|
| Open `wss://<host>/api/game/ws` (auth cookie `access_token`) | | `{ type: "connected" }` |
| Join a game you play in | `{ type: "join_game", gameId }` | `game_updated` (to you) |
| Watch a game | `{ type: "spectate_game", gameId }` | `spectate_started { state }` |
| Stop watching | `{ type: "leave_spectate", gameId }` | |

- One socket per user. A second tab gets `error: "Already connected"`.
- After a refresh, send `join_game` again. You have **30 s** to come back
  before being kicked (see `reconnecting`).
- `spectate_started.state` has the same shape as `game_updated.state`.

---

## 3. Server -> client events during a game

| Event | Payload | Sent when |
|---|---|---|
| `game_updated` | `state: GameState` | after every change (move, timer, kick, reconnect...) |
| `game_ended` | `winnerId`, `ranking` | game over, **after** the final `game_updated` |
| `player_joined` | `userId` | a player (re)joins the game |
| `player_left` | `userId`, `reason` | `"disconnected"` (may come back), `"afk"` or `"abandoned"` (kicked) |
| `uno_called` | `userId` | notification, also in `lastActions` |
| `uno_caught` | `targetUserId`, `catcherUserId` | notification, also in `lastActions` |
| `bluff_result` | `challengerUserId`, `targetUserId`, `wasBluff`, `penaltyCount` | notification, also in `lastActions` |
| `chat_message` | `userId`, `username`, `content` | in-game chat |
| `elo_updated` | `changes: { userId, oldElo, newElo }[]` | ranked game over |
| `error` | `message` | your last message was refused |

`game_ended.winnerId` is `""` when there is no winner. `ranking`: in classic
only the winner, in ranked the finishing order. Kicked players are never in it.

---

## 4. GameState fields

Fields that already existed:

| Field | Meaning |
|---|---|
| `players[]` | `userId`, `username`, `hand`, `isCurrentTurn`, `disconnected` |
| `players[].hand` | your own cards; for others, placeholders (`id: ""`) - only the **length** is meaningful |
| `players[].disconnected` | out of the game: kicked, or already finished in ranked |
| `topCard`, `currentColor` | card on the pile, and the color to follow (differs from `topCard.color` after a wild) |
| `direction` | `1` or `-1` |
| `pendingDrawCount` | size of the +2/+4 stack waiting (stacking rule) |
| `drawPileCount`, `discardPile` | piles |
| `ranking`, `winnerId`, `status` | progress of the game (`"in_progress"` / `"finished"`) |
| `settings` | room rules (`stacking`, `sevenZeroRule`, `jumpIn`, `bluffChallenge`, `unoCallout`) |

New fields:

| Field | Type | Meaning |
|---|---|---|
| `lastActions` | `GameAction[]` | what produced this state, in order (see section 5) |
| `turnTimeLeftMs` | `number \| null` | time left for the current player, **at the moment the message was sent**. `null`: bot turn, a +4 awaiting an answer, or game over |
| `pendingWildDraw4` | `{ playerId, targetId, timeLeftMs } \| null` | a +4 waits for `targetId` to accept or challenge (bluff rule) |
| `unoVulnerable` | `string[]` | players with 1 card who did not call UNO and can still be caught |
| `reconnecting` | `string[]` | players whose connection dropped, still within the 30 s grace (not kicked yet) |

---

## 5. lastActions

Each action has a `seq` (increasing number inside the game) and `auto: true`
when the server did it (timer) instead of a player.

**Play each action once.** Keep the last `seq` you displayed and skip
anything lower or equal. The same `lastActions` come back in some messages
(reconnect, a UNO window closing, ...): they must not replay animations.

```ts
const lastSeen = useRef(0);

function playNewActions(actions: GameAction[]) {
  for (const action of actions) {
    if (action.seq <= lastSeen.current) continue;
    lastSeen.current = action.seq;
    animate(action);
  }
}
```

On a fresh mount (spectator arriving, page reload), set `lastSeen` to the
highest `seq` of the first state you receive, so old actions are not replayed.

| `type` | Fields | When |
|---|---|---|
| `card_played` | `userId`, `card`, `chosenColor?`, `targetUserId?`, `jumpIn?` | a card is played. `chosenColor` for wild / +4, `targetUserId` for a 7 (7-0 rule) |
| `cards_drawn` | `userId`, `count`, `reason`, `cards?` | someone draws. `cards` is **only present for the player who draws** |
| `hands_swapped` | `userId`, `targetUserId` | a 7 with the 7-0 rule |
| `hands_rotated` | `direction` | a 0 with the 7-0 rule: every hand moves one seat in `direction` |
| `uno_called` | `userId` | a player called UNO |
| `uno_caught` | `userId` (catcher), `targetUserId` | followed by a `cards_drawn` (`uno_penalty`) |
| `bluff_challenged` | `userId` (challenger), `targetUserId` (+4 player), `wasBluff` | followed by a `cards_drawn` (`bluff_penalty`) |
| `wild_draw4_accepted` | `userId` | +4 accepted, by the player or by the timer (`auto`). Followed by `cards_drawn` |
| `player_finished` | `userId`, `rank` | a player is ranked (out of cards, or last one left) |
| `player_kicked` | `userId`, `reason` | `"afk"` (2 turns without playing) or `"abandoned"` (did not come back in time) |

`cards_drawn.reason`:

| `reason` | Meaning |
|---|---|
| `voluntary` | the player drew a card |
| `stack` | the player took the whole +2/+4 stack |
| `draw2` / `wild_draw4` | the player was hit by a +2 / +4 (no stacking, or +4 accepted) |
| `bluff_penalty` | lost a bluff challenge (4 for the bluffer, 6 for a wrong challenger) |
| `uno_penalty` | caught without calling UNO (2 cards) |
| `afk` | the turn timer ran out (`auto: true`) |

`count` can be lower than asked if the piles are empty.

### Examples

A plays a +2 with stacking off. B draws 2, the turn skips to C.
What **B** receives:

```json
"lastActions": [
  { "seq": 41, "type": "card_played", "userId": "A", "card": { "id": "c1", "color": "red", "value": "draw2" } },
  { "seq": 42, "type": "cards_drawn", "userId": "B", "count": 2, "reason": "draw2",
    "cards": [{ "id": "c7", "color": "blue", "value": "4" }, { "id": "c8", "color": "wild", "value": "wild" }] }
]
```

What **A and C** receive: the same, without `cards`.

B challenges A's +4 and A was bluffing:

```json
"lastActions": [
  { "seq": 57, "type": "bluff_challenged", "userId": "B", "targetUserId": "A", "wasBluff": true },
  { "seq": 58, "type": "cards_drawn", "userId": "A", "count": 4, "reason": "bluff_penalty" }
]
```

---

## 6. Recipes

### Turn countdown

`turnTimeLeftMs` is the time left when the server sent the message. Start a
countdown from it when the message arrives:

```ts
const turnEndsAt = state.turnTimeLeftMs === null ? null : Date.now() + state.turnTimeLeftMs;
```

Do **not** restart a fixed 20 s on every `game_updated`: a `catch_uno` or a
reconnect does not reset the turn. Hide the timer when it is `null`.

### Bluff dialog (+4)

Show "Challenge / Accept" when `pendingWildDraw4?.targetId === myId`.
Countdown: `pendingWildDraw4.timeLeftMs`. Answer with
`{ type: "challenge_bluff", gameId }` or `{ type: "accept_wild_draw4", gameId }`.
While a +4 is pending, nobody can play or draw (the server refuses). When the
delay runs out, the server accepts for the target (`wild_draw4_accepted`,
`auto: true`). The other players can show "B is deciding...".

### Catch UNO button

Show the button on opponent `X` only if `unoVulnerable.includes(X)`.
Do not use "has 1 card": the player may have called UNO already, or the 5 s
window may be over. A new state is sent when the window closes, so the button
disappears by itself. Send `{ type: "catch_uno", gameId, targetUserId }`.

### Calling UNO

Show your own UNO button when `unoVulnerable.includes(myId)`. Send
`{ type: "call_uno", gameId }`.

### Reconnecting vs kicked

- `reconnecting.includes(X)`: "X is reconnecting..." (seat still in the game)
- `players[X].disconnected`: X is out of the game (kicked or finished in ranked)
- The `player_left.reason` tells the same thing as a notification.

### Color after a wild

Use `currentColor` (always right) to show the color to follow, and
`card_played.chosenColor` to announce the choice ("A chose green").

### End of the game

The final `game_updated` (status `"finished"`, complete `ranking`) arrives
**before** `game_ended`. Show the results from `game_ended.ranking` /
`winnerId`. In ranked, `elo_updated` follows.

---

## 7. Client -> server messages during a game

| Message | Payload | Notes |
|---|---|---|
| `play_card` | `gameId`, `cardId`, `chosenColor?`, `targetUserId?` | `chosenColor` required for wild / +4, `targetUserId` for a 7 (7-0 rule). Out of turn = jump-in (if allowed) |
| `draw_card` | `gameId` | takes the whole stack if `pendingDrawCount > 0` |
| `call_uno` | `gameId` | |
| `catch_uno` | `gameId`, `targetUserId` | |
| `challenge_bluff` | `gameId` | only the `pendingWildDraw4.targetId` |
| `accept_wild_draw4` | `gameId` | only the `pendingWildDraw4.targetId` |
| `chat_message` | `gameId`, `content` | 1 to 500 characters |

Common `error.message` answers: `"Invalid move"`, `"Cannot draw card"`,
`"Nothing to call"`, `"Player already called UNO or not in UNO state"`,
`"Only the targeted player can respond to this card"`,
`"Invalid message format"` (payload does not match).

---

## 8. Timings

Defaults, configurable on the game service with environment variables
(tests use shorter values):

| Variable | Default | What |
|---|---|---|
| `TURN_TIMEOUT_MS` | 20 s | turn length; 2 timeouts in a row = kicked (`afk`) |
| `BLUFF_TIMEOUT_MS` | 5 s | delay to answer a +4 |
| `UNO_WINDOW_MS` | 5 s | delay during which a forgotten UNO can be caught |
| `RECONNECT_GRACE_MS` | 30 s | delay to come back before being kicked (`abandoned`) |
| `GAME_JOIN_TIMEOUT_MS` | 15 s | a started game nobody joins is cancelled |

Never hardcode these on the front: use `turnTimeLeftMs` and
`pendingWildDraw4.timeLeftMs`.
