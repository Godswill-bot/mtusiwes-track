import fs from 'fs';

['server/controllers/adminController.js', 'server/controllers/logbookController.js', 'server/controllers/pdfController.js'].forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/try \{ if \(!fs.existsSync\(.*?\}\);?/g, function(match) {
     return match.replace(/\);?$/, '');
  });
  
  // Actually, let's just do it simpler:
  // Find "catch(e) { console.log('mkdir failed or skipped in serverless', e.message); });" and remove the ");"
  c = c.replace(/catch\(e\) \{ console\.log\('mkdir failed or skipped in serverless', e\.message\); \}\);?/g, 
                "catch(e) { console.log('mkdir failed or skipped in serverless', e.message); }");
                
  c = c.replace(/catch\(e\) \{ console\.log\(\"Could not create dir \" \+ .*?\); \} \}/g, ""); 
  
  fs.writeFileSync(f, c);
  console.log('Fixed', f);
});