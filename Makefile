.SILENT:
.ONESHELL:
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

# **************************************************************************** #
#                                   COLORS                                     #
# **************************************************************************** #

GREEN   := \033[0;32m
RED     := \033[0;31m
YELLOW  := \033[0;33m
CYAN    := \033[0;36m
RESET   := \033[0m

ECHO    := echo -e

# **************************************************************************** #
#                                  VARIABLES                                   #
# **************************************************************************** #

# Production by default: `-f docker-compose.yml` alone stops docker compose
# from loading docker-compose.override.yml (Vite dev server, tsx watch). The
# dev server must never be what the gateway serves (security audit F-02).
COMPOSE     = docker compose -f docker-compose.yml
COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.override.yml

# Database identifiers used by `make seed`; keep in sync with .env
DB_USER ?= transcendence_user
DB_NAME ?= transcendence_db

# TLS certificate of the gateway (self-signed, generated once)
SSL_DIR  = gateway/ssl
SSL_KEY  = $(SSL_DIR)/transcendence.key
SSL_CRT  = $(SSL_DIR)/transcendence.crt

# Docker secrets, copied one by one from secrets.example/ when missing
SECRETS  = secrets/db_password.txt secrets/db_url.txt secrets/jwt_secret.txt secrets/grafana_admin_password.txt

# node --version 22.x needed
NODE_MAJOR = 22

# Service whose logs "make log" shows: make log SERVICE=auth
SERVICE ?=

# Make seed default password for generated test users
PASSWORD = password123

# **************************************************************************** #
#                                   .PHONY                                     #
# **************************************************************************** #

.PHONY: all install build up dev down logs log ps clean fclean re lint lint-fix test seed seed-leaderboard help

.DEFAULT_GOAL := all

# **************************************************************************** #
#                                    Help                                      #
# **************************************************************************** #

# Show available make commands.
help:
	$(ECHO) "$(YELLOW)Available commands:$(RESET)"
	$(ECHO) ""
	$(ECHO) "  $(CYAN)make$(RESET) / $(CYAN)make all$(RESET)   install (.env, secrets, certificate) and build the images (nothing is started)"
	$(ECHO) "  $(CYAN)make install$(RESET)        create what is missing: .env, secrets and TLS certificate (nothing is overwritten)"
	$(ECHO) "  $(CYAN)make build$(RESET)          build the Docker images"
	$(ECHO) "  $(CYAN)make up$(RESET)             build and start the whole project in the background (production)"
	$(ECHO) "  $(CYAN)make dev$(RESET)            same, in development mode (hot reload; never on a shared machine)"
	$(ECHO) "  $(CYAN)make down$(RESET)           stop the project"
	$(ECHO) "  $(CYAN)make logs$(RESET)           follow the logs of all the services"
	$(ECHO) "  $(CYAN)make log SERVICE=<name>$(RESET) follow the logs of one service (auth, user, chat, game, frontend, gateway...)"
	$(ECHO) "  $(CYAN)make ps$(RESET)             show the state of the services"
	$(ECHO) "  $(CYAN)make lint$(RESET)           ESLint and Prettier check (Node $(NODE_MAJOR).x needed)"
	$(ECHO) "  $(CYAN)make lint-fix$(RESET)       ESLint --fix and Prettier --write on the whole project"
	$(ECHO) "  $(CYAN)make test$(RESET)           start the project, then run all the tests"
	$(ECHO) "  $(CYAN)make seed PASSWORD=<value>$(RESET)  insert three debug users (alice, bob, charlie)"
	$(ECHO) "  $(CYAN)make seed-leaderboard PASSWORD=<value>$(RESET)  insert 10 ranked users for the leaderboard"
	$(ECHO) "  $(CYAN)make clean$(RESET)          stop the project (same as down)"
	$(ECHO) "  $(CYAN)make fclean$(RESET)         stop the project, delete its volumes (database included) and the certificate"
	$(ECHO) "  $(CYAN)make re$(RESET)             fclean, then all"

# **************************************************************************** #
#                                    Rules                                     #
# **************************************************************************** #

# Builds everything but does not start anything
all: install build

# Everything the project needs before it can be built: nothing existing is overwritten
install: .env $(SECRETS) $(SSL_CRT)
	$(ECHO) "$(GREEN)✓ .env, secrets et certificat prêts$(RESET)"

.env:
	cp .env.example $@
	$(ECHO) "$(GREEN)✓ $@ créé depuis .env.example$(RESET)"

secrets/%.txt: secrets.example/%.txt
	mkdir -p secrets
	cp $< $@
	$(ECHO) "$(GREEN)✓ $@ créé (valeur d'exemple, à changer hors développement)$(RESET)"

# The key is written by the same command as the certificate
$(SSL_CRT):
	$(ECHO) "$(CYAN)Génération du certificat TLS auto-signé...$(RESET)"
	mkdir -p $(SSL_DIR)
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout $(SSL_KEY) \
		-out $(SSL_CRT) \
		-subj "/C=FR/ST=GrandEst/L=Mulhouse/O=42/CN=localhost" 2>/dev/null
	chmod 600 $(SSL_KEY)
	chmod 644 $(SSL_CRT)
	$(ECHO) "$(GREEN)✓ $(SSL_CRT)$(RESET)"

# Build the Docker images
build: install
	$(COMPOSE) build

# Build and start the whole project in the background
up: install
	$(COMPOSE) up -d --build
	$(ECHO) "$(GREEN)✓ Application : https://localhost:$$(sed -n 's/^HTTPS_PORT=//p' .env | tail -n 1 | grep . || echo 8443)$(RESET)"

# Development: hot reload (Vite dev server, tsx watch), sources mounted.
# Never on a shared machine: it exposes the source code (audit F-02)
dev: install
	$(COMPOSE_DEV) up -d --build
	$(ECHO) "$(YELLOW)⚠ Mode développement (hot reload) : jamais sur une machine partagée$(RESET)"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

# Logs of one service, named by the SERVICE argument
log:
	@test -n "$(SERVICE)" || { $(ECHO) "$(RED)✗ Service manquant : make log SERVICE=<nom>$(RESET)"; $(ECHO) "Services : $$($(COMPOSE) config --services | tr '\n' ' ')"; exit 1; }
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

ps:
	$(COMPOSE) ps

# Shell code that stops when node is missing or is not the expected version.
# Written on ONE line on purpose: macOS ships GNU Make 3.81, which ignores
# .ONESHELL, so every recipe line is run in its own shell. A multi-line if/fi
# would be split across shells and fail with "unexpected end of file".
NODE_CHECK = command -v node >/dev/null 2>&1 || { $(ECHO) "$(RED)✗ node est requis (version $(NODE_MAJOR).x)$(RESET)"; exit 1; }; major=$$(node -p 'process.versions.node.split(".")[0]'); [ "$$major" = "$(NODE_MAJOR)" ] || { $(ECHO) "$(RED)✗ Node $(NODE_MAJOR).x requis, version trouvée : $$(node --version)$(RESET)"; exit 1; }

# Static checks (ESLint, Prettier)
lint:
	$(NODE_CHECK)
	npm run lint

# Same checks, but the files are rewritten: ESLint fixes what it can, Prettier formats everything
lint-fix:
	$(NODE_CHECK)
	npx eslint . --fix
	npx prettier --write .
	$(ECHO) "$(GREEN)✓ lint appliqué sur tout le projet$(RESET)"

# Needs the running project (API, WebSocket and end-to-end tests)
test: up
	npm run test-all

# Insert three debug users through the real /signup route, so the password is
# hashed by the service itself: no SQL and no hash to keep in sync.
# 409 means the user already exists, so the rule can be run again safely.
# The password is not stored in this file: make seed PASSWORD=<value>
seed:
	@test -n "$(PASSWORD)" || { $(ECHO) "$(RED)✗ Mot de passe manquant : make seed PASSWORD=<valeur>$(RESET)"; exit 1; }
	$(COMPOSE) exec -T -e SEED_PASSWORD='$(PASSWORD)' auth node --input-type=module -e 'for (const name of ["alice", "bob", "charlie"]) { const res = await fetch("http://127.0.0.1:3001/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: name + "@example.com", username: name, password: process.env.SEED_PASSWORD }) }); if (res.status !== 201 && res.status !== 409) { console.error(name, res.status, await res.text()); process.exit(1); } console.log(name, res.status === 201 ? "created" : "already exists"); }'
	$(COMPOSE) exec -T -e PGPASSWORD="$$(cat secrets/db_password.txt)" postgres psql -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1 -q -c "DELETE FROM \"DirectMessage\" WHERE (\"senderId\", \"receiverId\") IN (SELECT a.id, b.id FROM \"User\" a, \"User\" b WHERE a.username = 'alice' AND b.username = 'bob') OR (\"senderId\", \"receiverId\") IN (SELECT b.id, a.id FROM \"User\" a, \"User\" b WHERE a.username = 'alice' AND b.username = 'bob'); INSERT INTO \"DirectMessage\" (id, \"senderId\", \"receiverId\", content, \"messageType\", delivered, \"createdAt\") SELECT v.id::uuid, sender.id, receiver.id, v.content, 'text', true, now() - v.ago FROM (VALUES ('11111111-1111-4111-8111-111111111101', 'alice', 'bob', 'Hey Bob! Ready for a game?', interval '20 minutes'), ('11111111-1111-4111-8111-111111111102', 'bob', 'alice', 'Always. Give me 2 minutes', interval '18 minutes'), ('11111111-1111-4111-8111-111111111103', 'alice', 'bob', 'I will destroy you with a +4', interval '16 minutes'), ('11111111-1111-4111-8111-111111111104', 'bob', 'alice', 'Bold words for someone with 3 cards left', interval '14 minutes'), ('11111111-1111-4111-8111-111111111105', 'alice', 'bob', 'UNO!', interval '12 minutes'), ('11111111-1111-4111-8111-111111111106', 'bob', 'alice', 'Not so fast, I still have a skip', interval '10 minutes'), ('11111111-1111-4111-8111-111111111107', 'alice', 'bob', 'You are bluffing, I can feel it', interval '8 minutes'), ('11111111-1111-4111-8111-111111111108', 'bob', 'alice', 'Maybe. Draw four and find out', interval '6 minutes'), ('11111111-1111-4111-8111-111111111109', 'alice', 'bob', 'Okay okay, rematch after this one', interval '4 minutes'), ('11111111-1111-4111-8111-111111111110', 'bob', 'alice', 'Deal. Loser buys the coffee', interval '2 minutes')) AS v(id, sender, receiver, content, ago) JOIN \"User\" sender ON sender.username = v.sender JOIN \"User\" receiver ON receiver.username = v.receiver;"
	$(ECHO) "$(GREEN)✓ Utilisateurs de debug prêts : alice, bob, charlie$(RESET)"
	$(ECHO) "$(GREEN)✓ Conversation de debug alice <-> bob insérée (10 messages)$(RESET)"

# Ten ranked users for the leaderboard, plus "Alice" who stays outside the top 10.
# Same idea as `make seed`: accounts go through the real /signup route (bcrypt is
# done by the service), then their elo is set with SQL because no route exposes it.
# Idempotent: users already present are skipped, and elo is simply overwritten.
# The 10 ranked users end up between 1050 and 1500 elo; Alice has 992, so with a
# top 10 she is never shown and fetchMyRank() must fetch her line separately.
seed-leaderboard:
	@test -n "$(PASSWORD)" || { $(ECHO) "$(RED)✗ Mot de passe manquant : make seed-leaderboard PASSWORD=<valeur>$(RESET)"; exit 1; }
	$(COMPOSE) exec -T -e SEED_PASSWORD='$(PASSWORD)' auth node --input-type=module -e 'const names = ["ranked01", "ranked02", "ranked03", "ranked04", "ranked05", "ranked06", "ranked07", "ranked08", "ranked09", "ranked10", "alice"]; for (const name of names) { const res = await fetch("http://127.0.0.1:3001/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: name + "@example.com", username: name, password: process.env.SEED_PASSWORD }) }); if (res.status !== 201 && res.status !== 409) { console.error(name, res.status, await res.text()); process.exit(1); } console.log(name, res.status === 201 ? "created" : "already exists"); }'
	$(COMPOSE) exec -T -e PGPASSWORD="$$(cat secrets/db_password.txt)" postgres psql -U $(DB_USER) -d $(DB_NAME) -v ON_ERROR_STOP=1 -q -c "UPDATE \"User\" SET elo = v.elo FROM (VALUES ('ranked01', 1500), ('ranked02', 1420), ('ranked03', 1350), ('ranked04', 1290), ('ranked05', 1230), ('ranked06', 1180), ('ranked07', 1140), ('ranked08', 1100), ('ranked09', 1070), ('ranked10', 1050), ('alice', 992)) AS v(username, elo) WHERE \"User\".username = v.username;"
	$(ECHO) "$(GREEN)✓ 10 utilisateurs classés prêts : ranked01..ranked10 (1500 → 1050 elo)$(RESET)"
	$(ECHO) "$(GREEN)✓ Alice prête avec 992 elo : hors du top 10$(RESET)"

clean: down

# Also removes the volumes (the database is lost) and the certificate.
# .env and secrets/ are kept: they hold your settings and the database password.
fclean:
	$(COMPOSE) down -v
	rm -f $(SSL_KEY) $(SSL_CRT)
	$(ECHO) "$(GREEN)✓ volumes et certificat supprimés$(RESET)"

re: fclean all
