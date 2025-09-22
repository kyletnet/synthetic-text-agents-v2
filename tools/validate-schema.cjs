const fs = require('fs');
const path = require('path');
const Ajv = require('ajv').default;
const ajv = new Ajv({allErrors:true});
const schema = JSON.parse(fs.readFileSync(path.resolve('ops/context/SCHEMA.json'), 'utf8'));
const data   = JSON.parse(fs.readFileSync(process.argv[2]||path.resolve('outputs/run1.json'), 'utf8'));
const validate = ajv.compile(schema);
const ok = validate(data);
if(!ok){
  console.error('SCHEMA_INVALID', validate.errors);
  process.exit(2);
}
console.log('SCHEMA_OK');
