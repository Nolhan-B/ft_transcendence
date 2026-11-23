import { Outlet } from "react-router-dom";
import { CityBackground } from "../components/layout/CityBackground";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";

export function AuthLayout() {
  return (
    <div className="isolate flex flex-col min-h-screen flex text-base-content">
      {/* Neon city behind every page */}
      <CityBackground />
      <DebugHeader />
      <Outlet />
    </div>
  );
}
