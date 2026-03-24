const fs = require('fs');

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Add Eye, EyeOff to lucide-react import
  if (content.includes('import { ArrowLeft, AlertCircle } from "lucide-react";')) {
    content = content.replace('import { ArrowLeft, AlertCircle } from "lucide-react";', 'import { ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";');
  } else if (!content.includes('EyeOff')) {
    // If not matching exactly, fallback to regex
    content = content.replace(/import \{([^}]+)\} from "lucide-react";/, (match, p1) => {
       return `import {${p1}, Eye, EyeOff} from "lucide-react";`;
    });
  }

  // Add State variables
  if (!content.includes('const [showPassword, setShowPassword]')) {
     content = content.replace('const [confirmPassword, setConfirmPassword] = useState("");', 'const [confirmPassword, setConfirmPassword] = useState("");\n  const [showPassword, setShowPassword] = useState(false);\n  const [showConfirmPassword, setShowConfirmPassword] = useState(false);');
  }

  const passRep1 = `<Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading}
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>`;

  const confRep1 = `<Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>`;

  // Provide whitespace lenient regex
  const rxPass1 = /<Label htmlFor="password">Password \*<\/Label>\s*<Input\s*id="password"\s*type="password"\s*value=\{password\}\s*onChange=\{\(e\) => setPassword\(e\.target\.value\)\}\s*required\s*minLength=\{6\}\s*disabled=\{loading\}\s*className="h-10"\s*\/>/g;
  const rxConf1 = /<Label htmlFor="confirmPassword">Confirm Password \*<\/Label>\s*<Input\s*id="confirmPassword"\s*type="password"\s*value=\{confirmPassword\}\s*onChange=\{\(e\) => setConfirmPassword\(e\.target\.value\)\}\s*required\s*disabled=\{loading\}\s*className="h-10"\s*\/>/g;

  content = content.replace(rxPass1, passRep1);
  content = content.replace(rxConf1, confRep1);

  // Supervisor version of fields (no className=h-10 block)
  const passRepSup = `<Label htmlFor="password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>`;

  const confRepSup = `<Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>`;

  const rxPassSup = /<Label htmlFor="password">Password \*<\/Label>\s*<Input\s*id="password"\s*type="password"\s*value=\{password\}\s*onChange=\{\(e\) => setPassword\(e\.target\.value\)\}\s*required\s*minLength=\{6\}\s*disabled=\{loading\}\s*\/>/g;
  const rxConfSup = /<Label htmlFor="confirmPassword">Confirm Password \*<\/Label>\s*<Input\s*id="confirmPassword"\s*type="password"\s*value=\{confirmPassword\}\s*onChange=\{\(e\) => setConfirmPassword\(e\.target\.value\)\}\s*required\s*disabled=\{loading\}\s*\/>/g;
  
  content = content.replace(rxPassSup, passRepSup);
  content = content.replace(rxConfSup, confRepSup);

  fs.writeFileSync(file, content);
  console.log('Fixed ', file);
}

processFile('src/pages/student/Signup.tsx');
processFile('src/pages/school-supervisor/Signup.tsx');
