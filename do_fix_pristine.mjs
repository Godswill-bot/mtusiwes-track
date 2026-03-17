import fs from 'fs';

['server/controllers/adminController.js', 'server/controllers/logbookController.js', 'server/controllers/pdfController.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/const exportsDir = path\.join\(__dirname, '\.\.\/exports'\);\nif \(!fs\.existsSync\(exportsDir\)\) \{\n  fs\.mkdirSync\(exportsDir, \{ recursive: true \}\);\n\}/g, 
    "const exportsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, '../exports');\ntry { if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true }); } } catch(e) {}"
  );
  c = c.replace(/const pdfsDir = path\.join\(__dirname, '\.\.\/pdfs'\);\nif \(!fs\.existsSync\(pdfsDir\)\) \{\n  fs\.mkdirSync\(pdfsDir, \{ recursive: true \}\);\n\}/g, 
    "const pdfsDir = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, '../pdfs');\ntry { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) {}"
  );
  fs.writeFileSync(f, c);
  console.log('Processed', f);
});