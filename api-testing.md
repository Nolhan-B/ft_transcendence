# API Testing - All Routes

Base URL: `localhost:8080`

---

## Auth Service (`/api/auth/`)

### Signup

```bash
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"test@test.com","username":"test","password":"test1234"}'
```

### Login

```bash
curl -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}'
```

### Me

```bash
curl localhost:8080/api/auth/me -H "Authorization: Bearer <token>"
```

### Delete Account (sans 2FA)

```bash
curl -X DELETE localhost:8080/api/auth/account -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"password":"test1234"}'
```

### Delete Account (avec 2FA)

```bash
curl -X DELETE localhost:8080/api/auth/account -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"password":"test1234","code":"123456"}'
```

---

## 2FA (`/api/auth/2fa/`)

### Enable (genere QR code)

```bash
curl -X POST localhost:8080/api/auth/2fa/enable -H "Authorization: Bearer <token>"
```

### Verify (scanner QR puis confirmer pour activer)

```bash
curl -X POST localhost:8080/api/auth/2fa/verify -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"code":"123456"}'
```

### Validate (au login quand 2FA active: tempToken + code -> vrai token)

```bash
curl -X POST localhost:8080/api/auth/2fa/validate -H "Content-Type: application/json" -d '{"tempToken":"eyJhbG...","code":"123456"}'
```

### Disable

```bash
curl -X POST localhost:8080/api/auth/2fa/disable -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"password":"test1234","code":"123456"}'
```

---

## User Service - Profile (`/api/user/`)

### Profil public (pas de JWT)

```bash
curl localhost:8080/api/user/profile/<user_id>
```

### Mon profil

```bash
curl localhost:8080/api/user/profile -H "Authorization: Bearer <token>"
```

### Modifier profil

```bash
curl -X PUT localhost:8080/api/user/profile -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"username":"newname"}'
```

### Upload avatar

```bash
curl -X PUT localhost:8080/api/user/profile/avatar -H "Authorization: Bearer <token>" -F "file=@/chemin/vers/image.png"
```

### Voir un avatar

```bash
curl localhost:8080/uploads/avatars/<filename>.png --output /tmp/avatar.png
```

---

## User Service - Friends (`/api/user/`)

### Liste d'amis

```bash
curl localhost:8080/api/user/friends -H "Authorization: Bearer <token>"
```

### Demandes recues

```bash
curl localhost:8080/api/user/friends/requests/received -H "Authorization: Bearer <token>"
```

### Demandes envoyees

```bash
curl localhost:8080/api/user/friends/requests/sent -H "Authorization: Bearer <token>"
```

### Envoyer demande d'ami

```bash
curl -X POST localhost:8080/api/user/friends/request/<user_id> -H "Authorization: Bearer <token>"
```

### Accepter demande d'ami

```bash
curl -X POST localhost:8080/api/user/friends/accept/<user_id> -H "Authorization: Bearer <token>"
```

### Supprimer ami / refuser demande

```bash
curl -X DELETE localhost:8080/api/user/friends/<user_id> -H "Authorization: Bearer <token>"
```

---

## Health checks

```bash
curl localhost:8080/api/auth/health
curl localhost:8080/api/user/health
curl localhost:8080/api/game/health
curl localhost:8080/api/chat/health
```

---

## Workflow complet de test

```bash
# 1. Creer deux users
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"alice@test.com","username":"alice","password":"test1234"}'
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"bob@test.com","username":"bob","password":"test1234"}'

# 2. Alice envoie une demande a Bob (utilise le token d'alice et l'id de bob)
curl -X POST localhost:8080/api/user/friends/request/<bob_id> -H "Authorization: Bearer <alice_token>"

# 3. Bob voit la demande recue
curl localhost:8080/api/user/friends/requests/received -H "Authorization: Bearer <bob_token>"

# 4. Bob accepte
curl -X POST localhost:8080/api/user/friends/accept/<alice_id> -H "Authorization: Bearer <bob_token>"

# 5. Les deux voient l'ami dans leur liste
curl localhost:8080/api/user/friends -H "Authorization: Bearer <alice_token>"
curl localhost:8080/api/user/friends -H "Authorization: Bearer <bob_token>"

# 6. Alice supprime Bob
curl -X DELETE localhost:8080/api/user/friends/<bob_id> -H "Authorization: Bearer <alice_token>"
```
