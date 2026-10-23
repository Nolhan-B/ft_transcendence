import type { CSSProperties } from "react";
import type { Card } from "../types";

const LABELS: Record<string, string> = {
  skip: "⊘",
  reverse: "⇄",
  draw2: "+2",
  wild: "",
  wild_draw4: "+4",
};

export function cardLabel(card: Card): string {
  return LABELS[card.value] ?? card.value;
}

interface Props {
  card?: Card;
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

export default function UnoCard({
  card,
  faceDown,
  size = "md",
  playable,
  dimmed,
  className = "",
  style,
  onClick,
}: Props) {
  if (faceDown || !card) {
    return (
      <div className={`uno-card back ${size} ${className}`} style={style} onClick={onClick}>
        <div className="oval">
          <span className="logo-text">UNO</span>
        </div>
      </div>
    );
  }

  const label = cardLabel(card);
  const isWild = card.color === "wild";
  const corner = label || "W";
  const classes = [
    "uno-card",
    card.color,
    size,
    playable ? "playable" : "",
    dimmed ? "dimmed" : "",
    onClick ? "clickable" : "",
    className,
  ].join(" ");

  return (
    <div className={classes} style={style} onClick={onClick}>
      <span className="corner tl">{corner}</span>
      <div className="oval">
        {isWild && (
          <div className="wild-wheel">
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {label && <span className="center">{label}</span>}
      </div>
      <span className="corner br">{corner}</span>
    </div>
  );
}
