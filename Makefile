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

COMPOSE  = docker compose

# TLS certificate of the gateway (self-signed, generated once)
SSL_DIR  = gateway/ssl
SSL_KEY  = $(SSL_DIR)/transcendence.key
SSL_CRT  = $(SSL_DIR)/transcendence.crt

# Docker secrets, copied one by one from secrets.example/ when missing
SECRETS  = secrets/db_password.txt secrets/db_url.txt secrets/jwt_secret.txt

# node --version 22.x needed
NODE_MAJOR = 22

# Service whose logs "make log" shows: make log SERVICE=auth
SERVICE ?=

# **************************************************************************** #
#                                   .PHONY                                     #
# **************************************************************************** #

.PHONY: all install build up down logs log ps clean fclean re lint lint-fix test help

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
	$(ECHO) "  $(CYAN)make up$(RESET)             build and start the whole project in the background"
	$(ECHO) "  $(CYAN)make down$(RESET)           stop the project"
	$(ECHO) "  $(CYAN)make logs$(RESET)           follow the logs of all the services"
	$(ECHO) "  $(CYAN)make log SERVICE=<name>$(RESET) follow the logs of one service (auth, user, chat, game, frontend, gateway...)"
	$(ECHO) "  $(CYAN)make ps$(RESET)             show the state of the services"
	$(ECHO) "  $(CYAN)make lint$(RESET)           ESLint and Prettier check (Node $(NODE_MAJOR).x needed)"
	$(ECHO) "  $(CYAN)make lint-fix$(RESET)       ESLint --fix and Prettier --write on the whole project"
	$(ECHO) "  $(CYAN)make test$(RESET)           start the project, then run all the tests"
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
	port=$$(sed -n 's/^HTTPS_PORT=//p' .env | tail -n 1)
	$(ECHO) "$(GREEN)✓ Application : https://localhost:$${port:-8443}$(RESET)"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f --tail=100

# Logs of one service, named by the SERVICE argument
log:
	if [ -z "$(SERVICE)" ]; then
		$(ECHO) "$(RED)✗ Service manquant : make log SERVICE=<nom>$(RESET)"
		$(ECHO) "Services : $$($(COMPOSE) config --services | tr '\n' ' ')"
		exit 1
	fi
	$(COMPOSE) logs -f --tail=100 $(SERVICE)

ps:
	$(COMPOSE) ps

# Shell code that stops when node is missing or is not the expected version
define NODE_CHECK
if ! command -v node >/dev/null 2>&1; then
	$(ECHO) "$(RED)✗ node est requis (version $(NODE_MAJOR).x)$(RESET)"
	exit 1
fi
major=$$(node -p 'process.versions.node.split(".")[0]')
if [ "$$major" != "$(NODE_MAJOR)" ]; then
	$(ECHO) "$(RED)✗ Node $(NODE_MAJOR).x requis, version trouvée : $$(node --version)$(RESET)"
	exit 1
fi
endef

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

clean: down

# Also removes the volumes (the database is lost) and the certificate.
# .env and secrets/ are kept: they hold your settings and the database password.
fclean:
	$(COMPOSE) down -v
	rm -f $(SSL_KEY) $(SSL_CRT)
	$(ECHO) "$(GREEN)✓ volumes et certificat supprimés$(RESET)"

re: fclean all
