#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8443}"
WORKDIR=$(mktemp -d)

cleanup() {
  rm -rf "$WORKDIR"
  docker compose exec -T postgres psql -U transcendence_user -d transcendence_db \
    -c "DELETE FROM \"User\" WHERE email LIKE 'alice\_%@test.com' OR email LIKE 'bob\_%@test.com' OR email LIKE 'carol\_%@test.com';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Exécute une requête SQL et renvoie le résultat brut (sans en-tête)
db() {
  docker compose exec -T postgres psql -U transcendence_user -d transcendence_db -tAc "$1"
}

echo "=== 1. Health checks ==="
for svc in auth user game chat; do
  echo -n "Vérification $svc... "
  status=$(curl -k -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/$svc/health" || true)
  if [ "$status" != "200" ]; then
    echo "Échec (code HTTP $status)"
    exit 1
  fi
  echo "OK (200)"
done

echo ""
echo "=== 2. Création des comptes (Alice & Bob) ==="
SUFFIX="$(date +%s)$((RANDOM % 100))"
ALICE_EMAIL="alice_${SUFFIX}@test.com"
BOB_EMAIL="bob_${SUFFIX}@test.com"
BOB_USERNAME="bob_${SUFFIX}"

# Signup Alice
ALICE_RES=$(curl -k -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE_EMAIL\",\"username\":\"alice_${SUFFIX}\",\"password\":\"test1234\"}")

ALICE_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).token || '')" "$ALICE_RES")
ALICE_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user?.id || '')" "$ALICE_RES")

if [ -z "$ALICE_TOKEN" ] || [ -z "$ALICE_ID" ]; then
  echo "Échec de l'inscription pour Alice: $ALICE_RES"
  exit 1
fi
echo "Alice créée (ID: $ALICE_ID)"

# Signup Bob
BOB_RES=$(curl -k -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB_EMAIL\",\"username\":\"$BOB_USERNAME\",\"password\":\"test1234\"}")

BOB_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).token || '')" "$BOB_RES")
BOB_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user?.id || '')" "$BOB_RES")

if [ -z "$BOB_TOKEN" ] || [ -z "$BOB_ID" ]; then
  echo "Échec de l'inscription pour Bob: $BOB_RES"
  exit 1
fi
echo "Bob créé (ID: $BOB_ID)"

echo ""
echo "=== 3. Recherche d'un utilisateur par pseudo ==="

# Alice cherche Bob par son pseudo
echo "Alice cherche Bob par son pseudo..."
LOOKUP_STATUS=$(curl -k -s -o "$WORKDIR/lookup.json" -w "%{http_code}" \
  "$BASE_URL/api/user/users/by-username/$BOB_USERNAME" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if [ "$LOOKUP_STATUS" -ne 200 ]; then
  echo "Échec de la recherche par pseudo (code HTTP $LOOKUP_STATUS)"
  cat "$WORKDIR/lookup.json"
  exit 1
fi

LOOKUP_RES=$(cat "$WORKDIR/lookup.json")
LOOKUP_ID=$(node -e "console.log(JSON.parse(process.argv[1]).id || '')" "$LOOKUP_RES")
LOOKUP_USERNAME=$(node -e "console.log(JSON.parse(process.argv[1]).username || '')" "$LOOKUP_RES")

if [ "$LOOKUP_ID" != "$BOB_ID" ] || [ "$LOOKUP_USERNAME" != "$BOB_USERNAME" ]; then
  echo "La recherche ne renvoie pas Bob"
  echo "Réponse reçue : $LOOKUP_RES"
  exit 1
fi
echo "Bob retrouvé par son pseudo (ID: $LOOKUP_ID)"

# La réponse ne doit contenir que le profil public
echo "Vérification que seuls les champs publics sont renvoyés..."
PRIVATE_FIELDS=$(node -e "
  const res = JSON.parse(process.argv[1]);
  const forbidden = ['email', 'password', 'passwordHash', 'twoFactorSecret'];
  console.log(forbidden.filter((f) => f in res).join(','));
" "$LOOKUP_RES")

if [ -n "$PRIVATE_FIELDS" ]; then
  echo "La recherche expose des champs privés : $PRIVATE_FIELDS"
  exit 1
fi
echo "Seuls les champs publics sont renvoyés"

# Un pseudo inexistant renvoie 404
echo "Recherche d'un pseudo inexistant..."
UNKNOWN_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/user/users/by-username/personne_${SUFFIX}" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if [ "$UNKNOWN_STATUS" -ne 404 ]; then
  echo "Un pseudo inexistant doit renvoyer 404 (code HTTP $UNKNOWN_STATUS)"
  exit 1
fi
echo "Pseudo inexistant : 404"

# Sans authentification, la route est refusée
echo "Recherche sans être connecté..."
NOAUTH_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/user/users/by-username/$BOB_USERNAME")

if [ "$NOAUTH_STATUS" -ne 401 ]; then
  echo "Sans authentification, la route doit renvoyer 401 (code HTTP $NOAUTH_STATUS)"
  exit 1
fi
echo "Sans authentification : 401"

# La recherche est sensible à la casse
echo "Recherche avec une casse différente..."
UPPER_USERNAME=$(echo "$BOB_USERNAME" | tr '[:lower:]' '[:upper:]')
CASE_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/user/users/by-username/$UPPER_USERNAME" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if [ "$CASE_STATUS" -ne 404 ]; then
  echo "La recherche doit être sensible à la casse (code HTTP $CASE_STATUS)"
  exit 1
fi
echo "Casse différente : 404"

echo ""
echo "=== 4. Activation de la 2FA ==="
CAROL_EMAIL="carol_${SUFFIX}@test.com"

CAROL_RES=$(curl -k -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CAROL_EMAIL\",\"username\":\"carol_${SUFFIX}\",\"password\":\"test1234\"}")

CAROL_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).token || '')" "$CAROL_RES")
CAROL_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user?.id || '')" "$CAROL_RES")

if [ -z "$CAROL_TOKEN" ] || [ -z "$CAROL_ID" ]; then
  echo "Échec de l'inscription pour Carol: $CAROL_RES"
  exit 1
fi
echo "Carol créée (ID: $CAROL_ID)"

carol_secret() {
  db "SELECT \"twoFactorSecret\" FROM \"User\" WHERE id = '$CAROL_ID';"
}

enable_2fa() {
  curl -k -s -o "$WORKDIR/enable.json" -w "%{http_code}" -X POST \
    "$BASE_URL/api/auth/2fa/enable" \
    -H "Authorization: Bearer $CAROL_TOKEN"
}

# Première activation : un secret en attente est créé, la 2FA n'est pas encore active
echo "Carol demande l'activation de la 2FA..."
STATUS=$(enable_2fa)
if [ "$STATUS" -ne 200 ]; then
  echo "Échec de l'activation (code HTTP $STATUS)"
  cat "$WORKDIR/enable.json"
  exit 1
fi
if ! node -e "process.exit(JSON.parse(require('fs').readFileSync(process.argv[1])).qrCode ? 0 : 1)" "$WORKDIR/enable.json"; then
  echo "La réponse doit contenir un qrCode"
  exit 1
fi
SECRET_1=$(carol_secret)
ENABLED=$(db "SELECT \"twoFactorSecretEnabled\" FROM \"User\" WHERE id = '$CAROL_ID';")
if [ -z "$SECRET_1" ]; then
  echo "Un secret doit être enregistré"
  exit 1
fi
if [ "$ENABLED" != "f" ]; then
  echo "La 2FA ne doit pas être active avant confirmation (twoFactorSecretEnabled = $ENABLED)"
  exit 1
fi
echo "Secret en attente créé, 2FA pas encore active"

# Tant que la 2FA n'est pas confirmée, redemander un QR code est autorisé
echo "Carol redemande un QR code avant de confirmer..."
STATUS=$(enable_2fa)
if [ "$STATUS" -ne 200 ]; then
  echo "Redemander un QR code avant confirmation doit être autorisé (code HTTP $STATUS)"
  exit 1
fi
SECRET_2=$(carol_secret)
if [ "$SECRET_2" = "$SECRET_1" ]; then
  echo "Un nouveau secret doit être généré tant que la 2FA n'est pas confirmée"
  exit 1
fi
echo "Nouveau secret généré (2FA pas encore confirmée)"

# On simule une 2FA confirmée
db "UPDATE \"User\" SET \"twoFactorSecretEnabled\" = true WHERE id = '$CAROL_ID';" >/dev/null

# Une fois la 2FA active, une nouvelle activation est refusée et le secret ne bouge pas
echo "Carol (2FA active) redemande l'activation..."
STATUS=$(enable_2fa)
if [ "$STATUS" -ne 409 ]; then
  echo "Réactiver une 2FA déjà active doit renvoyer 409 (code HTTP $STATUS)"
  cat "$WORKDIR/enable.json"
  exit 1
fi
SECRET_3=$(carol_secret)
if [ "$SECRET_3" != "$SECRET_2" ]; then
  echo "Le secret d'une 2FA active ne doit jamais être remplacé"
  exit 1
fi
echo "Réactivation refusée (409), secret inchangé"

# Plusieurs appels d'affilée ne changent rien non plus
echo "Appels répétés sur une 2FA active..."
for i in 1 2 3; do
  STATUS=$(enable_2fa)
  if [ "$STATUS" -ne 409 ]; then
    echo "Appel $i : doit renvoyer 409 (code HTTP $STATUS)"
    exit 1
  fi
done
if [ "$(carol_secret)" != "$SECRET_2" ]; then
  echo "Le secret a changé après des appels répétés"
  exit 1
fi
echo "Appels répétés : toujours 409, secret inchangé"

# Sans authentification, la route est refusée
STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/2fa/enable")
if [ "$STATUS" -ne 401 ]; then
  echo "Sans authentification, la route doit renvoyer 401 (code HTTP $STATUS)"
  exit 1
fi
echo "Sans authentification : 401"

echo ""
echo "=== 5. Leaderboard ==="

# Lit un champ d'un JSON : json <fichier> <expression JS sur r>
json() {
  node -e "const r = JSON.parse(require('fs').readFileSync(process.argv[1])); console.log($2)" "$1"
}

lb_get() {
  # lb_get <chemin> <token|""> : écrit la réponse dans $WORKDIR/lb.json et renvoie le code HTTP
  if [ -n "$2" ]; then
    curl -k -s -o "$WORKDIR/lb.json" -w "%{http_code}" "$BASE_URL/api/user$1" \
      -H "Authorization: Bearer $2"
  else
    curl -k -s -o "$WORKDIR/lb.json" -w "%{http_code}" "$BASE_URL/api/user$1"
  fi
}

fail() {
  echo "$1"
  cat "$WORKDIR/lb.json" 2>/dev/null && echo ""
  exit 1
}

# Alice et Bob passent tout en haut du classement
db "UPDATE \"User\" SET elo = 999999 WHERE id = '$ALICE_ID';" >/dev/null
db "UPDATE \"User\" SET elo = 999998 WHERE id = '$BOB_ID';" >/dev/null

echo "Top 10 par défaut..."
[ "$(lb_get /leaderboard "$ALICE_TOKEN")" -eq 200 ] || fail "GET /leaderboard doit renvoyer 200"
COUNT=$(json "$WORKDIR/lb.json" "r.leaderboard.length")
[ "$COUNT" -ge 2 ] && [ "$COUNT" -le 10 ] || fail "Le classement doit contenir entre 2 et 10 joueurs, en a $COUNT"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[0].id")" = "$ALICE_ID" ] || fail "Alice doit être 1re"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[0].rank")" = "1" ] || fail "Alice doit avoir le rang 1"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[1].id")" = "$BOB_ID" ] || fail "Bob doit être 2e"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[1].rank")" = "2" ] || fail "Bob doit avoir le rang 2"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[0].elo")" = "999999" ] || fail "L'ELO d'Alice doit être renvoyé"
echo "Alice 1re, Bob 2e"

echo "Classement trié par ELO décroissant..."
SORTED=$(json "$WORKDIR/lb.json" "r.leaderboard.every((e, i, a) => i === 0 || a[i - 1].elo >= e.elo)")
[ "$SORTED" = "true" ] || fail "Le classement doit être trié par ELO décroissant"
echo "Tri correct"

echo "Seuls les champs publics sont renvoyés..."
LEAK=$(json "$WORKDIR/lb.json" "r.leaderboard.some((e) => ['email', 'password', 'passwordHash', 'twoFactorSecret'].some((f) => f in e))")
[ "$LEAK" = "false" ] || fail "Le classement expose des champs privés"
echo "Aucun champ privé"

echo "Paramètre limit..."
[ "$(lb_get "/leaderboard?limit=1" "$ALICE_TOKEN")" -eq 200 ] || fail "limit=1 doit renvoyer 200"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard.length")" = "1" ] || fail "limit=1 doit renvoyer 1 joueur"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[0].id")" = "$ALICE_ID" ] || fail "limit=1 doit renvoyer Alice"

[ "$(lb_get "/leaderboard?limit=2.5" "$ALICE_TOKEN")" -eq 200 ] || fail "limit=2.5 doit être accepté (arrondi à 2)"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard.length")" = "2" ] || fail "limit=2.5 doit renvoyer 2 joueurs"

[ "$(lb_get "/leaderboard?limit=abc" "$ALICE_TOKEN")" -eq 200 ] || fail "limit=abc doit retomber sur la valeur par défaut"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard.length <= 10")" = "true" ] || fail "limit=abc doit renvoyer au plus 10 joueurs"

[ "$(lb_get "/leaderboard?limit=-5" "$ALICE_TOKEN")" -eq 200 ] || fail "limit=-5 doit être accepté (ramené à 1)"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard.length")" = "1" ] || fail "limit=-5 doit renvoyer 1 joueur"

[ "$(lb_get "/leaderboard?limit=100000" "$ALICE_TOKEN")" -eq 200 ] || fail "limit=100000 doit être accepté (plafonné à 100)"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard.length <= 100")" = "true" ] || fail "limit doit être plafonné à 100"
echo "limit : 1, décimal, texte, négatif et énorme gérés"

echo "Rang du joueur connecté..."
[ "$(lb_get /leaderboard/me "$ALICE_TOKEN")" -eq 200 ] || fail "GET /leaderboard/me doit renvoyer 200"
[ "$(json "$WORKDIR/lb.json" "r.rank")" = "1" ] || fail "Alice doit être 1re dans /me"
[ "$(json "$WORKDIR/lb.json" "r.id")" = "$ALICE_ID" ] || fail "/me doit renvoyer Alice"
[ "$(json "$WORKDIR/lb.json" "'email' in r")" = "false" ] || fail "/me ne doit pas exposer l'email"

[ "$(lb_get /leaderboard/me "$BOB_TOKEN")" -eq 200 ] || fail "GET /leaderboard/me doit renvoyer 200 pour Bob"
[ "$(json "$WORKDIR/lb.json" "r.rank")" = "2" ] || fail "Bob doit être 2e dans /me"
echo "Alice rang 1, Bob rang 2"

echo "Rang d'un joueur hors du top..."
[ "$(lb_get /leaderboard/me "$CAROL_TOKEN")" -eq 200 ] || fail "GET /leaderboard/me doit renvoyer 200 pour Carol"
CAROL_RANK=$(json "$WORKDIR/lb.json" "r.rank")
CAROL_ELO=$(json "$WORKDIR/lb.json" "r.elo")
BETTER=$(db "SELECT COUNT(*) FROM \"User\" WHERE elo > $CAROL_ELO;" | tr -d '[:space:]')
[ "$CAROL_RANK" = "$((BETTER + 1))" ] || fail "Le rang de Carol doit valoir 1 + le nombre de joueurs mieux classés ($((BETTER + 1))), vaut $CAROL_RANK"
[ "$CAROL_RANK" -gt 2 ] || fail "Carol doit être derrière Alice et Bob"
echo "Carol rang $CAROL_RANK, cohérent avec la base"

echo "Égalité entre Alice et Bob..."
db "UPDATE \"User\" SET elo = 999999 WHERE id = '$BOB_ID';" >/dev/null
[ "$(lb_get /leaderboard "$ALICE_TOKEN")" -eq 200 ] || fail "GET /leaderboard doit renvoyer 200"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[0].rank")" = "1" ] || fail "En cas d'égalité, le 1er doit avoir le rang 1"
[ "$(json "$WORKDIR/lb.json" "r.leaderboard[1].rank")" = "1" ] || fail "En cas d'égalité, le 2e doit aussi avoir le rang 1"
THIRD_RANK=$(json "$WORKDIR/lb.json" "r.leaderboard[2] ? r.leaderboard[2].rank : 3")
[ "$THIRD_RANK" = "3" ] || fail "Après deux ex aequo au rang 1, le suivant doit être 3e, est $THIRD_RANK"
FIRST_TWO=$(json "$WORKDIR/lb.json" "r.leaderboard.slice(0, 2).map((e) => e.id).sort().join(',')")
EXPECTED=$(printf '%s\n%s\n' "$ALICE_ID" "$BOB_ID" | sort | paste -sd, -)
[ "$FIRST_TWO" = "$EXPECTED" ] || fail "Alice et Bob doivent occuper les deux premières places"

[ "$(lb_get /leaderboard/me "$BOB_TOKEN")" -eq 200 ] || fail "GET /leaderboard/me doit renvoyer 200 pour Bob"
[ "$(json "$WORKDIR/lb.json" "r.rank")" = "1" ] || fail "Bob ex aequo doit avoir le rang 1 dans /me"
echo "Ex aequo au rang 1, le suivant au rang 3"

echo "Ordre stable entre deux appels..."
lb_get /leaderboard "$ALICE_TOKEN" >/dev/null
ORDER_1=$(json "$WORKDIR/lb.json" "r.leaderboard.map((e) => e.id).join(',')")
lb_get /leaderboard "$ALICE_TOKEN" >/dev/null
ORDER_2=$(json "$WORKDIR/lb.json" "r.leaderboard.map((e) => e.id).join(',')")
[ "$ORDER_1" = "$ORDER_2" ] || fail "L'ordre du classement doit être le même d'un appel à l'autre"
echo "Ordre stable"

echo "Sans authentification..."
[ "$(lb_get /leaderboard "")" -eq 401 ] || fail "GET /leaderboard sans auth doit renvoyer 401"
[ "$(lb_get /leaderboard/me "")" -eq 401 ] || fail "GET /leaderboard/me sans auth doit renvoyer 401"
echo "Sans authentification : 401"

echo ""
echo "=== 6. Workflow d'amitié ==="

# Alice envoie une demande à Bob, avec l'id trouvé par la recherche
echo "Alice envoie une demande à Bob (id trouvé par son pseudo)..."
curl -k -fsSL -X POST "$BASE_URL/api/user/friends/request/$LOOKUP_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null

# Bob consulte les demandes reçues
echo "Bob consulte ses demandes reçues..."
BOB_RECEIVED=$(curl -k -fsSL "$BASE_URL/api/user/friends/requests/received" \
  -H "Authorization: Bearer $BOB_TOKEN")

if ! echo "$BOB_RECEIVED" | grep -q "$ALICE_ID"; then
  echo "La demande d'Alice n'apparaît pas chez Bob"
  echo "Réponse reçue : $BOB_RECEIVED"
  exit 1
fi

# Bob accepte la demande
echo "Bob accepte la demande d'Alice (ID: $ALICE_ID)..."
curl -k -fsSL -X POST "$BASE_URL/api/user/friends/accept/$ALICE_ID" \
  -H "Authorization: Bearer $BOB_TOKEN" > /dev/null

# Vérification mutuelle de la liste d'amis
echo "Vérification des listes d'amis..."
ALICE_FRIENDS=$(curl -k -fsSL "$BASE_URL/api/user/friends" \
  -H "Authorization: Bearer $ALICE_TOKEN")
BOB_FRIENDS=$(curl -k -fsSL "$BASE_URL/api/user/friends" \
  -H "Authorization: Bearer $BOB_TOKEN")

if echo "$ALICE_FRIENDS" | grep -q "$BOB_ID" && echo "$BOB_FRIENDS" | grep -q "$ALICE_ID"; then
  echo "Alice et Bob sont bien amis"
else
  echo "Échec de la validation de la liste d'amis"
  echo "Amis d'Alice: $ALICE_FRIENDS"
  echo "Amis de Bob: $BOB_FRIENDS"
  exit 1
fi

# Alice supprime Bob
echo "Alice supprime Bob de ses amis..."
curl -k -fsSL -X DELETE "$BASE_URL/api/user/friends/$BOB_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null

# Vérification de la suppression
echo "Vérification de la suppression..."
ALICE_FRIENDS_AFTER=$(curl -k -fsSL "$BASE_URL/api/user/friends" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if echo "$ALICE_FRIENDS_AFTER" | grep -q "$BOB_ID"; then
  echo "Bob est toujours dans la liste d'amis d'Alice après suppression"
  echo "Amis d'Alice: $ALICE_FRIENDS_AFTER"
  exit 1
fi

echo ""
echo "=== 7. Match History ==="

# Re-add friendship for game creation
curl -k -fsSL -X POST "$BASE_URL/api/user/friends/request/$BOB_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null
curl -k -fsSL -X POST "$BASE_URL/api/user/friends/accept/$ALICE_ID" \
  -H "Authorization: Bearer $BOB_TOKEN" > /dev/null

echo "GET match history pour Alice..."
HISTORY_STATUS=$(curl -k -s -o "$WORKDIR/history.json" -w "%{http_code}" \
  "$BASE_URL/api/game/games/history" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if [ "$HISTORY_STATUS" -ne 200 ]; then
  echo "Échec du match history (code HTTP $HISTORY_STATUS)"
  exit 1
fi
echo "Match history OK (200)"

echo ""
echo "Tous les tests d'API sont validés !"