# MTU SIWES Email Server

Backend server for MTU SIWES Platform email verification and authentication.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Create `.env` file:
```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-digit-app-password
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=http://localhost:8080
NODE_ENV=development
```

3. Start the server:
```bash
npm run dev
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-email` - Verify email with OTP
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /health` - Health check

## Troubleshooting

### "Failed to fetch" errors

1. **Check if server is running:**
   ```bash
   cd server
   npm run dev
   ```

2. **Check server logs** for errors

3. **Verify CORS settings** in `server.js`

4. **Check environment variables** in `.env` file

5. **Test health endpoint:**
   ```bash
   curl http://localhost:3001/health
   ```

### Email not sending

1. Verify Gmail App Password is correct
2. Check EMAIL_USER and EMAIL_PASS in `.env`
3. Check server logs for email errors
