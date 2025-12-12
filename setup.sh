#!/bin/bash

set -e

echo "MediTrack Setup Script"
echo "=========================="
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required but not installed."; exit 1; }

echo "All required tools are installed"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
cd server && npm install && cd ..
echo "Dependencies installed"
echo ""

# Setup environment
echo "Setting up environment variables..."
if [ ! -f server/.env ]; then
    cp .env.example server/.env
    # Generate random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    # Replace placeholder with actual secret (works on both Linux and macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/generate_random_32_char_secret_with_openssl_rand_base64_32/${JWT_SECRET}/" server/.env
    else
        sed -i "s/generate_random_32_char_secret_with_openssl_rand_base64_32/${JWT_SECRET}/" server/.env
    fi
    echo "Environment configured with auto-generated JWT secret"
else
    echo "server/.env already exists, skipping..."
fi
echo ""

# Start Docker containers
echo "Starting Docker containers (Postgres + Redis)..."
docker compose up -d
echo "Docker containers started"
echo ""

# Wait for database
echo "Waiting for database to initialize..."
sleep 8
echo "Database ready"
echo ""

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "  1. Backend:  cd server && npm run dev"
echo "  2. Frontend: npm run dev"
echo ""
echo "Then open http://localhost:5173"
echo ""
echo "FOR HTTPS + PUSH NOTIFICATIONS (optional):"
echo "  1. Install mkcert: apt install mkcert (or brew/choco on macOS/Windows)"
echo "  2. Install local CA: mkcert -install"
echo "  3. Generate certs: mkcert localhost 127.0.0.1"
echo "  4. Start servers again - frontend will use HTTPS automatically"
echo "  5. Access https://localhost:5173 - push notifications will work!"
echo ""
echo "Test credentials:"
echo "   Admin: admin@meditrack.com / admin123"
echo "   Doctor: dr.ionescu@meditrack.com / medic123"
echo "   Patient: ion.vasile@example.com / pacient123"
echo ""
