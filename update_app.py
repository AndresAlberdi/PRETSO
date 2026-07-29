with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add import for Administracion
content = content.replace("import Auditoria from './pages/Auditoria';", "import Auditoria from './pages/Auditoria';\nimport Administracion from './pages/Administracion';")

# 2. Remove imports for backup
content = content.replace("import { generateDatabaseXml, downloadXml, generateZipBlob, uploadToGoogleDrive } from './utils/backup';\n", "")
content = content.replace("import { generateDatabaseXlsx, downloadXlsx } from './utils/xlsxExport';\n", "")

# 3. Remove adminMenuOpen and menuRef hooks from Layout
content = content.replace("  const [adminMenuOpen, setAdminMenuOpen] = useState(false);\n", "")
content = content.replace("  const menuRef = useRef<HTMLDivElement>(null);\n", "")

# 4. Remove useEffect from Layout
useEffect_code = """
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
"""
content = content.replace(useEffect_code, "")

# 5. Remove the state variables and functions below the useEffect
state_and_functions_start = content.find("  const [configuringClientId, setConfiguringClientId] = useState(false);")
return_div_start = content.find("  return (\n    <div>")

if state_and_functions_start != -1 and return_div_start != -1:
    content = content[:state_and_functions_start] + content[return_div_start:]

# 6. Replace the dropdown with Administracion link
dropdown_start = content.find('<div style={{ position: \'relative\' }} ref={menuRef}>')
dropdown_end = content.find('</div>\n\n            <button', dropdown_start)

if dropdown_start != -1 and dropdown_end != -1:
    content = content[:dropdown_start] + '<Link to="/administracion" style={{ color: \'var(--primary-color)\', fontWeight: \'bold\' }}>Administración</Link>\n' + content[dropdown_end + 7:]

# 7. Add Route
route_str = '<Route path="/auditoria" element={<ProtectedRoute requireAdmin><Auditoria /></ProtectedRoute>} />'
content = content.replace(route_str, route_str + '\n        <Route path="/administracion" element={<ProtectedRoute requireAdmin><Administracion /></ProtectedRoute>} />')

with open('src/App.tsx', 'w') as f:
    f.write(content)

