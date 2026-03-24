const fs = require('fs');
const file = 'src/components/SupervisorStudentChatDrawer.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace mapping start
const oldStart = {messages.map(msg => {
                const isMine = msg.sender_role === (isStudent ? 'student' : 'supervisor');
                const theirName = isStudent ? (supervisorInfo?.name || 'Supervisor') : (student?.profile?.full_name || student?.full_name || student?.name || 'Student');
                const isEditing = editingMessageId === msg.id;

                return (
                <div key={msg.id} className={\mb-4 flex \ group\}>;

const newStart = {messages.map((msg, index) => {
                const isMine = msg.sender_role === (isStudent ? 'student' : 'supervisor');
                const theirName = isStudent ? (supervisorInfo?.name || 'Supervisor') : (student?.profile?.full_name || student?.full_name || student?.name || 'Student');
                const isEditing = editingMessageId === msg.id;

                const currentDateGroup = formatDateGroup(msg.created_at);
                const prevDateGroup = index > 0 ? formatDateGroup(messages[index - 1].created_at) : null;
                const showDateGroup = currentDateGroup !== prevDateGroup;

                return (
                <React.Fragment key={msg.id}>
                  {showDateGroup && (
                    <div className="flex justify-center my-4">
                      <span className="bg-gray-200 text-gray-600 text-[10px] px-3 py-1 rounded-full font-medium">
                        {currentDateGroup}
                      </span>
                    </div>
                  )}
                <div className={\mb-4 flex \ group\}>;

content = content.replace(oldStart, newStart);

// Handle the missing key warning the right way:
// It previously had <div key={msg.id} and we replaced it with <div className=.... The key is now on React.Fragment.
// Actually we need to be careful with the bottom closure.

// Wait, the bottom closure doesn't need to change if we just close <React.Fragment> where </div> from msg.id closed? No, wait. The original closed with </div> then ); then })}
const oldEnd =   </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-3 bg-white mt-auto">;

const newEnd =   </div>
                </div>
                </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-3 bg-white mt-auto">;

content = content.replace(oldEnd, newEnd);
fs.writeFileSync(file, content);
const fs = require("fs");
const file = "src/components/SupervisorStudentChatDrawer.tsx";
let c = fs.readFileSync(file, "utf8");
c = c.replace(/\{messages\.map\(msg => \{[\s\S]*?return \(\s*<div key=\{msg\.id\}/, `{messages.map((msg, index) => {
              const isMine = msg.sender_role === (isStudent ? "student" : "supervisor");
              const theirName = isStudent ? (supervisorInfo?.name || "Supervisor") : (student?.profile?.full_name || student?.full_name || student?.name || "Student");
              const isEditing = editingMessageId === msg.id;

              const currentDateGroup = formatDateGroup(msg.created_at);
              const prevDateGroup = index > 0 ? formatDateGroup(messages[index - 1].created_at) : null;
              const showDateGroup = currentDateGroup !== prevDateGroup;

              return (
              <React.Fragment key={msg.id}>
                {showDateGroup && (
                  <div className="flex justify-center my-4">
                    <span className="bg-gray-200 text-gray-600 text-[10px] px-3 py-1 rounded-full font-medium">
                      {currentDateGroup}
                    </span>
                  </div>
                )}
              <div className=`);
c = c.replace(/<\/div>\s*\}\)\}\s*<\/div>\s*\)\s*\}\s*<\/div>\s*<div className="border-t p-3 bg-white mt-auto">/, `</div>
                </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t p-3 bg-white mt-auto">`);
fs.writeFileSync(file, c);
