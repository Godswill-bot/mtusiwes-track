const fs = require('fs');
let content = fs.readFileSync('supabase/functions/admin-students/index.ts', 'utf8');
content = content.replace(/await supabase\.rpc\("force_delete_user"[\s\S]*?\}\);/g, 'await supabase.rpc("force_delete_user", { target_user_id: payload.user_id || null, target_student_id: payload.student_id });');
fs.writeFileSync('supabase/functions/admin-students/index.ts', content);
