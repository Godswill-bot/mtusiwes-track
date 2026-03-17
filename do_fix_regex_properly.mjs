import fs from 'fs';

let f = 'server/controllers/adminController.js';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/try \{ if \(\!fs\.existsSync\(exportsDir\)\) \{.*?catch\(e\) \{ .*? \} \}?/s, 
  "try { if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }");
c = c.replace(/\}\s*$/gm, '}'); // Remove stray
fs.writeFileSync(f, c);

f = 'server/controllers/logbookController.js';
c = fs.readFileSync(f, 'utf8');
c = c.replace(/try \{ if \(\!fs\.existsSync\(pdfsDir\)\) \{.*?catch\(e\) \{ .*? \} \}?/s, 
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }");
fs.writeFileSync(f, c);

f = 'server/controllers/pdfController.js';
c = fs.readFileSync(f, 'utf8');
c = c.replace(/try \{ if \(\!fs\.existsSync\(pdfsDir\)\) \{.*?catch\(e\) \{ .*? \} \}?(?=\n\n\/\*\*)/s, 
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }");

// Fix floating closing braces
c = c.replace(/e\.message\); \}\n\}/, "e.message); }");
fs.writeFileSync(f, c);

console.log('Done');