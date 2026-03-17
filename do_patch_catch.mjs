import fs from 'fs';

const fixDir = (f, varName) => {
  let c = fs.readFileSync(f, 'utf8');
  let regex = new RegExp(`if \\(!fs\\.existsSync\\(${varName}\\)\\) \\{[\\s\\S]*?\\}`, 'm');
  c = c.replace(regex, `try { if (!fs.existsSync(${varName})) { fs.mkdirSync(${varName}, { recursive: true }); } } catch(e) { console.log('mkdir failed or skipped in serverless', e.message); }`);
  fs.writeFileSync(f, c);
  console.log('patched', f);
};

fixDir('server/controllers/adminController.js', 'exportsDir');
fixDir('server/controllers/logbookController.js', 'pdfsDir');
fixDir('server/controllers/pdfController.js', 'pdfsDir');
