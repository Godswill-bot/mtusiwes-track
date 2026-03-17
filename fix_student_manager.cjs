const fs = require('fs');
let code = fs.readFileSync('src/components/admin/StudentManager.tsx', 'utf8');

// 1. Remove the Math.random table cells
const randomCellRegex = /<TableCell>\s*<div className="flex items-center gap-2">\s*<span className=\{`w-2 h-2 rounded-full \$\{Math\.random\(\) > 0\.5 \? 'bg-green-500' : 'bg-gray-400'\}`\}><\/span>\s*<span className="text-xs text-muted-foreground">\{Math\.random\(\) > 0\.5 \? 'Online' : 'Offline'\}<\/span>\s*<\/div>\s*<\/TableCell>/g;
code = code.replace(randomCellRegex, '');

// 2. Add downloadPreSiwesForm function right after downloadAsCSV
const downloadAsCSVRegex = /const downloadAsCSV = \(\) => \{[\s\S]*?URL\.revokeObjectURL\(url\);\s*\};/;
const downloadPreSiwesFormFn = `const downloadPreSiwesForm = (student: StudentRecord) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 128); // Blue color for MTU
    doc.text("Mountain Top University", 105, 20, { align: "center" });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Pre-SIWES Registration Form", 105, 30, { align: "center" });
    
    doc.setFontSize(12);
    const dateStr = new Date(student.created_at).toLocaleDateString();
    doc.text(\`Registration Date: \${dateStr}\`, 14, 45);
    
    doc.setFontSize(14);
    doc.text("1. Student Information", 14, 55);
    
    autoTable(doc, {
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Full Name", student.full_name || "N/A"],
        ["Matriculation Number", student.matric_no || "N/A"],
        ["Email Address", student.email || "N/A"],
        ["Phone Number", student.phone || "N/A"],
        ["Department", student.department || "N/A"],
        ["Faculty", student.faculty || "N/A"],
      ],
    });

    const currentYOrg = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("2. Placement Organization Details", 14, currentYOrg);
    
    autoTable(doc, {
      startY: currentYOrg + 5,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Organization Name", student.organisation_name || "N/A"],
        ["Organization Address", student.organisation_address || "N/A"],
        ["Nature of Business", student.nature_of_business || "N/A"],
      ],
    });

    const currentYSup = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("3. Industry Supervisor Details", 14, currentYSup);
    
    autoTable(doc, {
      startY: currentYSup + 5,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Sup. Name", student.industry_supervisor_name || "N/A"],
        ["Sup. Phone", student.industry_supervisor_phone || "N/A"],
        ["Sup. Email", student.industry_supervisor_email || "N/A"],
      ],
    });

    doc.setFontSize(10);
    doc.text("Official MTU SIWES Unit Documentation", 105, 280, { align: "center" });

    doc.save(\`\${student.matric_no}_Pre_SIWES_Form.pdf\`);
  };`;

// replace downloadAsCSV with itself + downloadPreSiwesFormFn
code = code.replace(downloadAsCSVRegex, (match) => {
    return match + '\n\n  ' + downloadPreSiwesFormFn;
});

// 3. Add the PDF export button in the Actions column
const editButtonRegex = /<Button\s+variant="outline"\s+size="sm"\s+onClick=\{\(\) => \{\s*setEditingStudent\(student\);\s*setEditFormState\(student\);\s*setEditOpen\(true\);\s*\}\}\s+className="text-xs w-full sm:w-auto"\s*>\s*Edit\s*<\/Button>/g;
const formButton = `
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadPreSiwesForm(student)}
                            className="text-xs w-full sm:w-auto"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Form
                          </Button>`;

code = code.replace(editButtonRegex, (match) => {
    return match + formButton;
});

// Write to file
fs.writeFileSync('src/components/admin/StudentManager.tsx', code);
console.log('Fixed StudentManager.tsx');
