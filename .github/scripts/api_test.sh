#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:8080"

cleanup() {
  docker compose exec -T postgres psql -U transcendence_user -d transcendence_db \
    -c "DELETE FROM \"User\" WHERE email LIKE 'alice\_%@test.com' OR email LIKE 'bob\_%@test.com';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "=== 1. Health checks ==="
for svc in auth user game chat; do
  echo -n "Vérification $svc... "
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/$svc/health" || true)
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

# Signup Alice
ALICE_RES=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
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
BOB_RES=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB_EMAIL\",\"username\":\"bob_${SUFFIX}\",\"password\":\"test1234\"}")

BOB_TOKEN=$(node -e "console.log(JSON.parse(process.argv[1]).token || '')" "$BOB_RES")
BOB_ID=$(node -e "console.log(JSON.parse(process.argv[1]).user?.id || '')" "$BOB_RES")

if [ -z "$BOB_TOKEN" ] || [ -z "$BOB_ID" ]; then
  echo "Échec de l'inscription pour Bob: $BOB_RES"
  exit 1
fi
echo "Bob créé (ID: $BOB_ID)"

echo ""
echo "=== 3. Workflow d'amitié ==="

# Alice envoie une demande à Bob
echo "Alice envoie une demande à Bob..."
curl -fsSL -X POST "$BASE_URL/api/user/friends/request/$BOB_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null

# Bob consulte les demandes reçues
echo "Bob consulte ses demandes reçues..."
BOB_RECEIVED=$(curl -fsSL "$BASE_URL/api/user/friends/requests/received" \
  -H "Authorization: Bearer $BOB_TOKEN")

if ! echo "$BOB_RECEIVED" | grep -q "$ALICE_ID"; then
  echo "La demande d'Alice n'apparaît pas chez Bob"
  echo "Réponse reçue : $BOB_RECEIVED"
  exit 1
fi

# Bob accepte la demande : la route attend l'ID de l'utilisateur qui l'a envoyée
echo "Bob accepte la demande d'Alice (ID: $ALICE_ID)..."
curl -fsSL -X POST "$BASE_URL/api/user/friends/accept/$ALICE_ID" \
  -H "Authorization: Bearer $BOB_TOKEN" > /dev/null

# Vérification mutuelle de la liste d'amis
echo "Vérification des listes d'amis..."
ALICE_FRIENDS=$(curl -fsSL "$BASE_URL/api/user/friends" \
  -H "Authorization: Bearer $ALICE_TOKEN")
BOB_FRIENDS=$(curl -fsSL "$BASE_URL/api/user/friends" \
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
curl -fsSL -X DELETE "$BASE_URL/api/user/friends/$BOB_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null

# Vérification de la suppression
echo "Vérification de la suppression..."
ALICE_FRIENDS_AFTER=$(curl -fsSL "$BASE_URL/api/user/friends" \
  -H "Authorization: Bearer $ALICE_TOKEN")

if echo "$ALICE_FRIENDS_AFTER" | grep -q "$BOB_ID"; then
  echo "Bob est toujours dans la liste d'amis d'Alice après suppression"
  echo "Amis d'Alice: $ALICE_FRIENDS_AFTER"
  exit 1
fi

echo ""
echo "Tous les tests d'API sont validés !"