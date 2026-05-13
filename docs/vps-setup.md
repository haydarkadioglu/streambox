# VPS Setup

This guide starts from step 2, after you have already connected to your Linux VPS with SSH.

Example SSH command:

```bash
ssh root@YOUR_SERVER_IP
```

## 2. Update The Server

For Ubuntu or Debian:

```bash
sudo apt update
sudo apt upgrade -y
```

Install basic tools:

```bash
sudo apt install -y git curl ca-certificates nano
```

## 3. Install Docker

Install Docker with the official convenience script:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Check Docker:

```bash
docker --version
docker compose version
```

If your user is not `root`, add it to the Docker group:

```bash
sudo usermod -aG docker $USER
```

Then log out and log back in:

```bash
exit
```

Reconnect:

```bash
ssh YOUR_USER@YOUR_SERVER_IP
```

If you are using `root`, you can keep using `sudo docker ...` and skip the group step.

## 4. Clone The Project

Go to a good location for apps:

```bash
cd /opt
```

Clone your repository:

```bash
sudo git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git streambox
```

Enter the project:

```bash
cd /opt/streambox
```

If the repository is private, use a GitHub token or SSH deploy key.

## 5. Create The Environment File

Copy the example env file:

```bash
sudo cp .env.example .env
```

Edit it:

```bash
sudo nano .env
```

For an IP-only test, use values like this:

```env
JWT_SECRET=replace-this-with-a-long-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8080
CORS_ORIGINS=["http://YOUR_SERVER_IP:8080"]
```

Important values to change:

```text
JWT_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
PUBLIC_BASE_URL
CORS_ORIGINS
```

You do not need to change `DATABASE_URL` or `REDIS_URL` for Docker Compose. The compose file overrides those values inside the containers.

## 6. Open Firewall Ports

If UFW is active or you want to enable it:

```bash
sudo ufw allow 22
sudo ufw allow 8080
sudo ufw enable
sudo ufw status
```

If your VPS provider has its own firewall panel, also open TCP port `8080` there.

## 7. Start StreamBox

Build and start all services:

```bash
sudo docker compose up -d --build
```

Check running containers:

```bash
sudo docker compose ps
```

Follow logs:

```bash
sudo docker compose logs -f
```

API logs only:

```bash
sudo docker compose logs -f api
```

Worker logs only:

```bash
sudo docker compose logs -f worker
```

## 8. Open The App

Open this in your browser:

```text
http://YOUR_SERVER_IP:8080
```

Log in with the values from `.env`:

```text
ADMIN_EMAIL
ADMIN_PASSWORD
```

## 9. Upload And Test A Video

1. Log in.
2. Upload a video.
3. Wait until the status becomes `ready`.
4. Click `Refresh` if needed.
5. Select the video.
6. Click `Generate Link`.
7. Copy or open the generated HLS playback link.

The link looks like this:

```text
http://YOUR_SERVER_IP:8080/api/playback/VIDEO_ID/master.m3u8?token=...
```

## 10. Update The App Later

Go to the project directory:

```bash
cd /opt/streambox
```

Pull new code:

```bash
sudo git pull
```

Rebuild and restart:

```bash
sudo docker compose up -d --build
```

Check status:

```bash
sudo docker compose ps
```

## 11. Stop Or Restart

Stop:

```bash
sudo docker compose down
```

Start again:

```bash
sudo docker compose up -d
```

Restart one service:

```bash
sudo docker compose restart api
```

## 12. Domain And HTTPS Later

When you connect a real domain, update `.env`:

```env
PUBLIC_BASE_URL=https://video.your-domain.com
CORS_ORIGINS=["https://video.your-domain.com"]
```

Then restart:

```bash
sudo docker compose up -d
```

For HTTPS, put a TLS reverse proxy in front of StreamBox, or update the Nginx config with certificates.

