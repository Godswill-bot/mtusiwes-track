const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminDashboardOverview.tsx', 'utf8');

// Replace card 1 (Purple)
code = code.replace(
  'bg-gradient-to-br from-purple-50 via-white to-purple-50/50',
  'bg-gradient-to-br from-purple-50 via-white to-purple-50/50 dark:from-purple-950/20 dark:via-background dark:to-purple-900/10'
);
code = code.replace(
  'className="font-medium text-purple-600"',
  'className="font-medium text-purple-600 dark:text-purple-400"'
);

// Replace card 2 (Blue)
code = code.replace(
  'bg-gradient-to-br from-blue-50 via-white to-blue-50/50',
  'bg-gradient-to-br from-blue-50 via-white to-blue-50/50 dark:from-blue-950/20 dark:via-background dark:to-blue-900/10'
);
code = code.replace(
  'className="font-medium text-blue-600"',
  'className="font-medium text-blue-600 dark:text-blue-400"'
);
code = code.replace(
  'className="flex items-center text-blue-600 bg-primary/10',
  'className="flex items-center text-blue-600 dark:text-blue-400 bg-primary/10 dark:bg-primary/20'
);

// Replace card 3 (Emerald)
code = code.replace(
  'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50',
  'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/50 dark:from-emerald-950/20 dark:via-background dark:to-emerald-900/10'
);
code = code.replace(
  'className="font-medium text-emerald-600"',
  'className="font-medium text-emerald-600 dark:text-emerald-400"'
);

// Replace card 4 (Rose)
code = code.replace(
  'bg-gradient-to-br from-rose-50 via-white to-rose-50/50',
  'bg-gradient-to-br from-rose-50 via-white to-rose-50/50 dark:from-rose-950/20 dark:via-background dark:to-rose-900/10'
);
code = code.replace(
  'className="font-medium text-rose-600"',
  'className="font-medium text-rose-600 dark:text-rose-400"'
);
code = code.replace(
  'className="inline-flex items-center text-rose-600 bg-rose-50',
  'className="inline-flex items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10'
);

// Emerald badge active check string replace
code = code.replace(
  "'text-emerald-600 bg-emerald-50' : 'text-muted-foreground bg-muted'",
  "'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-muted-foreground bg-muted'"
);

// Fix the System Overview card which has border-purple-100/50 and bg-card/50
code = code.replace(
  'bg-card/50 p-4 rounded-2xl backdrop-blur-sm border border-purple-100/50',
  'bg-card/50 p-4 rounded-2xl backdrop-blur-sm border border-purple-100/50 dark:border-purple-900/50'
);
code = code.replace(
  'bg-gradient-to-r from-purple-700 to-indigo-600',
  'bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-400 dark:to-indigo-400'
);

// Weekly Engagement Card Fix
code = code.replace(
  'bg-gradient-to-br from-indigo-900 to-purple-900',
  'bg-gradient-to-br from-indigo-900 to-purple-900 dark:from-indigo-950 dark:to-purple-950 dark:border-purple-900/30'
);


fs.writeFileSync('src/components/admin/AdminDashboardOverview.tsx', code);
console.log('UI Patched for Dark Mode Cards');
