# Quick Server Health Check Script
# Run with: .\test-server.ps1

Write-Host "`n=== Testing Backend Server ===`n" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 5
    
    Write-Host "✓ SERVER IS RUNNING!`n" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor White
    
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Status: $($json.status)" -ForegroundColor White
    Write-Host "Service: $($json.service)" -ForegroundColor White
    Write-Host "Timestamp: $($json.timestamp)`n" -ForegroundColor White
    
    Write-Host "✓ Backend server is ready to:" -ForegroundColor Green
    Write-Host "  - Send verification emails via Nodemailer" -ForegroundColor White
    Write-Host "  - Handle user registration" -ForegroundColor White
    Write-Host "  - Process OTP verification`n" -ForegroundColor White
    
} catch {
    Write-Host "✗ SERVER IS NOT RUNNING`n" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)`n" -ForegroundColor Yellow
    
    Write-Host "To start the server:" -ForegroundColor Cyan
    Write-Host "  1. Make sure you're in the server directory" -ForegroundColor White
    Write-Host "  2. Run: npm run dev`n" -ForegroundColor White
}

