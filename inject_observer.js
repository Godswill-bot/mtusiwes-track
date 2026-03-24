const fs = require('fs');
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// Add import if not exists
if (!appContent.includes('ThemeRouteObserver')) {
  appContent = appContent.replace(
    'import { ThemeProvider } from "@/components/theme-provider";',
    'import { ThemeProvider } from "@/components/theme-provider";\nimport { ThemeRouteObserver } from "@/components/ThemeRouteObserver";'
  );
  
  // Inject inside BrowserRouter
  appContent = appContent.replace(
    '<BrowserRouter>',
    '<BrowserRouter>\n          <ThemeRouteObserver />'
  );
  
  fs.writeFileSync('src/App.tsx', appContent, 'utf8');
  console.log('App.tsx Updated');
} else {
  console.log('Already injected.');
}
