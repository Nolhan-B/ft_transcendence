import { Link } from "react-router-dom";
import { MainTitle } from "../../components/texts/MainTitle";

// Static rules page. Every rule below mirrors the game engine
// (services/game/src/engine) and the gateway timers, so keep it in sync when
// the engine changes.

type RuleCard = {
  label: string;
  color: string;
  text: string;
};

const ACTION_CARDS: RuleCard[] = [
  {
    label: "Skip",
    color: "bg-primary text-primary-content",
    text: "The next player loses their turn.",
  },
  {
    label: "Rev",
    color: "bg-secondary text-secondary-content",
    text: "Reverses the direction of play. With two players left, it acts as a Skip.",
  },
  {
    label: "+2",
    color: "bg-accent text-accent-content",
    text: "The next player draws 2 cards and loses their turn.",
  },
  {
    label: "Wild",
    color: "bg-neutral text-neutral-content",
    text: "Playable on anything. You choose the next color.",
  },
  {
    label: "+4",
    color: "bg-neutral text-neutral-content",
    text: "Playable on anything. You choose the color and the next player draws 4.",
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card border-3 border-base-300 bg-base-200">
      <div className="card-body gap-3">
        <h2 className="card-title text-2xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export function RulesPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <MainTitle title="How to play" />
        <p className="text-base-content/70">
          A fast, turn-based UNO game for 2 to 4 players. Be the first to empty
          your hand — and don't forget to call UNO.
        </p>
      </header>

      <Section title="Goal">
        <p>
          Get rid of all your cards before everyone else. The first player with
          an empty hand wins a classic game. In ranked games, players keep
          playing until only one remains, and the finishing order decides the
          Elo changes.
        </p>
      </Section>

      <Section title="Setup">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The deck holds <strong>108 cards</strong>: for each of the four
            colors (red, yellow, green, blue), one <strong>0</strong>, two of
            each <strong>1–9</strong>, and two of each action card (Skip,
            Reverse, +2). Plus <strong>4 Wild</strong> and{" "}
            <strong>4 Wild +4</strong>.
          </li>
          <li>
            Each player is dealt <strong>7 cards</strong>.
          </li>
          <li>
            The first card of the discard pile is turned over. If it is a Wild,
            it is shuffled back and another card is drawn, so the game always
            starts on a colored card.
          </li>
        </ul>
      </Section>

      <Section title="On your turn">
        <p>
          Play a card that matches the <strong>color</strong> or the{" "}
          <strong>value</strong> of the top card. Wild cards can always be
          played. If you cannot — or do not want to — play, draw a card. Drawing
          ends your turn.
        </p>
        <p className="text-sm text-base-content/60">
          You have <strong>20 seconds</strong> per turn. If you time out, a card
          is drawn for you. Two timeouts in a row and you are marked as away and
          skipped.
        </p>
      </Section>

      <Section title="Action cards">
        <div className="grid gap-3 sm:grid-cols-2">
          {ACTION_CARDS.map((card) => (
            <div
              key={card.label}
              className="flex items-start gap-3 rounded-box border-3 border-base-300 bg-base-100 p-3"
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-lg text-lg font-black ${card.color}`}
              >
                {card.label}
              </span>
              <p className="text-sm">{card.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Calling UNO">
        <p>
          When you play your second-to-last card, you must call{" "}
          <strong>UNO</strong> within <strong>5 seconds</strong>. If you forget,
          any opponent can catch you and you draw <strong>2 cards</strong> as a
          penalty.
        </p>
        <p className="text-sm text-base-content/60">
          This rule can be disabled in the room settings.
        </p>
      </Section>

      <Section title="Challenging a +4">
        <p>
          A Wild +4 may only be played if you have no card matching the current
          color. When the bluff challenge is enabled, the next player has{" "}
          <strong>5 seconds</strong> to challenge:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Bluff confirmed</strong> — the player who played the +4
            draws <strong>4 cards</strong>.
          </li>
          <li>
            <strong>No bluff</strong> — the challenger draws{" "}
            <strong>6 cards</strong> instead of 4.
          </li>
        </ul>
      </Section>

      <Section title="House rules">
        <p className="text-sm text-base-content/60">
          Optional, set by the room leader before the game starts.
        </p>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold">Stacking</td>
                <td>
                  <strong>None</strong>: a +2 or +4 is applied immediately.{" "}
                  <strong>Same</strong>: you may answer a +2 with a +2 (or a +4
                  with a +4). <strong>All</strong>: any +2 or +4 can be stacked,
                  and the total is drawn by the first player who cannot answer.
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Seven-Zero</td>
                <td>
                  Playing a <strong>7</strong> swaps your hand with a player of
                  your choice. Playing a <strong>0</strong> rotates every hand
                  in the direction of play.
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Jump-in</td>
                <td>
                  You may play out of turn if you hold the exact same card
                  (color and value) as the top card. Play then continues from
                  you.
                </td>
              </tr>
              <tr>
                <td className="font-semibold">Bluff challenge</td>
                <td>Enables the +4 challenge described above.</td>
              </tr>
              <tr>
                <td className="font-semibold">UNO callout</td>
                <td>Enables the UNO penalty described above.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Classic vs Ranked">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-box border-3 border-base-300 bg-base-100 p-4">
            <h3 className="mb-1 font-bold">Classic</h3>
            <p className="text-sm">
              Play with friends in a private room. The first player to empty
              their hand wins and the game ends immediately. No Elo is at stake.
            </p>
          </div>
          <div className="rounded-box border-3 border-base-300 bg-base-100 p-4">
            <h3 className="mb-1 font-bold">Ranked</h3>
            <p className="text-sm">
              Join the matchmaking queue. Players are matched by Elo, and the
              finishing order updates everyone's rating. Leaving early counts as
              a loss.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Matchmaking & Elo">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Ranked games aim for <strong>4 players</strong>. The accepted Elo
            gap starts at <strong>100</strong> and widens by{" "}
            <strong>50 every 10 seconds</strong>, up to <strong>500</strong>.
          </li>
          <li>
            If nobody is found, the game starts with <strong>3 players</strong>{" "}
            after 20 seconds, or <strong>2 players</strong> after 40 seconds.
          </li>
          <li>
            Elo uses the standard formula with <strong>K = 16</strong>, split
            across every pair of players in the final ranking.
          </li>
        </ul>
      </Section>

      <Section title="Disconnections">
        <p>
          If you lose connection, you have <strong>30 seconds</strong> to
          reconnect and resume your game. After that, you are removed from the
          match. In ranked mode, a removed player keeps their current position
          in the ranking.
        </p>
      </Section>

      <div className="flex flex-wrap gap-3">
        <Link to="/play" className="btn btn-primary">
          Play now
        </Link>
        <Link to="/leaderboard" className="btn btn-outline">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
