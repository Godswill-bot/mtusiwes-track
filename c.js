const fs = require('fs');
let b = fs.readFileSync('src/pages/Index.tsx', 'utf8');
const r = /<Button[\s\S]*?onClick=\{\(\) => navigate\("\/admin\/login"\)\}[\s\S]*?Admin Login[\s\S]*?<\/Button>/g;
console.log("Matched?", r.test(b));
b = b.replace(r, '{/* Admin portal secured via URL parameter */}');
fs.writeFileSync('src/pages/Index.tsx', b);
