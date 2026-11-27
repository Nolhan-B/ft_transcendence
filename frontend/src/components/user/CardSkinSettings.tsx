import type { CardColor, CardValue } from "shared";
import { Card } from "../cards/Card";
import { SKINS, setCardSkin, useCardSkin } from "../cards/skins";
import { CardBack, CardFace } from "../game/CardFace";

// The sample hand shown for every skin
const SAMPLE: [CardColor, CardValue][] = [
  ["red", "7"],
  ["yellow", "reverse"],
  ["green", "draw2"],
  ["blue", "skip"],
  ["wild", "wild_draw4"],
];

// Choice of the card skin. Only the look changes, and only for this browser:
// the other players keep their own skin.
export function CardSkinSettings() {
  const chosen = useCardSkin();

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body gap-4">
        <h2 className="card-title">Card skin</h2>
        <p className="text-sm opacity-70">
          How the cards look for you, in every game.
        </p>

        <div className="flex flex-col gap-3">
          {SKINS.map((skin) => {
            const selected = skin.id === chosen.id;
            return (
              <button
                key={skin.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setCardSkin(skin.id)}
                className={`flex cursor-pointer flex-col gap-3 rounded-box border-2 p-3 text-left transition-colors sm:flex-row sm:items-center ${
                  selected
                    ? "border-accent bg-black/35"
                    : "border-transparent bg-black/20 hover:bg-black/30"
                }`}
              >
                <div className="w-44 shrink-0">
                  <div className="flex items-center gap-2 font-bold">
                    <span
                      className="size-2.5 rounded-sm"
                      style={{ background: skin.accent }}
                    />
                    {skin.label}
                    {selected && (
                      <span className="badge badge-accent badge-sm">
                        In use
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs opacity-65">{skin.subtitle}</p>
                </div>

                {/* A small hand and the back, in this skin */}
                <div
                  className="flex flex-1 items-end -space-x-4 py-2 pr-2"
                  aria-hidden="true"
                >
                  {SAMPLE.map(([color, value], i) => (
                    <Card
                      key={i}
                      variant="game"
                      className="w-14 sm:w-16"
                      style={{ rotate: `${(i - 2) * 4}deg` }}
                    >
                      <CardFace color={color} value={value} skin={skin} />
                    </Card>
                  ))}
                  <Card variant="game" className="ml-6! w-14 sm:w-16">
                    <CardBack skin={skin} />
                  </Card>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
