import React, { useState } from "react";

const PAPER = "#f3e7cc";
const INK = "#111013";
const CINNABAR = "#c8372d";

export function App() {
  const [tab, setTab] = useState<"login" | "register">("login");

  // États du formulaire
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regEmail, setRegEmail] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "login") {
      console.log("Tentative de connexion :", { loginUsername, loginPassword });
    } else {
      console.log("Tentative d'inscription :", { regEmail, regUsername, regPassword });
    }
  };

  return (
    <div className="min-h-screen bg-[#111013] text-[#f3e7cc] flex flex-col items-center justify-center p-6 relative overflow-hidden select-none font-serif selection:bg-[#c8372d] selection:text-white">
      {/* 1. TRAME DE FOND SEIGAIHA VECTORIELLE */}
      <svg
        className="fixed inset-0 w-full h-full opacity-[0.07] pointer-events-none z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="seigaiha-bg" width="80" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 0,40 A 40,40 0 0,1 80,40 M 10,40 A 30,30 0 0,1 70,40 M 20,40 A 20,20 0 0,1 60,40 M 30,40 A 10,10 0 0,1 50,40 M 40,40 A 0.5,0.5 0 0,1 40,40 M -40,20 A 40,40 0 0,1 40,20 M -30,20 A 30,30 0 0,1 30,20 M -20,20 A 20,20 0 0,1 20,20 M -10,20 A 10,10 0 0,1 10,20 M 40,20 A 40,40 0 0,1 120,20 M 50,20 A 30,30 0 0,1 110,20 M 60,20 A 20,20 0 0,1 100,20 M 70,20 A 10,10 0 0,1 90,20"
              fill="none"
              stroke={PAPER}
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#seigaiha-bg)" />
      </svg>

      {/* Halo d'encre cinabre en arrière-plan */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-[#c8372d]/12 blur-[120px] pointer-events-none z-0" />

      {/* 2. LOGO "UNO" COUP DE PINCEAU (SHODŌ & ENSŌ) */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <div className="flex items-center gap-4">
          <svg
            className="w-56 sm:w-64 h-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            viewBox="0 0 380 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* LETTRE 'U' : Attaque vive, arrondi plein et jet d'encre vers le haut */}
            <path
              d="M32 16 C34 38 31 68 34 84 C37 98 48 108 66 108 C84 108 97 96 101 80 C106 58 104 36 109 18 C104 22 98 32 94 42 C92 62 93 78 88 88 C84 94 76 97 68 97 C57 97 49 91 47 80 C44 65 47 38 43 14 Z"
              fill={PAPER}
            />
            {/* Éclaboussure sèche au bout du U */}
            <circle cx="112" cy="14" r="2.5" fill={PAPER} />

            {/* LETTRE 'N' : Coup de sabre descendant, diagonale tranchée et remontée */}
            <path
              d="M138 20 C141 45 137 75 139 104 C145 103 151 98 153 92 C152 76 153 52 153 38 C166 54 186 82 201 103 C206 106 211 105 214 98 C213 80 215 48 214 22 C209 23 203 28 200 36 C201 54 200 74 200 86 C186 66 166 38 152 18 Z"
              fill={PAPER}
            />
            <circle cx="137" cy="108" r="2" fill={PAPER} />

            {/* LETTRE 'O' : Cercle Ensō ouvert (l'énergie de l'encre qui ne se ferme pas tout à fait) */}
            <path
              d="M304 15 C264 12 232 40 232 72 C232 98 258 116 292 116 C328 116 358 96 358 68 C358 46 342 28 320 20 C322 25 322 31 319 35 C334 43 344 54 344 68 C344 88 320 103 292 103 C266 103 246 89 246 72 C246 49 270 26 305 26 C314 26 322 28 328 31 C331 26 333 19 332 14 C324 13 314 14 304 15 Z"
              fill={PAPER}
            />
            {/* Gouttes d'encre Ensō */}
            <circle cx="338" cy="18" r="2.5" fill={PAPER} />
            <circle cx="346" cy="26" r="1.8" fill={PAPER} />
          </svg>

          {/* Sceau Hanko rouge cinabre */}
          <div
            className="w-10 h-10 border-2 flex flex-col items-center justify-center shadow-[3px_3px_0_#000] -rotate-3"
            style={{
              borderColor: PAPER,
              backgroundColor: CINNABAR,
            }}
          >
            <span className="text-[10px] font-black leading-none text-[#f3e7cc]">宇</span>
            <span className="text-[10px] font-black leading-none text-[#f3e7cc] mt-0.5">野</span>
          </div>
        </div>
      </div>

      {/* 3. CARTOUCHE CENTRAL À ONGLETS (OPTION A) */}
      <div
        className="relative z-10 w-full max-w-sm rounded-xl p-6 sm:p-8 flex flex-col border-2 shadow-[8px_8px_0_#000]"
        style={{
          backgroundColor: "#16151a",
          borderColor: PAPER,
        }}
      >
        {/* Double filet intérieur façon estampe */}
        <div
          className="absolute inset-1.5 border pointer-events-none rounded-lg"
          style={{ borderColor: `${PAPER}33` }}
        />

        {/* Barre d'onglets Connexion / Inscription */}
        <div className="grid grid-cols-2 gap-2 mb-6 relative z-10">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all cursor-pointer border ${
              tab === "login"
                ? "bg-[#c8372d] text-[#f3e7cc] border-[#f3e7cc] shadow-[3px_3px_0_#000]"
                : "bg-transparent text-[#f3e7cc]/60 border-transparent hover:text-[#f3e7cc] hover:bg-white/5"
            }`}
          >
            Connexion
          </button>

          <button
            type="button"
            onClick={() => setTab("register")}
            className={`py-2 text-xs font-bold uppercase tracking-[0.2em] transition-all cursor-pointer border ${
              tab === "register"
                ? "bg-[#c8372d] text-[#f3e7cc] border-[#f3e7cc] shadow-[3px_3px_0_#000]"
                : "bg-transparent text-[#f3e7cc]/60 border-transparent hover:text-[#f3e7cc] hover:bg-white/5"
            }`}
          >
            Inscription
          </button>
        </div>

        {/* Formulaire dynamique */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 relative z-10">
          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#f3e7cc]/70">
                Adresse Email
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="joueur@domaine.fr"
                className="w-full px-3.5 py-2.5 rounded bg-[#111013] border border-[#f3e7cc]/40 text-[#f3e7cc] placeholder-[#f3e7cc]/25 text-xs font-mono focus:outline-none focus:border-[#c8372d] transition"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#f3e7cc]/70">
              Pseudo
            </label>
            <input
              type="text"
              required
              value={tab === "login" ? loginUsername : regUsername}
              onChange={(e) =>
                tab === "login"
                  ? setLoginUsername(e.target.value)
                  : setRegUsername(e.target.value)
              }
              placeholder="Ton pseudo"
              className="w-full px-3.5 py-2.5 rounded bg-[#111013] border border-[#f3e7cc]/40 text-[#f3e7cc] placeholder-[#f3e7cc]/25 text-xs font-mono focus:outline-none focus:border-[#c8372d] transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#f3e7cc]/70">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={tab === "login" ? loginPassword : regPassword}
              onChange={(e) =>
                tab === "login"
                  ? setLoginPassword(e.target.value)
                  : setRegPassword(e.target.value)
              }
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded bg-[#111013] border border-[#f3e7cc]/40 text-[#f3e7cc] placeholder-[#f3e7cc]/25 text-xs font-mono focus:outline-none focus:border-[#c8372d] transition"
            />
          </div>

          {/* Bouton d'action */}
          <button
            type="submit"
            className="mt-2 w-full py-3 rounded border-2 border-[#f3e7cc] bg-[#c8372d] text-[#f3e7cc] font-serif font-black text-xs uppercase tracking-[0.25em] shadow-[4px_4px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
          >
            {tab === "login" ? "Entrer" : "Créer le compte"}
          </button>
        </form>
      </div>
    </div>
  );
}