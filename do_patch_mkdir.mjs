import fs from 'fs';

const patchDirSync = (f, pvar) => {
  let c;
  try { c = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
  
  if (c.includes(`!fs.existsSync(${pvar})`)) {
    c = c.replace(`const ${pvar} = path.join(__dirname, `, `const ${pvar} = process.env.VERCEL === '1' ? '/tmp' : path.join(__dirname, `);
    c = c.replace(`if (!fs.existsSync(${pvar})) {\n  fs.mkdirSync(${pvar}, { recursive: true });\n}`, `try {\n  if (!fs.existsSync(${pvar})) {\n    fs.mkdirSync(${pvar}, { recursive: true });\n  }\n} catch(e) { console.log("Could not create dir " + ${pvar}); }`);
    fs.writeFileSync(f, c);
    console.log('patched ' + f);
  }
}

patchDirSync('server/controllers/adminController.js', 'exportsDir');
patchDirSync('server/controllers/logbookController.js', 'pdfsDir');
patchDirSync('server/controllers/pdfController.js', 'pdfsDir');
