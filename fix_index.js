const fs = require('fs');

let css = fs.readFileSync('src/index.css', 'utf8');

// Strip UTF-16 BOM if it exists
if (css.charCodeAt(0) === 0xFEFF) {
  css = css.slice(1);
}

// Ensure the scrollbar utilities are added
if (!css.includes('.no-scrollbar')) {
  css += '\n\n@layer utilities {\n  /* Hide scrollbar for Chrome, Safari and Opera */\n  .no-scrollbar::-webkit-scrollbar {\n    display: none !important;\n  }\n  /* Hide scrollbar for IE, Edge and Firefox */\n  .no-scrollbar {\n    -ms-overflow-style: none !important;  /* IE and Edge */\n    scrollbar-width: none !important;  /* Firefox */\n  }\n}\n';
}

fs.writeFileSync('src/index.css', css, 'utf8');
console.log('Fixed index.css');
