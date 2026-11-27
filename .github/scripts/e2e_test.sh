WORKDIR=$(mktemp -d)

BASE_URL="${BASE_URL:-https://127.0.0.1:8443}"

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
FRONTEND_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
USER_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/user/health")
GAME_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/game/health")
CHAT_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/chat/health")

echo "Frontend: $FRONTEND_STATUS | User: $USER_STATUS | Game: $GAME_STATUS | Chat: $CHAT_STATUS"

if [ "$FRONTEND_STATUS" -ne 200 ] || [ "$USER_STATUS" -ne 200 ] || [ "$GAME_STATUS" -ne 200 ] || [ "$CHAT_STATUS" -ne 200 ]; then
  echo "::error::One or more Gateway routes failed health check"
  exit 1
fi

echo "=== 2. Testing User Signup (Positive: 201) ==="
SIGNUP_STATUS=$(curl -k -s -o "$WORKDIR/signup.json" -w "%{http_code}" -X POST "$BASE_URL/api/auth/signup" \
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
DUP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")
echo "Duplicate Signup HTTP Status: $DUP_STATUS"
if [ "$DUP_STATUS" -ne 409 ]; then
  echo "::error::Expected 409 on duplicate signup, got HTTP $DUP_STATUS"
  exit 1
fi

echo "=== 4. Testing Invalid Login (Negative: 401) ==="
INVALID_LOGIN_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpassword\"}")
echo "Invalid Login HTTP Status: $INVALID_LOGIN_STATUS"
if [ "$INVALID_LOGIN_STATUS" -ne 401 ]; then
  echo "::error::Expected 401 on invalid password, got HTTP $INVALID_LOGIN_STATUS"
  exit 1
fi

echo "=== 5. Testing Valid User Login (Positive: 200) ==="
LOGIN_STATUS=$(curl -k -s -D "$WORKDIR/login.headers" -o "$WORKDIR/login.json" -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "Login HTTP Status: $LOGIN_STATUS"
cat "$WORKDIR/login.json"
echo ""
if [ "$LOGIN_STATUS" -ne 200 ]; then
  echo "::error::User login failed with HTTP $LOGIN_STATUS"
  exit 1
fi

# The session is only in the HttpOnly cookie (audit F-08): read it from the
# Set-Cookie header, like a browser would
TOKEN=$(sed -n 's/^[Ss]et-[Cc]ookie: access_token=\([^;]*\).*/\1/p' "$WORKDIR/login.headers" | tr -d '\r' | head -n 1)

echo "=== 6. Testing Protected Route /me (Positive: 200) ==="
ME_STATUS=$(curl -k -s -o "$WORKDIR/me.json" -w "%{http_code}" -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN")
echo "Me HTTP Status: $ME_STATUS"
cat "$WORKDIR/me.json"
echo ""
if [ "$ME_STATUS" -ne 200 ]; then
  echo "::error::Protected route access failed with HTTP $ME_STATUS"
  exit 1
fi

# The website asks /session: always 200, so that a visitor never gets a 401
# logged as an error in the browser console
check_session() {
  local label="$1" expected="$2"
  shift 2
  local status
  status=$(curl -k -s -o "$WORKDIR/session.json" -w "%{http_code}" "$@" "$BASE_URL/api/auth/session")
  echo "$label HTTP Status: $status"
  cat "$WORKDIR/session.json"
  echo ""
  if [ "$status" -ne 200 ] || ! grep -q "$expected" "$WORKDIR/session.json"; then
    echo "::error::/session $label: expected 200 with $expected"
    exit 1
  fi
}

echo "=== 7. Testing /session for a visitor (200, user null) ==="
check_session "Visitor" '"user":null'

echo "=== 8. Testing /session with a bad token (200, user null) ==="
check_session "Bad token" '"user":null' -H "Cookie: access_token=not-a-token"

echo "=== 9. Testing /session when connected (200, the user) ==="
check_session "Connected" "\"email\":\"$EMAIL\"" -H "Cookie: access_token=$TOKEN"

echo "=== 10. Testing /session after logout (200, user null) ==="
curl -k -s -o /dev/null -X POST "$BASE_URL/api/auth/logout" -H "Cookie: access_token=$TOKEN"
check_session "After logout" '"user":null' -H "Cookie: access_token=$TOKEN"

echo "=== All integration, routing, and negative tests passed successfully! ==="