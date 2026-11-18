import { Outlet } from "react-router-dom";
import { Header } from "../components/Header/Header";
import { Footer } from "../components/Footer/Footer";
import { DebugHeader } from "../components/DebugHeader/DebugHeader";
import { SideButton } from "../components/SideButton/SideButton";
import { useAuth } from "../hooks/auth/useAuth";

export function MainLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content">
      {/* Dev-only: `VITE_DEBUG_HEADER=false` hides it, prod build strips it */}
      {import.meta.env.DEV && import.meta.env.VITE_DEBUG_HEADER !== "false" && (
        <DebugHeader />
      )}

      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      { user ? <SideButton /> : <></> }
    </div>
  );
}
