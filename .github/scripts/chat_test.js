import process from "node:process";

const WebSocket = globalThis.WebSocket ?? (await import("ws")).WebSocket;

const API_URL = process.env.API_URL || "http://localhost:8080";
const WS_URL = process.env.WS_URL || "ws://localhost:8080/api/chat/ws";

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${message}`);
    process.exit(1);
  }
};

const createAccount = async (prefix) => {
  const res = await fetch(`${API_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${prefix}_${Date.now()}@test.com`,
      username: `${prefix}_${Math.floor(Math.random() * 10000)}`,
      password: "password123"
    })
  });
  if (!res.ok) {
    throw new Error(`Erreur création compte ${prefix}: ${res.statusText}`);
  }
  return res.json();
};

const withTimeout = (promise, ms = 5000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Timeout de test dépassé")), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

(async () => {
  try {
    console.log("🚀 Démarrage de la suite de tests E2E Chat...");

    const alice = await createAccount("ci_alice");
    const bob = await createAccount("ci_bob");
    console.log("✅ Comptes de test créés avec succès.");

    // ==========================================
    // TEST 1 : Envoi temps réel & Historique REST
    // ==========================================
    await withTimeout(new Promise((resolve, reject) => {
      const wsAlice = new WebSocket(`${WS_URL}?token=${alice.token}`);
      const wsBob = new WebSocket(`${WS_URL}?token=${bob.token}`);

      wsBob.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "direct_message" && data.content === "Hello CI Realtime") {
            console.log("✅ Message temps réel reçu par Bob !");

            const historyRes = await fetch(
              `${API_URL}/api/chat/conversations/${alice.user.id}/messages`,
              { headers: { Authorization: `Bearer ${bob.token}` } }
            );
            assert(historyRes.ok, "La récupération de l'historique REST a échoué");
            const historyData = await historyRes.json();
            assert(historyData.messages && historyData.messages.length > 0, "L'historique des messages est vide");
            console.log("✅ Historique REST validé !");

            wsAlice.close();
            wsBob.close();
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      Promise.all([
        new Promise((r) => wsAlice.addEventListener("open", r)),
        new Promise((r) => wsBob.addEventListener("open", r)),
      ]).then(() => {
        wsAlice.send(JSON.stringify({
          type: "direct_message",
          receiverId: bob.user.id,
          content: "Hello CI Realtime"
        }));
      });
    }));

    // ==========================================
    // TEST 2 : Livraison des messages hors-ligne
    // ==========================================
    await withTimeout(new Promise((resolve, reject) => {
      const wsAliceOff = new WebSocket(`${WS_URL}?token=${alice.token}`);

      wsAliceOff.addEventListener("open", () => {
        console.log("📨 Alice envoie un message à Bob (qui est hors-ligne)...");
        wsAliceOff.send(JSON.stringify({
          type: "direct_message",
          receiverId: bob.user.id,
          content: "Message hors-ligne pour Bob"
        }));
      });

      wsAliceOff.addEventListener("message", () => {
        wsAliceOff.close();
        console.log("✅ Message hors-ligne enregistré en DB. Connexion de Bob...");

        const wsBobOff = new WebSocket(`${WS_URL}?token=${bob.token}`);
        wsBobOff.addEventListener("message", (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.content === "Message hors-ligne pour Bob") {
              console.log("✅ Bob a bien reçu son message en attente à la connexion !");
              wsBobOff.close();
              resolve();
            }
          } catch (err) {
            reject(err);
          }
        });
      });
    }));

    // ==========================================
    // TEST 3 : Invitation de jeu (game_invite)
    // ==========================================
    await withTimeout(new Promise((resolve, reject) => {
      const wsAliceGame = new WebSocket(`${WS_URL}?token=${alice.token}`);
      const wsBobGame = new WebSocket(`${WS_URL}?token=${bob.token}`);
      const testRoomId = "room-test-uuid-42";

      wsBobGame.addEventListener("message", async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "direct_message" && data.messageType === "game_invite") {
            assert(data.gameRoomId === testRoomId, `gameRoomId incorrect: attendu ${testRoomId}, reçu ${data.gameRoomId}`);
            assert(data.content === "Viens jouer au Pong !", "Contenu de l'invitation incorrect");
            console.log("✅ Invitation de jeu temps réel reçue par Bob avec le bon roomId !");

            const historyRes = await fetch(
              `${API_URL}/api/chat/conversations/${alice.user.id}/messages`,
              { headers: { Authorization: `Bearer ${bob.token}` } }
            );
            assert(historyRes.ok, "Échec de récupération de l'historique pour l'invitation");
            const historyData = await historyRes.json();
            const inviteMsg = historyData.messages.find((m) => m.gameRoomId === testRoomId);
            assert(inviteMsg !== undefined, "L'invitation de jeu n'est pas présente dans l'historique REST");
            assert(inviteMsg.messageType === "game_invite", "Le messageType en base n'est pas 'game_invite'");
            console.log("✅ Invitation de jeu validée dans l'historique REST !");

            wsAliceGame.close();
            wsBobGame.close();
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });

      Promise.all([
        new Promise((r) => wsAliceGame.addEventListener("open", r)),
        new Promise((r) => wsBobGame.addEventListener("open", r)),
      ]).then(() => {
        console.log("🎮 Alice envoie une invitation de jeu à Bob...");
        wsAliceGame.send(JSON.stringify({
          type: "direct_message",
          receiverId: bob.user.id,
          content: "Viens jouer au Pong !",
          messageType: "game_invite",
          gameRoomId: testRoomId
        }));
      });
    }));

    console.log("🎉 Tous les tests E2E du chat ont réussi avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("❌ ÉCHEC DU TEST E2E :", err);
    process.exit(1);
  }
})();