import type { CardColor, CardValue } from "shared";
import { useCardSkin } from "../cards/skins";
import type { Skin } from "../cards/skins";
import type { SuitValue } from "../cards/skins/common";

interface FaceProps {
  color: CardColor;
  value: CardValue;
  // Draw with this skin instead of the chosen one (skin previews)
  skin?: Skin;
}

// Face of a game card, drawn by the card skin chosen in the settings. To be
// put in a <Card variant="game">, which scales it to its width.
export function CardFace({ color, value, skin }: FaceProps) {
  const chosen = useCardSkin();
  const { Face, Wild } = skin ?? chosen;
  if (color === "wild" || value === "wild" || value === "wild_draw4")
    return <Wild value={value === "wild_draw4" ? "wild_draw4" : "wild"} />;
  return <Face color={color} value={value as SuitValue} />;
}

// Back of a card, in the chosen skin
export function CardBack({ skin }: { skin?: Skin }) {
  const chosen = useCardSkin();
  const { Back } = skin ?? chosen;
  return <Back />;
}
