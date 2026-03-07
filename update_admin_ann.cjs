const fs = require('fs');
const file = 'src/components/admin/AdminAnnouncement.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const sendAnnouncement = async \(\) => \{[\s\S]*?if \(!announcement\.trim\(\)\)/;
const replacement = `const sendAnnouncement = async () => {
    if (!announcement.trim())`;

content = content.replace(/const sendAnnouncement = async \(\) => \{[\s\S]*?  \};/m, `const sendAnnouncement = async () => {
    if (!announcement.trim()) {
      toast.error("Announcement cannot be empty");
      return;
    }
    setLoading(true);
    
    // Insert into global announcements table for scalability
    const { error: insertError } = await (supabase as any)
      .from("announcements")
      .insert({
        title: "Important Update",
        message: announcement,
        created_at: new Date().toISOString()
      });
      
    setLoading(false);
    if (insertError) {
      console.error(insertError);
      toast.error("Failed to send announcement");
    } else {
      toast.success("Announcement sent to all students");
      setAnnouncement("");
    }
  };`);

fs.writeFileSync(file, content);
console.log("Updated AdminAnnouncement")
