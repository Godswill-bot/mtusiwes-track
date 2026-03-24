const fs = require('fs');
const files = [
  'src/pages/industry-supervisor/Login.tsx',
  'src/pages/school-supervisor/Login.tsx',
  'src/pages/school-supervisor/Signup.tsx',
  'src/pages/student/Login.tsx',
  'src/pages/student/Signup.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');

  // Skip if already done
  if (content.includes('portalActive === null')) {
    console.log('Already fixed ' + file);
    continue;
  }

  content = content.replace(/const \[portalActive, setPortalActive\] = useState\(true\);/, 'const [portalActive, setPortalActive] = useState<boolean | null>(null);');

  const replaceStr = `  if (portalActive === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

`;

  let regex = /  if \(\!portalActive\) \{\s+return \(/g;
  let matches = [...content.matchAll(regex)];
  if (matches.length > 0) {
      let lastMatch = matches[matches.length - 1][0];
      let lastTargetIndex = content.lastIndexOf(lastMatch);
      content = content.substring(0, lastTargetIndex) + replaceStr + content.substring(lastTargetIndex);
      fs.writeFileSync(file, content);
      console.log('Fixed ' + file);
  } else {
      console.log('Could not find match in ' + file);
  }
}
