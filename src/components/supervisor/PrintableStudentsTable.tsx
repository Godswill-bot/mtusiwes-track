import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Download } from "lucide-react";

interface Student {
  id: string;
  profile: {
    full_name: string;
  };
  matric_no: string;
  department: string;
  faculty?: string;
  level?: string;
  organisation_name: string;
}

interface PrintableStudentsTableProps {
  students: Student[];
  supervisorName?: string;
  title?: string;
}

export const PrintableStudentsTable = ({ 
  students, 
  supervisorName = "Supervisor",
  title = "Students Assigned to Supervisor"
}: PrintableStudentsTableProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const styles = `
      <style>
        @media print {
          body { 
            font-family: Arial, sans-serif;
            padding: 20px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        body { 
          font-family: Arial, sans-serif;
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .header h1 {
          font-size: 24px;
          color: #333;
          margin: 0 0 10px 0;
        }
        .header h2 {
          font-size: 18px;
          color: #666;
          margin: 0 0 10px 0;
          font-weight: normal;
        }
        .header p {
          font-size: 14px;
          color: #888;
          margin: 5px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 12px 8px;
          text-align: left;
        }
        th {
          background-color: #6b21a8;
          color: white;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tr:hover {
          background-color: #f1f1f1;
        }
        .footer {
          margin-top: 40px;
          text-align: right;
          font-size: 12px;
          color: #888;
        }
        .summary {
          margin-top: 20px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        .summary p {
          margin: 5px 0;
          font-size: 14px;
        }
        @page {
          size: A4 landscape;
          margin: 1cm;
        }
      </style>
    `;

    const date = new Date().toLocaleDateString('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student List - ${supervisorName}</title>
          ${styles}
        </head>
        <body>
          <div class="header">
            <h1>Mountain Top University</h1>
            <h2>SIWES - Students Industrial Work Experience Scheme</h2>
            <p><strong>${title}</strong></p>
            <p>Supervisor: ${supervisorName}</p>
            <p>Generated on: ${date}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>S/N</th>
                <th>Student Name</th>
                <th>Matric Number</th>
                <th>Department</th>
                <th>Level</th>
                <th>Organisation</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((student, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${student.profile.full_name}</td>
                  <td>${student.matric_no}</td>
                  <td>${student.department}</td>
                  <td>${student.level || '400'}</td>
                  <td>${student.organisation_name}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <p><strong>Total Students:</strong> ${students.length}</p>
          </div>
          
          <div class="footer">
            <p>MTU SIWES Logbook System</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadCSV = () => {
    const headers = ['S/N', 'Student Name', 'Matric Number', 'Department', 'Level', 'Organisation'];
    const rows = students.map((student, index) => [
      index + 1,
      student.profile.full_name,
      student.matric_no,
      student.department,
      student.level || '400',
      student.organisation_name
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_list_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Assigned Students ({students.length})</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print List
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={printRef}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S/N</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-20">Level</TableHead>
                  <TableHead>Organisation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length > 0 ? (
                  students.map((student, index) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{student.profile.full_name}</TableCell>
                      <TableCell>{student.matric_no}</TableCell>
                      <TableCell>{student.department}</TableCell>
                      <TableCell>{student.level || '400'}</TableCell>
                      <TableCell>{student.organisation_name}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No students assigned
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
