import type { GameSettings, StackingRule } from "shared";

interface Props {
  settings: GameSettings;
  // Only the leader can change the rules
  editable: boolean;
  onChange: (settings: GameSettings) => void;
}

const STACKING: { value: StackingRule; label: string }[] = [
  { value: "none", label: "None" },
  { value: "same", label: "Same type" },
  { value: "all", label: "Any draw card" },
];

const STACKING_HELP =
  "None: a +2 or +4 is applied at once. Same type: answer a +2 with a +2, or a +4 with a +4. Any draw card: stack any +2 or +4, the first player who cannot answer draws the total.";

const TOGGLES: {
  key: Exclude<keyof GameSettings, "stacking">;
  label: string;
  help: string;
}[] = [
  {
    key: "sevenZeroRule",
    label: "7-0 rule",
    help: "Playing a 7 swaps your hand with the player of your choice. Playing a 0 passes every hand to the next player, in the direction of play.",
  },
  {
    key: "jumpIn",
    label: "Jump-in",
    help: "Play out of turn with the exact same card (color and value) as the top card. Play then goes on from you.",
  },
  {
    key: "bluffChallenge",
    label: "Challenge a Wild +4",
    help: "A Wild +4 is only allowed without a card of the current color. The next player has 10 s to challenge it: a bluff makes its player draw 4 cards, otherwise the challenger draws 6.",
  },
  {
    key: "unoCallout",
    label: "Catch a missed UNO",
    help: "Down to one card, say UNO within 5 s, or an opponent can catch you and you draw 2 cards.",
  },
];

// An "i" icon showing what a rule does: on hover, and on focus (keyboard,
// tap on a phone), which is why it is a button. The text spans the width of
// the closest positioned parent (the rule row), so it never leaves the card.
function RuleInfo({
  id,
  label,
  help,
}: {
  id: string;
  label: string;
  help: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={id}
        className="peer btn btn-circle btn-ghost btn-xs text-info"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
          className="size-4"
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v6M12 7.5v.01" />
        </svg>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute inset-x-0 bottom-full z-20 mb-1 rounded-box bg-neutral px-3 py-2 text-sm font-normal text-neutral-content opacity-0 shadow-xl transition-opacity peer-hover:visible peer-hover:opacity-100 peer-focus:visible peer-focus:opacity-100"
      >
        {help}
      </span>
    </>
  );
}

export function RoomSettings({ settings, editable, onChange }: Props) {
  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Rules</h2>
        {!editable && (
          <p className="text-sm opacity-70">Only the leader can change them.</p>
        )}

        <fieldset className="fieldset relative">
          <legend className="fieldset-legend">
            Stacking
            <RuleInfo
              id="rule-help-stacking"
              label="Stacking"
              help={STACKING_HELP}
            />
          </legend>
          {/* Stacked on narrow screens: side by side they overflow the card */}
          <div className="join join-vertical w-full sm:join-horizontal sm:w-auto">
            {STACKING.map(({ value, label }) => (
              <input
                key={value}
                type="radio"
                name="stacking"
                aria-label={label}
                className="btn join-item"
                disabled={!editable}
                checked={settings.stacking === value}
                onChange={() => onChange({ ...settings, stacking: value })}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          {TOGGLES.map(({ key, label, help }) => (
            <div
              key={key}
              className="relative flex items-center justify-between gap-3"
            >
              <span className="flex items-center gap-1">
                <label htmlFor={`rule-${key}`} className="cursor-pointer">
                  {label}
                </label>
                <RuleInfo id={`rule-help-${key}`} label={label} help={help} />
              </span>
              <input
                id={`rule-${key}`}
                type="checkbox"
                className="toggle toggle-primary"
                disabled={!editable}
                checked={settings[key]}
                onChange={(event) =>
                  onChange({ ...settings, [key]: event.target.checked })
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
