import { Route, Routes } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";

import { HomePage } from "../pages/HomePage/HomePage";
import { AuthLayout } from "../layouts/AuthLayout";
import { AuthPage } from "../pages/AuthPage/AuthPage";

function Router() {
  return (
    <Routes>
      {/* Default layout */}
      <Route element={<MainLayout />} path="/">
        <Route path='/home' element={<HomePage/>} />
      </Route>
      <Route element={<AuthLayout />} path="/">
        <Route path='/auth' element={<AuthPage/>} />
      </Route>
    </Routes>
  );
}

export default Router;
