# EFS91 Classroom 🎓

**🇫🇷 [Version française / French version](README.md)**

Virtual classroom system with Docker containers for teaching Scratch and development.

## 🚀 Features

- **Individual student sessions**: Each student has their own isolated environment
- **Firefox + Scratch**: Direct access to Scratch through browser
- **Integrated VS Code**: Web code editor with 10-second timer
- **Teacher interface**: Real-time monitoring + remote control
- **Functional clipboard**: Copy/paste between applications
- **Persistent storage**: Student files are automatically saved

## 📋 Prerequisites

- **Docker** installed and functional
- **Node.js** (v16+)
- **Linux/macOS** (recommended)
- **Cloudflare Tunnel** (optional, for remote access)

## ⚙️ Installation

1. **Clone the repo**:
   ```bash
   git clone <your-repo>
   cd efs91_programmation
   ```

2. **Install dependencies**:
   ```bash
   cd orchestrateur
   npm install
   cd ..
   ```

3. **Configuration**:
   ```bash
   cp .env.example .env
   # Edit the .env file with your values
   ```

## 🎛️ Configuration

### **LOCAL Mode (default)**
For local usage only, without external tunnel:

```bash
# .env
MODE=localhost
```

**Access:**
- Teacher interface: `http://localhost:3000/prof.html`
- Student sessions: `https://localhost:5801` to `https://localhost:5810`

### **CLOUDFLARE Mode**
For remote access via Cloudflare Tunnel:

```bash
# .env
MODE=cloudflare
TUNNEL_NAME=your-tunnel
DOMAIN=your-domain.com
```

**Prerequisites:**
- Cloudflare Tunnel configured (see guide below)
- `cloudflared` installed
- Subdomains session1-10 configured

#### 🔧 Cloudflare Tunnel Configuration Guide

1. **Install cloudflared**:
   ```bash
   # Linux/macOS
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authentication**:
   ```bash
   cloudflared tunnel login
   ```

3. **Create tunnel**:
   ```bash
   cloudflared tunnel create your-domain-classroom
   # Note the generated tunnel UUID
   ```

4. **DNS Configuration**:
   
   **Option A - Manual** via Cloudflare Dashboard:
   - Main domain: `your-domain.com` → CNAME → `<tunnel-uuid>.cfargotunnel.com`
   - Subdomains: `session1.your-domain.com` to `session10.your-domain.com` → CNAME → `<tunnel-uuid>.cfargotunnel.com`
   
   **Option B - Automatic** with Cloudflare API script:
   ```bash
   # Configure your Cloudflare API token
   export CF_API_TOKEN="your-api-token"
   export ZONE_ID="your-zone-id"
   export TUNNEL_UUID="your-tunnel-uuid"
   
   # Script to create all DNS records
   curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
     -H "Authorization: Bearer $CF_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"type":"CNAME","name":"your-domain.com","content":"'$TUNNEL_UUID'.cfargotunnel.com"}'
   
   # Create subdomains session1 to session10
   for i in {1..10}; do
     curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
       -H "Authorization: Bearer $CF_API_TOKEN" \
       -H "Content-Type: application/json" \
       --data '{"type":"CNAME","name":"session'$i'.your-domain.com","content":"'$TUNNEL_UUID'.cfargotunnel.com"}'
   done
   ```

5. **Configuration file** `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: your-domain-classroom
   credentials-file: /home/user/.cloudflared/<tunnel-uuid>.json
   
   ingress:
     # Teacher interface
     - hostname: your-domain.com
       service: http://localhost:3000
     
     # Student sessions
     - hostname: session1.your-domain.com
       service: https://localhost:5801
     - hostname: session2.your-domain.com
       service: https://localhost:5802
     - hostname: session3.your-domain.com
       service: https://localhost:5803
     - hostname: session4.your-domain.com
       service: https://localhost:5804
     - hostname: session5.your-domain.com
       service: https://localhost:5805
     - hostname: session6.your-domain.com
       service: https://localhost:5806
     - hostname: session7.your-domain.com
       service: https://localhost:5807
     - hostname: session8.your-domain.com
       service: https://localhost:5808
     - hostname: session9.your-domain.com
       service: https://localhost:5809
     - hostname: session10.your-domain.com
       service: https://localhost:5810
     
     # Catch-all
     - service: http_status:404
   ```

6. **Test configuration**:
   ```bash
   cloudflared tunnel run your-domain-classroom
   ```

**Access:**
- Teacher interface: `https://your-domain.com/prof.html`
- Student sessions: `https://session1.your-domain.com` to `session10.your-domain.com`

## 🎯 Usage

### System startup
```bash
./start-classroom.sh
```

### Access
- **Teacher interface**: According to your MODE configuration
- **Student sessions**: URLs automatically generated based on mode

### Create student session
```bash
curl -X POST http://localhost:3000/session -H "Content-Type: application/json" -d '{"name":"martin"}'
```

## 🎮 Student Interface

Each student accesses:
1. **Homepage** with Scratch and VS Code buttons
2. **Scratch**: Visual programming environment
3. **VS Code**: Code editor (available after 10s)
4. **Personal storage**: Files automatically saved

## 👨‍🏫 Teacher Interface

- **Overview**: All sessions in thumbnails
- **Observation**: View student screen in fullscreen
- **Remote control**: Directly intervene in sessions
- **Management**: Create/delete sessions

## 🔧 Configuration

### Environment variables (`.env`)
```bash
# Operating mode
MODE=localhost              # or "cloudflare"

# Cloudflare configuration (if MODE=cloudflare)
TUNNEL_NAME=your-tunnel
DOMAIN=your-domain.com
PORT=3000
```

### Customization
- **Homepage**: `orchestrateur/homepage.html`
- **Teacher interface**: `orchestrateur/public/prof.html`
- **VS Code timer**: Modify JavaScript in `homepage.html`

## 🐳 Docker Architecture

- **Image**: `lscr.io/linuxserver/firefox:latest`
- **Technology**: Selkies-GStreamer for web streaming
- **Ports**: 5801-5810 (10 sessions max)
- **Volumes**: Persistent storage per student

## 🔒 Security

- Isolated containers per student
- No external network access from containers
- Configuration via environment variables
- Sensitive files excluded from versioning

## 🛠️ Troubleshooting

### Container won't start
```bash
docker logs <container-id>
```

### Tunnel issues
```bash
cloudflared tunnel list
cloudflared tunnel run <tunnel-name>
```

### Complete reset
```bash
docker stop $(docker ps -q)
docker rm $(docker ps -aq)
docker volume prune
```

## 📝 License

[Your license here]

## 🤝 Contributing

1. Fork the project
2. Create a branch (`git checkout -b feature/improvement`)
3. Commit (`git commit -am 'Add new feature'`)
4. Push (`git push origin feature/improvement`)
5. Create a Pull Request