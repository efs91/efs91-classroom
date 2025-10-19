import express from "express";
import Docker from "dockerode";
import getPort from "get-port";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docker = new Docker();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Configuration depuis les variables d'environnement
const MODE = process.env.MODE || 'localhost';
const DOMAIN = process.env.DOMAIN || 'localhost';

// --- utilitaire pour avoir un nom docker sûr (sans accents) ---
function slugifyName(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

// --- cherche un port libre entre 5801 et 5810 (10 sessions max) ---
async function findFreePort(start = 5801, end = 5810) {
  for (let p = start; p <= end; p++) {
    const free = await getPort({ port: p });
    if (free === p) return p;
  }
  throw new Error("Aucun port libre trouvé (max 10 sessions)");
}

// ---- API ----

// Créer une session
app.post("/session", async (req, res) => {
  const rawName = req.body.name;
  if (!rawName) return res.status(400).json({ error: "name is required" });

  const name = slugifyName(rawName);

  try {
    const port = await findFreePort();
    const containerName = `scratch_${name}_${port}`;

    // Créer un volume nommé personnel pour l'élève
    const volumeName = `scratch_${name}`;
    
    try {
      // Créer le volume s'il n'existe pas déjà
      await docker.createVolume({ Name: volumeName });
      console.log(`📁 Volume ${volumeName} créé/réutilisé`);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.log(`📁 Volume ${volumeName} existe déjà, réutilisation`);
      }
    }

    const container = await docker.createContainer({
      Image: "lscr.io/linuxserver/firefox:latest",
      name: containerName,
      Env: [
        // Configuration LinuxServer Firefox avec Selkies (audio WebRTC)
        "PUID=1000",
        "PGID=1000", 
        "TZ=Europe/Paris",
        "FIREFOX_CLI=file:///config/homepage.html",
        // Optimisations performances
        "CUSTOM_RES=1024x768", // Résolution plus petite
        "DISABLE_IPV6=true",
        // PARTAGE COLLABORATIF SELKIES pour connexions multiples !
        "SELKIES_ENABLE_SHARING=true",
        "SELKIES_ENABLE_COLLAB=true", // Partage collaboratif (prof peut agir)
        "SELKIES_ENABLE_SHARED=true", // Liens view-only
        "SELKIES_UI_SIDEBAR_SHOW_SHARING=true" // Afficher UI de partage
      ],
      HostConfig: {
        PortBindings: { "3001/tcp": [{ HostPort: port.toString() }] }, // HTTPS port pour audio
        ShmSize: 536870912, // 512MB shared memory pour optimiser
        // Monter le volume personnel de l'élève + la homepage
        Binds: [
          `${volumeName}:/config`,
          `${__dirname}/homepage.html:/config/homepage.html:ro`
        ],
        // Utiliser tmpfs pour les fichiers temporaires seulement
        Tmpfs: {
          "/tmp": "rw,noexec,nosuid,size=256m"
        },
        // Empêcher la création de volumes anonymes
        AutoRemove: true
      }
    });



    await container.start();
    
    // Attendre 5 secondes puis installer et lancer code-server
    setTimeout(async () => {
      try {
        // Créer le script d'installation dans le conteneur
        const installScript = `
#!/bin/bash
# Installer code-server si pas déjà fait
if ! command -v code-server &> /dev/null; then
    curl -fsSL https://code-server.dev/install.sh | sh
fi

# Créer les dossiers nécessaires
mkdir -p /config/.config/code-server
mkdir -p /config/workspace
cat > /config/.config/code-server/config.yaml << EOF
bind-addr: 0.0.0.0:8080
auth: none
password: 
cert: false
EOF

# Lancer code-server en background
nohup code-server --config /config/.config/code-server/config.yaml /config/workspace > /config/code-server.log 2>&1 &
echo "Code-server lancé sur port 8080"
`;
        
        // Exécuter le script dans le conteneur
        const exec = await container.exec({
          Cmd: ['bash', '-c', installScript],
          AttachStdout: true,
          AttachStderr: true
        });
        await exec.start();
        console.log(`🔧 Code-server installé et lancé pour ${containerName}`);
      } catch (err) {
        console.log(`⚠️  Erreur installation code-server: ${err.message}`);
      }
    }, 5000);
    // Générer l'URL avec le sous-domaine correspondant au port
    const sessionNumber = port - 5800; // 5801 -> session1, 5802 -> session2, etc.
    let publicUrl;
    
    if (MODE === 'cloudflare') {
      publicUrl = `https://session${sessionNumber}.${DOMAIN}`;
    } else {
      publicUrl = `https://localhost:${port}`;
    }
    
    console.log(`✅ Session créée pour ${rawName} (${name}) sur ${publicUrl}`);

    // attendre un peu que le service web soit prêt avant de donner l'URL
    setTimeout(() => {
      res.json({
        name: rawName,
        url: publicUrl,
        containerId: container.id
      });
    }, 2000);

  } catch (err) {
    console.error("Erreur création session:", err);
    res.status(500).json({ error: err.message });
  }
});

// Lister les sessions (uniquement celles qui tournent)
app.get("/sessions", async (_req, res) => {
  try {
    const containers = await docker.listContainers(); // par défaut : seulement running
    const sessions = containers
      .filter(c => c.Image.includes("linuxserver/firefox"))
      .map(c => {
        const port = c.Ports.find(p => p.PrivatePort === 3001)?.PublicPort;
        const sessionNumber = port - 5800; // 5801 -> session1, 5802 -> session2, etc.
        let publicUrl;
        
        if (MODE === 'cloudflare') {
          publicUrl = `https://session${sessionNumber}.${DOMAIN}`;
        } else {
          publicUrl = `https://localhost:${port}`;
        }
        
        return {
          id: c.Id,
          name: c.Names[0].replace(/^\//, ""),
          port: port,
          url: publicUrl,
          viewUrl: publicUrl // Même URL pour observation
        };
      });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stopper une session
app.delete("/session/:id", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const containerInfo = await container.inspect();
    const containerName = containerInfo.Name.replace('/', '');
    
    await container.stop();
    await container.remove({ v: true }); // v: true supprime aussi les volumes associés
    
    // Extraire le nom de base pour les volumes (ex: scratch_martin_5801 -> martin_5801)
    const volumeBaseName = containerName.replace('scratch_', '');
    console.log(`🔍 Conteneur: ${containerName} -> Base volumes: ${volumeBaseName}`);
    
    // Plus de volumes nommés à supprimer pour le moment
    
    console.log(`🛑 Session ${req.params.id} (${containerName}) arrêtée et volumes supprimés`);
    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur suppression session:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Lancement serveur ----
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Orchestrateur dispo sur http://localhost:${PORT}`);
});
