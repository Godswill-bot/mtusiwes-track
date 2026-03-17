import fs from 'fs';

const forcePatch = (f, wrong, right) => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(wrong, right);
  fs.writeFileSync(f, c);
};

forcePatch('server/controllers/pdfController.js', 
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true } } } catch(e) { console.log('mkdir failed or skipped in serverless', e.message); }",
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }"
);

forcePatch('server/controllers/adminController.js', 
  "try { if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true } } } catch(e) { console.log('mkdir failed or skipped in serverless', e.message); }",
  "try { if (!fs.existsSync(exportsDir)) { fs.mkdirSync(exportsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }"
);

forcePatch('server/controllers/logbookController.js', 
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true } } } catch(e) { console.log('mkdir failed or skipped in serverless', e.message); }",
  "try { if (!fs.existsSync(pdfsDir)) { fs.mkdirSync(pdfsDir, { recursive: true }); } } catch(e) { console.log('mkdir ignored', e.message); }"
);
