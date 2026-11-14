import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";
import { AuthLayout } from "../layouts/AuthLayout";

import { HomePage } from "../pages/HomePage/HomePage";
import { RulesPage } from "../pages/RulesPage/RulesPage";
import { TermsPage } from "../pages/TermsPage/TermsPage";
import { PrivacyPage } from "../pages/PrivacyPage/PrivacyPage";
import { LeaderboardPage } from "../pages/LeaderboardPage/LeaderboardPage";
import { UserProfilePage } from "../pages/UserProfilePage/UserProfilePage";
import { PlayPage } from "../pages/PlayPage/PlayPage";
import { RoomPage } from "../pages/RoomPage/RoomPage";
import { GamePage } from "../pages/GamePage/GamePage";
import { SpectatePage } from "../pages/SpectatePage/SpectatePage";
import { ProfilePage } from "../pages/ProfilePage/ProfilePage";
import { SettingsPage } from "../pages/SettingsPage/SettingsPage";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { NotFoundPage } from "../pages/NotFoundPage/NotFoundPage";

import { RealtimeSession } from "./RealtimeSession";
import { RedirectIfAuth, RequireAuth } from "./AuthGuards";

function Router() {
  return (
    <Routes>
      {/* Game and chat WebSockets for all the pages while connected */}
      <Route element={<RealtimeSession />}>
        {/* Default layout */}
        <Route element={<MainLayout />}>
          {/* Public pages */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/users/:id" element={<UserProfilePage />} />

          {/* Connected users only */}
          <Route element={<RequireAuth />}>
            <Route path="/play" element={<PlayPage />} />
            <Route path="/play/rooms/:code" element={<RoomPage />} />
            <Route path="/games/:id" element={<GamePage />} />
            <Route path="/games/:id/spectate" element={<SpectatePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Unknown URL, inside the layout */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Visitors only */}
        <Route element={<RedirectIfAuth />}>
          <Route element={<AuthLayout />}>
            <Route path="/auth" element={<AuthPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
