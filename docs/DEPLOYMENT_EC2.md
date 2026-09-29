# LessonFoundry — EC2 Deployment Guide

## Architecture

```
Internet → Nginx (HTTPS) → Next.js :3000 + FastAPI :8000
                                          → Worker (same image)
External: Supabase Auth+PG, AWS S3, Claude API
```

## Prerequisites

- EC2 instance (t3.medium or larger)
- Domain name pointed to EC2 public IP
- Supabase project with Google OAuth enabled
- AWS S3 bucket (private)
- Anthropic API key

## Setup

```bash
# Install Docker + Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx

# Clone repository
git clone <repo-url> /opt/lessonfoundry
cd /opt/lessonfoundry

# Create .env from example
cp .env.example .env
# Edit .env with real credentials (NEVER commit this file)

# Build and start
docker compose up -d --build

# Setup HTTPS
sudo certbot --nginx -d lessonfoundry.example.com

# Copy nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/lessonfoundry
sudo ln -sf /etc/nginx/sites-available/lessonfoundry /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Environment Variables

All variables must be set in `.env`. See `.env.example` for the complete list.

**Never set these as `NEXT_PUBLIC_*`:**
- `ANTHROPIC_API_KEY`
- `AWS_SECRET_ACCESS_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Health Checks

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
curl http://localhost:3000
```

## Supabase Configuration

1. Enable Google OAuth provider in Supabase dashboard
2. Set authorized redirect URL: `https://your-domain.com/auth/callback`
3. Create restricted database roles per `migrations/002_staging_security.sql`
4. Apply migrations 004–008

## Worker

The worker runs as a separate container with the same image:
```yaml
worker:
  build: ./backend
  command: ["python", "-m", "app.jobs.worker"]
  env_file: .env
```
