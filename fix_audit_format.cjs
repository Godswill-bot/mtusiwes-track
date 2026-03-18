const fs = require('fs');

let code = fs.readFileSync('src/components/admin/AuditLogPanel.tsx', 'utf8');

const formatHelper = `const renderRecord = (record: Record<string, unknown> | null, otherRecord: Record<string, unknown> | null = null) => {
  if (!record) return <span className="text-muted-foreground italic px-2">None</span>;
  return (
    <div className="space-y-2 bg-slate-50/50 p-3 rounded-lg border">
      {Object.entries(record).map(([key, value]) => {
        // Highlighting logic: if it's different from the other record
        const isDifferent = otherRecord && JSON.stringify(otherRecord[key]) !== JSON.stringify(value);
        return (
          <div key={key} className={\`grid grid-cols-[1fr_2fr] gap-3 py-1.5 border-b border-gray-100 last:border-0 \${isDifferent ? 'bg-indigo-50/40 -mx-1 px-1 rounded' : ''}\`}>
            <div className="text-xs font-medium text-gray-500 capitalize">
              {key.replace(/_/g, ' ')}
            </div>
            <div className={\`text-xs break-words font-mono \${isDifferent ? 'text-indigo-700 font-semibold' : 'text-gray-800'}\`}>
              {value === null ? (
                <span className="text-gray-400 italic">null</span>
              ) : typeof value === 'boolean' ? (
                value ? 'true' : 'false'
              ) : (
                String(value)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};`;

// Insert the helper just before the AuditLogPanel export
code = code.replace('export const AuditLogPanel = () => {', formatHelper + '\n\nexport const AuditLogPanel = () => {');

// Replace the <pre> tags with the new render helper
const previousValuesRegex = /<pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">\s*\{log\.old_value \? JSON\.stringify\(log\.old_value, null, 2\) : "None"\}\s*<\/pre>/;
code = code.replace(previousValuesRegex, '{renderRecord(log.old_value, log.new_value)}');

const newValuesRegex = /<pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">\s*\{log\.new_value \? JSON\.stringify\(log\.new_value, null, 2\) : "None"\}\s*<\/pre>/;
code = code.replace(newValuesRegex, '{renderRecord(log.new_value, log.old_value)}');

fs.writeFileSync('src/components/admin/AuditLogPanel.tsx', code);
console.log('Audit log format improved');
