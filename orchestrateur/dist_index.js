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

// --- utilitaire pour avoir un nom docker sûr (sans accents) ---
function slugifyName(name) {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_");
}

// --- cherche un port libre entre 5801 et 5900 ---
async function findFreePort(start = 5801, end = 5900) {
  for (let p = start; p <= end; p++) {
    const free = await getPort({ port: p });
    if (free === p) return p;
  }
  throw new Error("Aucun port libre trouvé");
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

    const container = await docker.createContainer({
      Image: "jlesage/firefox",
      name: containerName,
      Env: [
        "FF_OPEN_URL=https://scratch.mit.edu/projects/editor",
        "DISPLAY_WIDTH=1280",
        "DISPLAY_HEIGHT=800",
        "WEB_AUDIO=1"
      ],
      HostConfig: {
        PortBindings: { "5800/tcp": [{ HostPort: port.toString() }] }
      }
    });

    await container.start();
    console.log(`✅ Session créée pour ${rawName} (${name}) sur http://localhost:${port}`);

    // attendre un peu que le service web soit prêt avant de donner l'URL
    setTimeout(() => {
      const publicPort = port + 10000; // <-- on ajoute seulement 10000
      const publicHost = "82.65.187.244"; // <-- ton IP publique fixe

      res.json({
        name: rawName,
        url: `http://${publicHost}:${publicPort}`, // <-- redirection externe
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
    const containers = await docker.listContainers();
    const sessions = containers
      .filter(c => c.Image.includes("jlesage/firefox"))
      .map(c => {
        const internalPort = c.Ports.find(p => p.PrivatePort === 5800)?.PublicPort;
        return {
          id: c.Id,
          name: c.Names[0].replace(/^\//, ""),
          port: internalPort ? internalPort + 10000 : null, // <-- affichage port +10000
          url: internalPort ? `http://82.65.187.244:${internalPort + 10000}` : null
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
    await container.stop();
    await container.remove();
    console.log(`🛑 Session ${req.params.id} arrêtée`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Lancement serveur ----
const PORT = 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Orchestrateur dispo sur http://0.0.0.0:${PORT}`);
});
