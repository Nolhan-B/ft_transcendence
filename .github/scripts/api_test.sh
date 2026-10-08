#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:8080"

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
TIMESTAMP=$(date +%s)
ALICE_EMAIL="alice_${TIMESTAMP}@test.com"
BOB_EMAIL="bob_${TIMESTAMP}@test.com"

# Signup Alice
ALICE_RES=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE_EMAIL\",\"username\":\"alice_${TIMESTAMP}\",\"password\":\"test1234\"}")

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
  -d "{\"email\":\"$BOB_EMAIL\",\"username\":\"bob_${TIMESTAMP}\",\"password\":\"test1234\"}")

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

# Extraction de l'ID de la demande (Friendship ID)
REQUEST_ID=$(node -e '
  const res = JSON.parse(process.argv[1]);
  const reqs = res.receivedRequests || res.requests || res;
  const match = Array.isArray(reqs) ? reqs.find(r => r.userId === process.argv[2] || r.user?.id === process.argv[2]) : null;
  console.log(match ? match.id : "");
' "$BOB_RECEIVED" "$ALICE_ID")

# Si le service attend l'ID de la relation, on passe REQUEST_ID, sinon ALICE_ID
TARGET_ID="${REQUEST_ID:-$ALICE_ID}"

# Bob accepte la demande
echo "Bob accepte la demande (ID: $TARGET_ID)..."
curl -fsSL -X POST "$BASE_URL/api/user/friends/accept/$TARGET_ID" \
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

echo ""
echo "Tous les tests d'API sont validés !"