
install:
	@echo "=== Installation ==="
	@echo "Please make sure to use Node 22"
	@export NVM_DIR="$${HOME}/.nvm"; \
	[ -s "$$NVM_DIR/nvm.sh" ] && \. "$$NVM_DIR/nvm.sh"; \
	nvm use || nvm install; \
	echo "Node version : $$(node -v)"; \
	npm install
	@if [ ! -d "secrets" ]; then \
		echo "Copying secrets folder..."; \
		cp -r secrets.example secrets; \
	fi
	mkdir -p gateway/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	-keyout gateway/ssl/transcendence.key \
	-out gateway/ssl/transcendence.crt \
	-subj "/C=FR/ST=GrandEst/L=Mulhouse/O=42/CN=localhost"
	chmod 600 gateway/ssl/transcendence.key
	chmod 644 gateway/ssl/transcendence.crt
	docker compose up --build

up:
	docker compose up

down:
	docker compose down