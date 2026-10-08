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
# Horodatage pour éviter les collisions si la base contient déjà des données
TIMESTAMP=$(date +%s)
ALICE_EMAIL="alice_${TIMESTAMP}@test.com"
BOB_EMAIL="bob_${TIMESTAMP}@test.com"

# Signup Alice
ALICE_RES=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE_EMAIL\",\"username\":\"alice_${TIMESTAMP}\",\"password\":\"test1234\"}")
ALICE_TOKEN=$(echo "$ALICE_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
ALICE_ID=$(echo "$ALICE_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$ALICE_TOKEN" ] || [ -z "$ALICE_ID" ]; then
  echo "Échec de l'inscription pour Alice: $ALICE_RES"
  exit 1
fi
echo "Alice créée (ID: $ALICE_ID)"

# Signup Bob
BOB_RES=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB_EMAIL\",\"username\":\"bob_${TIMESTAMP}\",\"password\":\"test1234\"}")
BOB_TOKEN=$(echo "$BOB_RES" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
BOB_ID=$(echo "$BOB_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

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

# Bob vérifie les demandes reçues
echo "Bob consulte ses demandes reçues..."
BOB_RECEIVED=$(curl -fsSL "$BASE_URL/api/user/friends/requests/received" \
  -H "Authorization: Bearer $BOB_TOKEN")
if ! echo "$BOB_RECEIVED" | grep -q "$ALICE_ID"; then
  echo "La demande d'Alice n'apparaît pas chez Bob"
  exit 1
fi

# Bob accepte la demande
echo "Bob accepte la demande..."
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
  exit 1
fi

# Alice supprime Bob
echo "Alice supprime Bob de ses amis..."
curl -fsSL -X DELETE "$BASE_URL/api/user/friends/$BOB_ID" \
  -H "Authorization: Bearer $ALICE_TOKEN" > /dev/null

echo ""
echo "Tous les tests d'API sont validés !"