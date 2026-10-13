WORKDIR=$(mktemp -d)

cleanup() {
  rm -rf "$WORKDIR"
  docker compose exec -T postgres psql -U transcendence_user -d transcendence_db \
    -c "DELETE FROM \"User\" WHERE email LIKE 'cibot\_%@test.com';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SUFFIX="$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
EMAIL="cibot_${SUFFIX}@test.com"
USERNAME="cibot_${SUFFIX}"
PASSWORD="securepassword123"

echo "=== 1. Checking Gateway Routing ==="
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/)
USER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/user/health)
GAME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/game/health)
CHAT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/chat/health)

echo "Frontend: $FRONTEND_STATUS | User: $USER_STATUS | Game: $GAME_STATUS | Chat: $CHAT_STATUS"

if [ "$FRONTEND_STATUS" -ne 200 ] || [ "$USER_STATUS" -ne 200 ] || [ "$GAME_STATUS" -ne 200 ] || [ "$CHAT_STATUS" -ne 200 ]; then
  echo "::error::One or more Gateway routes failed health check"
  exit 1
fi

echo "=== 2. Testing User Signup (Positive: 201) ==="
SIGNUP_STATUS=$(curl -s -o "$WORKDIR/signup.json" -w "%{http_code}" -X POST http://127.0.0.1:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
echo "Signup HTTP Status: $SIGNUP_STATUS"
cat "$WORKDIR/signup.json"
echo ""
if [ "$SIGNUP_STATUS" -ne 201 ]; then
  echo "::error::User signup failed with HTTP $SIGNUP_STATUS"
  exit 1
fi

echo "=== 3. Testing Duplicate Signup (Negative: 409) ==="
DUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
echo "Duplicate Signup HTTP Status: $DUP_STATUS"
if [ "$DUP_STATUS" -ne 409 ]; then
  echo "::error::Expected 409 on duplicate signup, got HTTP $DUP_STATUS"
  exit 1
fi

echo "=== 4. Testing Invalid Login (Negative: 401) ==="
INVALID_LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpassword\"}")
echo "Invalid Login HTTP Status: $INVALID_LOGIN_STATUS"
if [ "$INVALID_LOGIN_STATUS" -ne 401 ]; then
  echo "::error::Expected 401 on invalid password, got HTTP $INVALID_LOGIN_STATUS"
  exit 1
fi

echo "=== 5. Testing Valid User Login (Positive: 200) ==="
LOGIN_STATUS=$(curl -s -o "$WORKDIR/login.json" -w "%{http_code}" -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "Login HTTP Status: $LOGIN_STATUS"
cat "$WORKDIR/login.json"
echo ""
if [ "$LOGIN_STATUS" -ne 200 ]; then
  echo "::error::User login failed with HTTP $LOGIN_STATUS"
  exit 1
fi

TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1])).token)" "$WORKDIR/login.json")

echo "=== 6. Testing Protected Route /me (Positive: 200) ==="
ME_STATUS=$(curl -s -o "$WORKDIR/me.json" -w "%{http_code}" -X GET http://127.0.0.1:8080/api/auth/me \
  -H "Authorization: Bearer $TOKEN")
echo "Me HTTP Status: $ME_STATUS"
cat "$WORKDIR/me.json"
echo ""
if [ "$ME_STATUS" -ne 200 ]; then
  echo "::error::Protected route access failed with HTTP $ME_STATUS"
  exit 1
fi

echo "=== All integration, routing, and negative tests passed successfully! ==="