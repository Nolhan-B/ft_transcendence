import process from "node:process";

// Autorise les certificats auto-signés pour fetch et WebSocket en local
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const WebSocket = globalThis.WebSocket ?? (await import("ws")).WebSocket;

const API_URL = process.env.API_URL || "https://localhost:8443";
const WS_URL = process.env.WS_URL || "wss://localhost:8443/api/chat/ws";

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
  const data = await res.json();
  // La session n'est que dans le cookie HttpOnly (audit F-08) : on la lit
  // dans Set-Cookie, comme un navigateur
  const cookie = res.headers.get("set-cookie")?.match(/access_token=([^;]+)/);
  if (!cookie) throw new Error(`Pas de cookie de session pour ${prefix}`);
  return { ...data, token: cookie[1] };
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

    // Les messages directs sont reserves aux amis (audit F-11) : Alice et
    // Bob deviennent amis avant les tests
    const request = await fetch(`${API_URL}/api/user/friends/request/${bob.user.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    assert(request.ok, `Demande d'ami refusee (${request.status})`);
    const accept = await fetch(`${API_URL}/api/user/friends/accept/${alice.user.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    assert(accept.ok, `Acceptation de l'ami refusee (${accept.status})`);
    console.log("✅ Alice et Bob sont amis.");

    // Un inconnu ne peut pas leur ecrire
    const carol = await createAccount("ci_carol");
    await withTimeout(new Promise((resolve, reject) => {
      const wsCarol = new WebSocket(`${WS_URL}?token=${carol.token}`);
      wsCarol.addEventListener("open", () => {
        wsCarol.send(JSON.stringify({
          type: "direct_message",
          receiverId: alice.user.id,
          content: "Hello stranger",
        }));
      });
      wsCarol.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);
        wsCarol.close();
        if (data.type === "error" && /not friends/.test(data.message)) resolve();
        else reject(new Error(`Message d'un inconnu accepte : ${event.data}`));
      });
    }));
    console.log("✅ Message d'un non-ami refusé.");

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

    // ==========================================
    // TEST 4 : plusieurs onglets par utilisateur
    // ==========================================
    // Chaque onglet a son socket : tous recoivent les messages, ceux de
    // l'expediteur aussi, et fermer un onglet ne coupe pas les autres
    const openTab = (user) => new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?token=${user.token}`);
      const inbox = [];
      ws.addEventListener("message", (e) => inbox.push(JSON.parse(e.data)));
      ws.addEventListener("open", () => resolve({ ws, inbox }));
      ws.addEventListener("error", reject);
    });
    const waitIn = async (tab, pred, label) => {
      for (let i = 0; i < 100; i++) {
        if (tab.inbox.some(pred)) return;
        await new Promise((r) => setTimeout(r, 50));
      }
      throw new Error(`${label} : rien reçu (${JSON.stringify(tab.inbox)})`);
    };
    const isDm = (content) => (m) => m.type === "direct_message" && m.content === content;

    const aliceTab1 = await openTab(alice);
    const aliceTab2 = await openTab(alice);
    const bobTab1 = await openTab(bob);
    const bobTab2 = await openTab(bob);
    // Laisse le serveur finir la verification de session des quatre sockets
    await new Promise((r) => setTimeout(r, 500));

    aliceTab1.ws.send(JSON.stringify({ type: "direct_message", receiverId: bob.user.id, content: "Deux onglets" }));
    await waitIn(bobTab1, isDm("Deux onglets"), "Onglet 1 de Bob");
    await waitIn(bobTab2, isDm("Deux onglets"), "Onglet 2 de Bob");
    await waitIn(aliceTab2, isDm("Deux onglets"), "Autre onglet d'Alice (expéditrice)");
    console.log("✅ Message reçu sur tous les onglets, ceux de l'expéditrice compris.");

    bobTab1.ws.close();
    await new Promise((r) => setTimeout(r, 300));
    aliceTab1.ws.send(JSON.stringify({ type: "direct_message", receiverId: bob.user.id, content: "Un onglet fermé" }));
    await waitIn(bobTab2, isDm("Un onglet fermé"), "Onglet restant de Bob");
    console.log("✅ Fermer un onglet ne coupe pas les autres.");

    // Evenement d'ami pousse par le service user : sur tous les onglets
    const dave = await createAccount("ci_dave");
    const bobTab3 = await openTab(bob);
    await new Promise((r) => setTimeout(r, 500));
    const friendReq = await fetch(`${API_URL}/api/user/friends/request/${bob.user.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${dave.token}` },
    });
    assert(friendReq.ok, `Demande d'ami de Dave refusée (${friendReq.status})`);
    const isFriendReq = (m) => m.type === "friend_request_received";
    await waitIn(bobTab2, isFriendReq, "Demande d'ami sur l'onglet 2 de Bob");
    await waitIn(bobTab3, isFriendReq, "Demande d'ami sur l'onglet 3 de Bob");
    console.log("✅ Événement d'ami reçu sur tous les onglets.");

    // ==========================================
    // TEST 5 : blocage
    // ==========================================
    const eve = await createAccount("ci_eve");
    const frank = await createAccount("ci_frank");
    const asUser = (user, method, path) =>
      fetch(`${API_URL}/api/user${path}`, {
        method,
        headers: { Authorization: `Bearer ${user.token}` },
      });
    await asUser(eve, "POST", `/friends/request/${frank.user.id}`);
    const frankAccept = await asUser(frank, "POST", `/friends/accept/${eve.user.id}`);
    assert(frankAccept.ok, `Eve et Frank doivent devenir amis (${frankAccept.status})`);

    // Message envoye pendant que Frank est absent, puis Frank bloque Eve :
    // il ne doit pas le recevoir en se connectant
    const eveTab = await openTab(eve);
    await new Promise((r) => setTimeout(r, 500));
    eveTab.ws.send(JSON.stringify({ type: "direct_message", receiverId: frank.user.id, content: "Avant le blocage" }));
    await new Promise((r) => setTimeout(r, 500));
    const block = await asUser(frank, "POST", `/blocks/${eve.user.id}`);
    assert(block.ok, `Le blocage doit réussir (${block.status})`);
    const frankTab1 = await openTab(frank);
    await new Promise((r) => setTimeout(r, 1500));
    assert(
      !frankTab1.inbox.some(isDm("Avant le blocage")),
      "Un message en attente d'une personne bloquée ne doit pas être livré",
    );
    console.log("✅ Messages en attente d'un utilisateur bloqué non livrés.");

    // Frank bloque depuis un autre onglet : cet onglet-ci retire Eve aussi
    await asUser(frank, "DELETE", `/blocks/${eve.user.id}`);
    await asUser(frank, "POST", `/blocks/${eve.user.id}`);
    await waitIn(
      frankTab1,
      (m) => m.type === "friend_removed" && m.userId === eve.user.id,
      "Blocage depuis un autre onglet de Frank",
    );
    console.log("✅ Les autres onglets de celui qui bloque sont prévenus.");

    // Bloquer et debloquer en meme temps : jamais d'erreur serveur
    const race = await Promise.all(
      ["DELETE", "POST", "DELETE", "POST", "DELETE", "POST"].map((m) =>
        asUser(frank, m, `/blocks/${eve.user.id}`).then((r) => r.status),
      ),
    );
    assert(race.every((s) => s < 500), `Blocage concurrent : erreur serveur (${race.join(",")})`);
    console.log("✅ Bloquer et débloquer en même temps ne casse rien.");

    for (const tab of [aliceTab1, aliceTab2, bobTab2, bobTab3, eveTab, frankTab1]) tab.ws.close();

    console.log("🎉 Tous les tests E2E du chat ont réussi avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("❌ ÉCHEC DU TEST E2E :", err);
    process.exit(1);
  }
})();