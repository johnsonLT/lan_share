const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const parts = pkg.version.split('.').map(Number);
parts[parts.length - 1] = (parts[parts.length - 1] || 0) + 1;
pkg.version = parts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Version bumped to ${pkg.version}`);
