import fs from 'fs';
let c = fs.readFileSync('server/server.js', 'utf8');
c = c.replace(/startServer\(\);/g, "if (process.env.VERCEL !== '1') { startServer(); }");
fs.writeFileSync('server/server.js', c);
console.log('patched server.js');