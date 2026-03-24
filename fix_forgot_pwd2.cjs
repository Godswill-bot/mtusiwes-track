const fs = require('fs');

let content = fs.readFileSync('src/pages/student/Login.tsx', 'utf8');

const target1 = `<div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                    <Button variant="link" className="p-0 h-auto text-sm text-primary" onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}>
                      Forgot Password?
                    </Button>
                  </div>`;

const rep1 = `<div className="flex justify-between items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>`;

const rep2 = `<div className="mt-8 text-center pb-8 border-t pt-6 flex flex-col items-center gap-2">
                <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <Button variant="link" className="p-0 h-auto font-semibold text-primary hover:text-primary/80" onClick={() => navigate("/student/signup")}>
                    Sign up here
                  </Button>
                </p>
                <div className="mt-2">
                  <Button variant="link" className="p-0 h-auto text-sm text-foreground hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}>
                    Forgot Password?
                  </Button>
                </div>
              </div>`;

const rxTarget1 = /<div className="flex justify-between items-center">[\s\S]*?<Label htmlFor="password">Password<\/Label>[\s\S]*?<Button variant="link" className="p-0 h-auto text-sm text-primary" onClick=\{\(e\) => \{ e\.preventDefault\(\); navigate\("\/forgot-password"\); \}\}>[\s\S]*?Forgot Password\?[\s\S]*?<\/Button>[\s\S]*?<\/div>/g;

content = content.replace(rxTarget1, rep1);

const rxTarget2 = /<div className="mt-8 text-center pb-8 border-t pt-6">[\s\S]*?<p className="text-muted-foreground">[\s\S]*?Don't have an account\?\{" "\}[\s\S]*?<Button variant="link" className="p-0 h-auto font-semibold text-primary hover:text-primary\/80" onClick=\{.*?navigate\("\/student\/signup"\)\}>[\s\S]*?Sign up here[\s\S]*?<\/Button>[\s\S]*?<\/p>[\s\S]*?<\/div>/g;

content = content.replace(rxTarget2, rep2);

fs.writeFileSync('src/pages/student/Login.tsx', content);
console.log('Update Complete.');
