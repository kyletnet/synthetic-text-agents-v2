const fs = require('fs');
const crypto = require('crypto');

function hashFile(filepath) {
  if (!fs.existsSync(filepath)) {
    return 'NOFILE';
  }
  let content = fs.readFileSync(filepath, 'utf8');
  // Remove timestamps and UUIDs for comparison
  content = content.replace(/\d{4}-\d{2}-\d{2}[^\n]*/g, '');
  content = content.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '');
  content = content.replace(/\s+/g, ' ');
  return crypto.createHash('sha1').update(content).digest('hex');
}

console.log('A:', hashFile('outputs/runA.json'));
console.log('B:', hashFile('outputs/runB.json'));
console.log('EQUAL:', hashFile('outputs/runA.json') === hashFile('outputs/runB.json'));