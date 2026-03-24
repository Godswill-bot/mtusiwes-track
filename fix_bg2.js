const fs = require('fs');

const files = [
  'src/pages/admin/Login.tsx',
  'src/pages/industry-supervisor/Login.tsx',
  'src/pages/school-supervisor/Login.tsx',
  'src/pages/school-supervisor/Signup.tsx',
  'src/pages/student/Login.tsx',
  'src/pages/student/Signup.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  
  c = c.replace(/className=(['"])[^'"]*min-h-screen[^'"]*(['"])/g, (match, quote) => {
      // Keep min-h-screen, flex, items-center, justify-center, p-4
      // Give it the gradient
      let newClass = "min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5";
      if (match.includes("lg:p-8")) newClass += " lg:p-8"; // Keep lg:p-8 if it was there
      return "className=" + quote + newClass + quote;
  });

  fs.writeFileSync(f, c);
});
console.log('Done!');
