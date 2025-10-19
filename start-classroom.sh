#!/bin/bash

echo "🚀 Démarrage de EFS91 Classroom..."

# Chargement des variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "📄 Configuration chargée depuis .env"
fi

# Vérification des variables obligatoires
if [ -z "$MODE" ]; then
    echo -e "${RED}❌ MODE non défini dans .env${NC}"
    echo -e "${YELLOW}💡 Copiez .env.example vers .env et configurez MODE=localhost ou MODE=cloudflare${NC}"
    exit 1
fi

# Vérification spécifique au mode Cloudflare
if [ "$MODE" = "cloudflare" ]; then
    if [ -z "$TUNNEL_NAME" ]; then
        echo -e "${RED}❌ TUNNEL_NAME requis pour MODE=cloudflare${NC}"
        echo -e "${YELLOW}💡 Configurez TUNNEL_NAME dans .env${NC}"
        exit 1
    fi
    
    if [ -z "$DOMAIN" ]; then
        echo -e "${RED}❌ DOMAIN requis pour MODE=cloudflare${NC}"
        echo -e "${YELLOW}💡 Configurez DOMAIN dans .env${NC}"
        exit 1
    fi
    
    # Vérifier que cloudflared est installé
    if ! command -v cloudflared &> /dev/null; then
        echo -e "${RED}❌ cloudflared n'est pas installé (requis pour MODE=cloudflare)${NC}"
        exit 1
    fi
fi

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour nettoyer à l'arrêt
cleanup() {
    echo -e "\n${YELLOW}🛑 Arrêt en cours...${NC}"
    
    # Arrêter le tunnel Cloudflare
    if [ ! -z "$TUNNEL_PID" ]; then
        echo "📡 Arrêt du tunnel Cloudflare..."
        kill $TUNNEL_PID 2>/dev/null
    fi
    
    # Arrêter l'orchestrateur
    if [ ! -z "$ORCHESTRATEUR_PID" ]; then
        echo "🎼 Arrêt de l'orchestrateur..."
        kill $ORCHESTRATEUR_PID 2>/dev/null
    fi
    
    echo -e "${GREEN}✅ Arrêt terminé${NC}"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT SIGTERM

# Vérifier que node est installé
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé${NC}"
    exit 1
fi

# Démarrage conditionnel selon le MODE
if [ "$MODE" = "cloudflare" ]; then
    echo "📡 Démarrage du tunnel Cloudflare..."
    cloudflared tunnel run ${TUNNEL_NAME} &
    TUNNEL_PID=$!
    
    # Attendre un peu que le tunnel se connecte
    sleep 3
else
    echo "🏠 Mode local activé (pas de tunnel)"
fi

echo "🎼 Démarrage de l'orchestrateur..."
cd orchestrateur
node index.js &
ORCHESTRATEUR_PID=$!

echo -e "${GREEN}✅ Système démarré !${NC}"

if [ "$MODE" = "cloudflare" ]; then
    echo -e "${GREEN}📊 Interface professeur : https://${DOMAIN}/prof.html${NC}"
    echo -e "${YELLOW}📋 Sessions disponibles : session1 à session10.${DOMAIN}${NC}"
else
    echo -e "${GREEN}📊 Interface professeur : http://localhost:3000/prof.html${NC}"
    echo -e "${YELLOW}📋 Sessions disponibles : https://localhost:5801 à 5810${NC}"
fi
echo ""
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter le système${NC}"

# Attendre que les processus se terminent
wait $TUNNEL_PID $ORCHESTRATEUR_PID