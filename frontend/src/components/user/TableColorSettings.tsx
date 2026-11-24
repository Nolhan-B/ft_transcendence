import {
  TABLE_COLORS,
  setTableColor,
  useTableColor,
} from "../../theme/tableColors";

// Choice of the table color: the background of the site and its panels.
// Only for this browser.
export function TableColorSettings() {
  const chosen = useTableColor();

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Table color</h2>
        <p className="text-sm opacity-70">
          The color of the whole site around the game table.
        </p>

        <div className="flex flex-wrap gap-3">
          {TABLE_COLORS.map(({ id, label, swatch }) => {
            const selected = id === chosen;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTableColor(id)}
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-box border-2 p-3 transition-colors ${
                  selected
                    ? "border-accent bg-black/35"
                    : "border-transparent bg-black/20 hover:bg-black/30"
                }`}
              >
                <span
                  className="size-14 rounded-full border-2 border-white/70 shadow-lg"
                  style={{
                    background: `radial-gradient(circle at 50% 30%, ${swatch[0]}, ${swatch[1]})`,
                  }}
                />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
