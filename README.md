# Plan de développement — ft_transcendence (UNO)

## Workflow Git

- **Repo GitHub** : utilisé pour le workflow de développement (branches, Pull Requests, reviews, discussions).
- **Repo Git privé de l'école** : repo de référence pour l'évaluation — c'est celui-ci qui sera cloné et vérifié.
- Recommandé : travailler avec de vraies PR sur GitHub (review + historique propre), puis pousser régulièrement vers le repo école avec un second remote :
  ```bash
  git remote add school <url-repo-ecole>
  git push school main
  ```
- Alternative : travailler en CLI pur directement sur le repo école, avec des merges soignés et des messages de commit clairs. Moins de traçabilité de review, mais fonctionne aussi.
- Convention à définir dès le départ : nommage des branches (`feat/`, `fix/`, `chore/`...), qui review quoi, fréquence de sync avec le repo école.

---

## Phase 0 — Setup

- Créer le repo Git, définir la convention de commits/branches
- Répartir les rôles (PO, PM/Scrum Master, Tech Lead, Developers) — à documenter dans le README dès maintenant
- Poser le schéma Prisma de base (`User`, `Game`, `Room`, `Card`, `Friendship`, `Message`)
- Squelette Docker (`docker-compose.yml` avec frontend, backend, Postgres, lancement en une commande)
- `.env.example` + `.env` (ignoré par Git)
- Mettre en place un board partagé (GitHub Issues, Trello, ou équivalent) pour le suivi des tâches

---

## Phase 1 — Fondations obligatoires

Tout ce qui est non négociable dans le sujet, à faire avant même de penser aux modules :

- Auth de base : signup/login email + password, hash sécurisé (argon2/bcrypt + salt)
- Frontend responsive de base avec Tailwind, structure des pages
- HTTPS configuré (reverse proxy type Nginx, certificats même auto-signés en dev)
- Validation des formulaires front + back
- Pages Privacy Policy et Terms of Service avec du vrai contenu + liens accessibles (footer)
- Schéma DB finalisé et migré (Prisma migrate)

---

## Phase 2 — Web Major

- WebSockets : infra temps réel (connexion/déconnexion propre, broadcasting) — socle technique du jeu, à faire tôt
- Interaction users : chat basique, système de profil, système d'amis
- Framework front + back : normalement déjà acquis si Phases 0/1 bien posées

---

## Phase 3 — Le jeu UNO (cœur du projet)

Ordre strict à respecter (dépendances imposées par le sujet) :

1. **Jeu web complet** (règles UNO, logique de partie, victoire/défaite) — tout le reste en dépend
2. Une fois le jeu stable et jouable à 2 :
   - Multiplayer 3+ (extension à plusieurs joueurs)
   - Remote players (gestion latence/reconnexion), si retenu
3. Une fois le jeu stable à plusieurs :
   - AI Opponent (bot qui joue)
   - Game customization (cartes/pouvoirs custom)

C'est la phase la plus longue et la plus risquée du projet — à ne pas sous-estimer en charge de travail.

---

## Phase 4 — User Management

- OAuth (Google/GitHub/42)
- 2FA, si retenu en bonus
- Peut être développé en parallèle de la Phase 3 par un autre membre de l'équipe

---

## Phase 5 — Modules dépendant du jeu

Une fois le jeu + multiplayer + AI stables :

- Tournament system
- Spectator mode
- Gamification (XP, achievements, leaderboard)

---

## Phase 6 — Polish, tests, README

- Vérifier zéro warning/erreur dans la console JS
- Tester la compatibilité Chrome (et navigateurs additionnels si module pris)
- Tester le multi-user réel en simultané (plusieurs sessions, race conditions sur la DB)
- Rédiger le README complet : description, instructions, ressources + usage de l'IA, team info, project management, stack technique, schéma DB, liste des features, justification des modules, contributions individuelles
- Répéter la soutenance : chaque membre doit pouvoir expliquer n'importe quelle partie du projet, y compris ce qu'il n'a pas codé lui-même

---

## Points de vigilance transverses

- Réunions courtes régulières pour éviter qu'un blocage passe inaperçu
- Documenter au fil de l'eau, pas tout à la fin — le README a beaucoup de sections
- Garder un board de suivi à jour dès le jour 1 (demandé explicitement en soutenance)
- Ne pas lancer de module bonus tant que les 14 points obligatoires ne sont pas fonctionnels et démontrables — le bonus ne compte que si l'obligatoire est validé
