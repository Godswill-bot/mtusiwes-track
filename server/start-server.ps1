# MTU SIWES Server Startup Script
Write-Host "=== MTU SIWES Backend Server ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please create server/.env file with your credentials:" -ForegroundColor Yellow
    Write-Host "  EMAIL_USER=your-gmail@gmail.com"
    Write-Host "  EMAIL_PASS=your-16-digit-app-password"
    Write-Host "  PORT=3001"
    Write-Host "  FRONTEND_URL=http://localhost:8080"
    Write-Host "  SUPABASE_URL=your_supabase_url"
    Write-Host "  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key"
    Write-Host ""
    exit 1
}

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

Write-Host "Starting server on http://localhost:3001" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev




