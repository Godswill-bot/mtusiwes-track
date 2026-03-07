const fs = require('fs');
const file = 'src/components/student/StudentNotifications.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacementQuery = `    queryFn: async (): Promise<Notification[]> => {
      if (!user?.id) return [];

      // 1. Query personal notifications
      const { data: personalNotes, error: notifError } = await (supabase as any)
        .from('notifications')
        .select('id, title, message, type, is_read, link, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (notifError) console.error('Failed to fetch notifications:', notifError);

      // 2. Query global announcements
      const { data: globalAnnouncements, error: annError } = await (supabase as any)
        .from('announcements')
        .select('id, title, message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (annError) console.error('Failed to fetch announcements:', annError);

      const parsedPersonal = (personalNotes as unknown as Notification[]) || [];
      
      const parsedGlobal = (globalAnnouncements || []).map((ann: any) => ({
        id: \`ann-\${ann.id}\`,
        title: \`?? Global: \${ann.title}\`,
        message: ann.message,
        type: 'announcement',
        is_read: false, // Announcements are treated as unread or stateless
        created_at: ann.created_at
      }));

      // Merge and sort
      const allNotifs = [...parsedPersonal, ...parsedGlobal].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allNotifs;
    },`;

content = content.replace(/queryFn: async \(\): Promise<Notification\[\]> => \{[\s\S]*?enabled: !!user\?.id,/, replacementQuery + '\n    enabled: !!user?.id,');

fs.writeFileSync(file, content);
console.log("Updated Notifications");
