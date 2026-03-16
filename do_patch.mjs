import fs from 'fs';
const files = [
  'server/controllers/adminController.js',
  'server/controllers/attendanceController.js',
  'server/controllers/authController.js',
  'server/controllers/gradingController.js',
  'server/controllers/logbookController.js',
  'server/controllers/notificationController.js',
  'server/controllers/pdfController.js',
  'server/controllers/supervisorController.js',
  'server/controllers/weekController.js',
  'server/routes/auditRoutes.js'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/const supabase = createClient\([\s\S]*?process\.env\.SUPABASE_SERVICE_ROLE_KEY[^\)]*\);/g,
    "const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';\nconst supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_key';\nconst supabase = createClient(supabaseUrl, supabaseKey);"
  );
  fs.writeFileSync(f, c);
  console.log('patched', f);
});