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
  
  c = c.replace(/className=\"min-h-screen bg-white flex items-center justify-center p-4\"/g, 
                'className=\"min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5\"');
                
  c = c.replace(/className=\"min-h-screen flex items-center justify-center p-4 bg-white\"/g, 
                'className=\"min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5\"');
                
  c = c.replace(/className=\"min-h-screen flex items-center justify-center bg-gray-50 p-4 lg:p-8\"/g, 
                'className=\"min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5 lg:p-8\"');
                
  c = c.replace(/className=\"min-h-screen flex items-center justify-center p-4 bg-gray-50 lg:bg-gray-100\"/g, 
                'className=\"min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5 lg:p-8\"');
                
  c = c.replace(/className=\"min-h-screen bg-gradient-light flex items-center justify-center p-4\"/g, 
                'className=\"min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-white to-success/5 cursor-default\"');

  fs.writeFileSync(f, c);
});
console.log('Done!');
