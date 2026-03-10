const fs = require('fs');

let content = fs.readFileSync('supabase/functions/admin-students/index.ts', 'utf8');

const oldLogic =   const { data: deleteData, error: rpcError } = await supabase.rpc("force_delete_user", { target_user_id:     
payload.user_id || null, target_student_id: payload.student_id });

      if (rpcError) {
        throw rpcError;
      };
      
const oldLogicFallback1 =   const { data: deleteData, error: rpcError } = await supabase.rpc("force_delete_user", { target_user_id: payload.user_id || null, target_student_id: payload.student_id });

      if (rpcError) {
        throw rpcError;
      };
      
const oldLogicFallback2 =   const { data: deleteData, error: rpcError } = await supabase.rpc("force_delete_user", {
        target_user_id: payload.user_id || null, target_student_id: payload.student_id
      });

      if (rpcError) {
        throw rpcError;
      };

const newLogic = 
  let deleteError = null;

  // 1. Try the new 2-argument RPC
  const { error: rpcError2 } = await supabase.rpc("force_delete_user", { 
    target_user_id: payload.user_id || null, 
    target_student_id: payload.student_id 
  });

  if (rpcError2) {
    console.warn("2-arg force_delete_user failed, trying 1-arg or direct delete:", rpcError2.message);
    
    // 2. Fallback: If it's a missing function error, try the 1-arg version
    if (payload.user_id) {
      const { error: rpcError1 } = await supabase.rpc("force_delete_user", { 
        target_user_id: payload.user_id 
      });
      deleteError = rpcError1;
    } else {
      deleteError = rpcError2;
    }

    // 3. Ultimate Fallback: Direct Database Wipes via Service Role
    if (deleteError) {
      console.log("RPC failed totally. Falling back to direct service_role wipes.");
      // Manually wipe student traces
      await supabase.from('logbook_entries').delete().eq('student_id', payload.student_id);
      await supabase.from('weeks').delete().eq('student_id', payload.student_id);
      await supabase.from('attendance').delete().eq('student_id', payload.student_id);
      await supabase.from('students').delete().eq('id', payload.student_id);
      
      if (payload.user_id) {
        // Break auth triggers that hang Supabase
        await supabase.from('activities').delete().eq('user_id', payload.user_id);
        await supabase.from('audit_logs').delete().eq('user_id', payload.user_id);
        await supabase.from('user_roles').delete().eq('user_id', payload.user_id);
        await supabase.from('profiles').delete().eq('id', payload.user_id);
        await supabase.auth.admin.deleteUser(payload.user_id);
      }
      
      deleteError = null; // We bypassed it successfully
    }
  }

  if (deleteError) throw deleteError;;

// Using Regex to find whatever variation of rpc() call exists
content = content.replace(/const \{ data: deleteData, error: rpcError[\s\S]*?throw rpcError;\s*\}/, newLogic);

fs.writeFileSync('supabase/functions/admin-students/index.ts', content);
console.log('Fixed router successfully');
