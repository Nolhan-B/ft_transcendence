import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CreateRoomForm } from "../../components/game/CreateRoomForm";
import { JoinByCodeForm } from "../../components/game/JoinByCodeForm";
import { RankedCard } from "../../components/game/RankedCard";
import { RoomList } from "../../components/game/RoomList";
import { MainTitle } from "../../components/texts/MainTitle";
import { useGame } from "../../hooks/ws/useGame";

export function PlayPage() {
  const { room, gameId } = useGame();
  const navigate = useNavigate();
  // A game id already known when the page opens is an old one: only a new one
  // (ranked match found) sends us to the game
  const knownGameId = useRef(gameId);

  useEffect(() => {
    if (gameId && gameId !== knownGameId.current) {
      navigate(`/games/${gameId}`);
    } else if (room) {
      navigate(`/play/rooms/${room.code}`);
    }
  }, [gameId, room, navigate]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <MainTitle title="Play" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <RankedCard />
          <JoinByCodeForm />
          <CreateRoomForm />
        </div>
        <RoomList />
      </div>
    </div>
  );
}
