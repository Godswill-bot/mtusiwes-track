const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('ThemeRouteObserver')) {
  code = code.replace(
    'import { ThemeProvider } from "@/components/theme-provider";',
    'import { ThemeProvider } from "@/components/theme-provider";\nimport { ThemeRouteObserver } from "@/components/ThemeRouteObserver";'
  );
  code = code.replace('<AuthProvider>', '<AuthProvider>\n              <ThemeRouteObserver />');
  fs.writeFileSync('src/App.tsx', code);
  console.log('Injected ThemeRouteObserver');
} else {
  console.log('Already there');
}
