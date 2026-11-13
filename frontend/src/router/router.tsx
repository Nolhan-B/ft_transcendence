import { Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";

import { HomePage } from "../pages/HomePage/HomePage";
import { AuthLayout } from "../layouts/AuthLayout";
import { AuthPage } from "../pages/AuthPage/AuthPage";
import { RedirectIfAuth } from "./AuthGuards";
import { GameSession } from "./GameSession";

function Router() {
  return (
    <Routes>
      {/* One game WebSocket for all the pages while connected */}
      <Route element={<GameSession />}>
        {/* Default layout */}
        <Route element={<MainLayout />} path="/">
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route element={<RedirectIfAuth />}>
          <Route element={<AuthLayout />} path="/">
            <Route path="/auth" element={<AuthPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default Router;
