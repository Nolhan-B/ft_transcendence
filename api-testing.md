# API Testing Commands

Base URL: `localhost:8080`

---

## Auth

### Signup
```bash
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"test@test.com","username":"test","password":"test1234"}'
```

### Login (sans 2FA)
```bash
curl -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}'
```

### Login (avec 2FA activee)
Renvoie un `tempToken` au lieu du vrai token.
```bash
curl -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}'
```

### Me (profil connecte)
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

## 2FA

### Enable (genere le QR code)
```bash
curl -X POST localhost:8080/api/auth/2fa/enable -H "Authorization: Bearer <token>"
```

### Verify (scanner le QR puis confirmer avec le code pour activer)
```bash
curl -X POST localhost:8080/api/auth/2fa/verify -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"code":"123456"}'
```

### Validate (au login quand 2FA active, echanger tempToken + code contre vrai token)
```bash
curl -X POST localhost:8080/api/auth/2fa/validate -H "Content-Type: application/json" -d '{"tempToken":"eyJhbG...","code":"123456"}'
```

### Disable (desactiver la 2FA)
```bash
curl -X POST localhost:8080/api/auth/2fa/disable -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"password":"test1234","code":"123456"}'
```

---

## 2FA - Workflow complet

```bash
# 1. Signup
curl -X POST localhost:8080/api/auth/signup -H "Content-Type: application/json" -d '{"email":"test@test.com","username":"test","password":"test1234"}'

# 2. Enable 2FA (copie le token du signup)
curl -X POST localhost:8080/api/auth/2fa/enable -H "Authorization: Bearer <token>"

# 3. Scanner le QR avec Google Authenticator, puis verify
curl -X POST localhost:8080/api/auth/2fa/verify -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"code":"123456"}'

# 4. Login (renvoie tempToken)
curl -X POST localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"test1234"}'

# 5. Validate (tempToken + code TOTP -> vrai token)
curl -X POST localhost:8080/api/auth/2fa/validate -H "Content-Type: application/json" -d '{"tempToken":"eyJhbG...","code":"123456"}'

# 6. Disable (vrai token + password + code TOTP)
curl -X POST localhost:8080/api/auth/2fa/disable -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"password":"test1234","code":"123456"}'
```

---

## User

### Profil public
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

### Liste d'amis
```bash
curl localhost:8080/api/user/friends -H "Authorization: Bearer <token>"
```

### Demandes d'amis recues
```bash
curl localhost:8080/api/user/friends/requests -H "Authorization: Bearer <token>"
```

### Envoyer demande d'ami
```bash
curl -X POST localhost:8080/api/user/friends/request/<user_id> -H "Authorization: Bearer <token>"
```

### Accepter demande d'ami
```bash
curl -X POST localhost:8080/api/user/friends/accept/<friendship_id> -H "Authorization: Bearer <token>"
```

### Supprimer ami
```bash
curl -X DELETE localhost:8080/api/user/friends/<friendship_id> -H "Authorization: Bearer <token>"
```

---

## Health checks
```bash
curl localhost:8080/api/auth/health
curl localhost:8080/api/user/health
curl localhost:8080/api/game/health
curl localhost:8080/api/chat/health
```