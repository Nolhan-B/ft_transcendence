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

const TOGGLES: {
  key: Exclude<keyof GameSettings, "stacking">;
  label: string;
}[] = [
  { key: "sevenZeroRule", label: "7-0 rule" },
  { key: "jumpIn", label: "Jump-in" },
  { key: "bluffChallenge", label: "Challenge a Wild +4" },
  { key: "unoCallout", label: "Catch a missed UNO" },
];

export function RoomSettings({ settings, editable, onChange }: Props) {
  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Rules</h2>
        {!editable && (
          <p className="text-sm opacity-70">Only the leader can change them.</p>
        )}

        <fieldset className="fieldset">
          <legend className="fieldset-legend">Stacking</legend>
          <div className="join">
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
          {TOGGLES.map(({ key, label }) => (
            <label key={key} className="label cursor-pointer justify-between">
              <span>{label}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                disabled={!editable}
                checked={settings[key]}
                onChange={(event) =>
                  onChange({ ...settings, [key]: event.target.checked })
                }
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
