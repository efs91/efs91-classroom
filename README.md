# EFS91 Classroom 🎓

**🌍 [English version / Version anglaise](README_EN.md)**

Système de classe virtuelle avec conteneurs Docker pour l'enseignement de Scratch et du développement.

## 🚀 Fonctionnalités

- **Sessions élèves individuelles** : Chaque élève a son propre environnement isolé
- **Firefox + Scratch** : Accès direct à Scratch via navigateur
- **VS Code intégré** : Éditeur de code web avec timer de 10 secondes
- **Interface professeur** : Surveillance temps réel + prise de contrôle
- **Clipboard fonctionnel** : Copier/coller entre applications
- **Stockage persistant** : Les fichiers des élèves sont sauvegardés

## 📋 Prérequis

- **Docker** installé et fonctionnel
- **Node.js** (v16+)
- **Linux/macOS** (recommandé)
- **Cloudflare Tunnel** (optionnel, pour accès distant)

## ⚙️ Installation

1. **Cloner le repo** :
   ```bash
   git clone <votre-repo>
   cd efs91_programmation
   ```

2. **Installer les dépendances** :
   ```bash
   cd orchestrateur
   npm install
   cd ..
   ```

3. **Configuration** :
   ```bash
   cp .env.example .env
   # Éditer le fichier .env avec vos valeurs
   ```

## 🎛️ Configuration

### **Mode LOCAL (par défaut)**
Pour usage local uniquement, sans tunnel externe :

```bash
# .env
MODE=localhost
```

**Accès :**
- Interface professeur : `http://localhost:3000/prof.html`
- Sessions élèves : `https://localhost:5801` à `https://localhost:5810`

### **Mode CLOUDFLARE**
Pour accès distant via Cloudflare Tunnel :

```bash
# .env
MODE=cloudflare
TUNNEL_NAME=votre-tunnel
DOMAIN=votre-domaine.com
```

**Prérequis :**
- Cloudflare Tunnel configuré (voir guide ci-dessous)
- `cloudflared` installé
- Sous-domaines session1-10 configurés

#### 🔧 Guide configuration Cloudflare Tunnel

1. **Installer cloudflared** :
   ```bash
   # Linux/macOS
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authentification** :
   ```bash
   cloudflared tunnel login
   ```

3. **Créer le tunnel** :
   ```bash
   cloudflared tunnel create votre-domaine-classroom
   # Notez l'UUID du tunnel généré
   ```

4. **Configuration DNS** :
   
   **Option A - Manuel** dans Cloudflare Dashboard :
   - Domaine principal : `votre-domaine.com` → CNAME → `<tunnel-uuid>.cfargotunnel.com`
   - Sous-domaines : `session1.votre-domaine.com` à `session10.votre-domaine.com` → CNAME → `<tunnel-uuid>.cfargotunnel.com`
   
   **Option B - Automatique** avec script Cloudflare API :
   ```bash
   # Configurer votre token API Cloudflare
   export CF_API_TOKEN="votre-token-api"
   export ZONE_ID="votre-zone-id"
   export TUNNEL_UUID="uuid-de-votre-tunnel"
   
   # Script pour créer tous les enregistrements DNS
   curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"type":"CNAME","name":"votre-domaine.com","content":"'$TUNNEL_UUID'.cfargotunnel.com"}'
   
   # Créer les sous-domaines session1 à session10
   for i in {1..10}; do
     curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
       -H "Authorization: Bearer $CF_API_TOKEN" \
       -H "Content-Type: application/json" \
       --data '{"type":"CNAME","name":"session'$i'.votre-domaine.com","content":"'$TUNNEL_UUID'.cfargotunnel.com"}'
   done
   ```

5. **Fichier de configuration** `~/.cloudflared/config.yml` :
   ```yaml
   tunnel: votre-domaine-classroom
   credentials-file: /home/user/.cloudflared/<tunnel-uuid>.json
   
   ingress:
     # Interface orchestrateur
     - hostname: votre-domaine.com
       service: http://localhost:3000
     
     # Sessions élèves
     - hostname: session1.votre-domaine.com
       service: https://localhost:5801
     - hostname: session2.votre-domaine.com
       service: https://localhost:5802
     - hostname: session3.votre-domaine.com
       service: https://localhost:5803
     - hostname: session4.votre-domaine.com
       service: https://localhost:5804
     - hostname: session5.votre-domaine.com
       service: https://localhost:5805
     - hostname: session6.votre-domaine.com
       service: https://localhost:5806
     - hostname: session7.votre-domaine.com
       service: https://localhost:5807
     - hostname: session8.votre-domaine.com
       service: https://localhost:5808
     - hostname: session9.votre-domaine.com
       service: https://localhost:5809
     - hostname: session10.votre-domaine.com
       service: https://localhost:5810
     
     # Catch-all
     - service: http_status:404
   ```

6. **Tester la configuration** :
   ```bash
   cloudflared tunnel run votre-domaine-classroom
   ```

**Accès :**
- Interface professeur : `https://votre-domaine.com/prof.html`
- Sessions élèves : `https://session1.votre-domaine.com` à `session10.votre-domaine.com`

## 🎯 Utilisation

### Démarrage du système
```bash
./start-classroom.sh
```

### Accès
- **Interface professeur** : Selon votre configuration MODE
- **Sessions élèves** : URLs générées automatiquement selon le mode

### Créer une session élève
```bash
curl -X POST http://localhost:3000/session -H "Content-Type: application/json" -d '{"name":"martin"}'
```

## 🎮 Interface élève

Chaque élève accède à :
1. **Page d'accueil** avec boutons Scratch et VS Code
2. **Scratch** : Environnement de programmation visuelle
3. **VS Code** : Éditeur de code (disponible après 10s)
4. **Stockage personnel** : Fichiers sauvegardés automatiquement

## 👨‍🏫 Interface professeur

- **Vue d'ensemble** : Toutes les sessions en vignettes
- **Observation** : Voir l'écran d'un élève en plein écran
- **Prise de contrôle** : Intervenir directement sur la session
- **Gestion** : Créer/supprimer des sessions

## 🔧 Configuration

### Variables d'environnement (`.env`)
```bash
# Mode de fonctionnement
MODE=localhost              # ou "cloudflare"

# Configuration Cloudflare (si MODE=cloudflare)
TUNNEL_NAME=votre-tunnel
DOMAIN=votre-domaine.com
PORT=3000
```

### Personnalisation
- **Page d'accueil** : `orchestrateur/homepage.html`
- **Interface prof** : `orchestrateur/public/prof.html`
- **Timer VS Code** : Modifier le JavaScript dans `homepage.html`

## 🐳 Architecture Docker

- **Image** : `lscr.io/linuxserver/firefox:latest`
- **Technologie** : Selkies-GStreamer pour le streaming web
- **Ports** : 5801-5810 (10 sessions max)
- **Volumes** : Stockage persistant par élève

## 🔒 Sécurité

- Conteneurs isolés par élève
- Pas d'accès réseau externe depuis les conteneurs
- Configuration via variables d'environnement
- Fichiers sensibles exclus du versioning

## 🛠️ Dépannage

### Container ne démarre pas
```bash
docker logs <container-id>
```

### Problème de tunnel
```bash
cloudflared tunnel list
cloudflared tunnel run <tunnel-name>
```

### Reset complet
```bash
docker stop $(docker ps -q)
docker rm $(docker ps -aq)
docker volume prune
```

## 📝 Licence

[Votre licence ici]

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commit (`git commit -am 'Ajout nouvelle fonctionnalité'`)
4. Push (`git push origin feature/amelioration`)
5. Créer une Pull Request