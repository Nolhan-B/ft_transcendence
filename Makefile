
install:
	@echo "=== Installation ==="
	cp -r secrets.example secrets
	[ -f .env ] || cp .env.example .env
	mkdir -p gateway/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	-keyout gateway/ssl/transcendence.key \
	-out gateway/ssl/transcendence.crt \
	-subj "/C=FR/ST=GrandEst/L=Mulhouse/O=42/CN=localhost"
	chmod 600 gateway/ssl/transcendence.key
	chmod 644 gateway/ssl/transcendence.crt
	docker compose build

build:
	docker compose build --no-cache

up:
	docker compose up -d --build

down:
	docker compose down
