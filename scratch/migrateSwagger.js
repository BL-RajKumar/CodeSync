import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'routes');
const docsDir = path.join(process.cwd(), 'docs');

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let yamlContent = '';
  let inSwaggerBlock = false;
  
  // Regular expression to match Swagger blocks
  // /**\s*\n\s*\*\s*@swagger[\s\S]*?\*/
  
  const swaggerRegex = /\/\*\*[\s\S]*?@swagger[\s\S]*?\*\/\n?/g;
  
  let match;
  while ((match = swaggerRegex.exec(content)) !== null) {
    const block = match[0];
    
    // Process block into YAML
    const lines = block.split('\n');
    let parsedYaml = '';
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.includes('@swagger') || line.trim() === '/**' || line.trim() === '*/' || line.trim() === '*/\r') {
        continue;
      }
      // Remove leading " * " or " *"
      line = line.replace(/^\s*\*\s?/, '');
      parsedYaml += line + '\n';
    }
    
    yamlContent += parsedYaml + '\n';
  }

  if (yamlContent.trim().length > 0) {
    // Add paths: root element if not present?
    // Wait, swagger-jsdoc merges everything perfectly, so just dumping the YAML fragments is exactly what it does internally anyway!
    
    // Save YAML
    const yamlName = file.replace('.js', '.yaml');
    fs.writeFileSync(path.join(docsDir, yamlName), yamlContent.trim());
    console.log(`Created ${yamlName}`);
    
    // Remove blocks from JS file
    const cleanContent = content.replace(swaggerRegex, '');
    fs.writeFileSync(filePath, cleanContent);
    console.log(`Cleaned ${file}`);
  }
});
