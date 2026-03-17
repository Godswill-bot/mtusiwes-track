import fs from 'fs';

['server/controllers/adminController.js', 'server/controllers/logbookController.js', 'server/controllers/pdfController.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  // Strip out ALL versions of the dir creation blocks
  c = c.replace(/\/\/ Ensure .*? directory exists\n.*?(?=\/\*\*|\n\n)/s, '');
  
  if (f.includes('admin')) {
    c = c.replace("const supabase = createClient(supabaseUrl, supabaseKey);", "const supabase = createClient(supabaseUrl, supabaseKey);\n\n// Ensure exports directory exists\nconst exportsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, '../exports');\ntry { if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true }); } } catch(e) {}");
  } else {
    c = c.replace("const supabase = createClient(supabaseUrl, supabaseKey);", "const supabase = createClient(supabaseUrl, supabaseKey);\n\n// Ensure PDFs directory exists\nconst pdfsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, '../pdfs');\ntry { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) {}");
  }
  
  fs.writeFileSync(f, c);
  console.log('Cleansed', f);
});