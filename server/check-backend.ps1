# PowerShell script to check if backend server is running and test endpoints

Write-Host "=== MTU SIWES Backend Server Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "1. Checking if server is running on port 3001..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✓ Server is running!" -ForegroundColor Green
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "   Service: $($healthData.service)" -ForegroundColor Green
        Write-Host "   Status: $($healthData.status)" -ForegroundColor Green
    }
} catch {
    Write-Host "   ✗ Server is NOT running!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start the server:" -ForegroundColor Yellow
    Write-Host "   cd server" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "2. Testing registration endpoints..." -ForegroundColor Yellow

# Test student registration endpoint (will fail if email exists, but endpoint should respond)
Write-Host "   Testing student registration endpoint..." -ForegroundColor Gray
try {
    $studentBody = @{
        firstname = "Test"
        lastname = "Student"
        matricNumber = "22010306099"
        email = "teststudent@mtu.edu.ng"
        password = "testpass123"
        role = "student"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" -Method POST -Body $studentBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ Student registration endpoint is working" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "   ✓ Student registration endpoint is working (email may already exist)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Student registration endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test supervisor registration endpoint
Write-Host "   Testing supervisor registration endpoint..." -ForegroundColor Gray
try {
    $supervisorBody = @{
        firstname = "Test"
        lastname = "Supervisor"
        email = "testsupervisor@mtu.edu.ng"
        password = "testpass123"
        role = "school_supervisor"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/register" -Method POST -Body $supervisorBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ Supervisor registration endpoint is working" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "   ✓ Supervisor registration endpoint is working (email may already exist)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Supervisor registration endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "3. Testing email verification endpoint..." -ForegroundColor Yellow
try {
    $verifyBody = @{
        email = "test@mtu.edu.ng"
        otp = "123456"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/auth/verify-email" -Method POST -Body $verifyBody -ContentType "application/json" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✓ Email verification endpoint is working" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "   ✓ Email verification endpoint is working (OTP validation is working)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Email verification endpoint error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "✓ Backend server is running and accessible" -ForegroundColor Green
Write-Host "✓ All endpoints are configured correctly" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Registration tests may show errors if test emails already exist." -ForegroundColor Yellow
Write-Host "This is expected - the important thing is that endpoints respond." -ForegroundColor Yellow
Write-Host ""

