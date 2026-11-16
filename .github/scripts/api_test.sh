#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://localhost:8443}"
WORKDIR=$(mktemp -d)

cleanup() {
  rm -rf "$WORKDIR"
  docker compose exec -T postgres psql -U transcendence_user -d transcendence_db \
    -c "DELETE FROM \"User\" WHERE email LIKE 'alice\_%@test.com' OR email LIKE 'bob\_%@test.com';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

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
echo "=== 4. Workflow d'amitié ==="

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
echo "=== 5. Match History ==="

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