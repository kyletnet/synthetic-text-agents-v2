#!/usr/bin/env node
/**
 * Module I/O Schema Validation Tool
 * Validates input/output files against JSON schemas using Ajv
 */

import { readFileSync, existsSync } from 'fs';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

// Configuration
const SCHEMAS = {
  input: 'schemas/input.schema.json',
  output: 'schemas/output.schema.json'
};

// Parse command line arguments
const args = process.argv.slice(2);
const config = {
  files: [],
  schema: null,
  verbose: false,
  help: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--input':
      config.schema = 'input';
      break;
    case '--output':
      config.schema = 'output';
      break;
    case '--file':
      config.files.push(args[++i]);
      break;
    case '--verbose':
      config.verbose = true;
      break;
    case '--help':
      config.help = true;
      break;
    default:
      if (!args[i].startsWith('--') && args[i].endsWith('.json') || args[i].endsWith('.jsonl')) {
        config.files.push(args[i]);
      }
      break;
  }
}

if (config.help) {
  console.log(`
Schema Validation Tool

Usage: node tools/validate_schema.mjs [options] [files...]

Options:
  --input              Validate against input schema
  --output             Validate against output schema
  --file <path>        Add file to validation list
  --verbose            Verbose output with error details
  --help               Show this help

Examples:
  node tools/validate_schema.mjs --input data/input.jsonl
  node tools/validate_schema.mjs --output reports/results.json
  node tools/validate_schema.mjs --input --verbose tests/regression/fixtures/input.jsonl
`);
  process.exit(0);
}

// Default to input validation if no schema specified
if (!config.schema) {
  console.log('📝 No schema specified, defaulting to input validation...');
  config.schema = 'input';
}

// Auto-detect schema if not specified and files exist
if (config.files.length > 0) {
  const file = config.files[0];
  if (file.includes('input') || file.includes('fixture')) {
    config.schema = 'input';
  } else if (file.includes('output') || file.includes('result')) {
    config.schema = 'output';
  }
}

// Default validation targets if no files specified
if (config.files.length === 0) {
  // Look for common input/output files based on schema type
  const commonPaths = config.schema === 'input' ? [
    'tests/regression/fixtures/input.jsonl'
  ] : [
    'reports/regression_summary.json'
  ];

  for (const path of commonPaths) {
    if (path.includes('*')) {
      // Handle glob patterns (simplified)
      const baseDir = path.substring(0, path.lastIndexOf('/'));
      const pattern = path.substring(path.lastIndexOf('/') + 1);
      try {
        const { readdirSync } = await import('fs');
        if (existsSync(baseDir)) {
          const files = readdirSync(baseDir).filter(f => {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return regex.test(f);
          });
          files.forEach(f => {
            config.files.push(`${baseDir}/${f}`);
          });
        }
      } catch (e) {
        // Directory doesn't exist, skip
      }
    } else if (existsSync(path)) {
      config.files.push(path);
    }
  }
}

if (config.files.length === 0) {
  console.log('⚠️ No files to validate found');
  process.exit(0);
}

console.log(`🔍 Validating ${config.files.length} file(s) against ${config.schema} schema...`);

// Load schema
const schemaPath = SCHEMAS[config.schema];
if (!existsSync(schemaPath)) {
  console.error(`❌ Schema file not found: ${schemaPath}`);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
} catch (error) {
  console.error(`❌ Failed to parse schema: ${error.message}`);
  process.exit(1);
}

const validate = ajv.compile(schema);

// Validation results
let totalRecords = 0;
let validRecords = 0;
let invalidRecords = 0;
const errors = [];

// Validate each file
for (const filePath of config.files) {
  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    errors.push({ file: filePath, error: 'File not found' });
    continue;
  }

  console.log(`📁 Validating: ${filePath}`);

  try {
    const content = readFileSync(filePath, 'utf8');
    let records;

    // Handle JSONL (multiple JSON objects) vs JSON (single object/array)
    if (filePath.endsWith('.jsonl')) {
      records = content.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    } else {
      const parsed = JSON.parse(content);
      records = Array.isArray(parsed) ? parsed : [parsed];
    }

    console.log(`  📊 Found ${records.length} record(s)`);
    totalRecords += records.length;

    // Validate each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const isValid = validate(record);

      if (isValid) {
        validRecords++;
      } else {
        invalidRecords++;
        const errorInfo = {
          file: filePath,
          record: i + 1,
          id: record.id || `record_${i + 1}`,
          errors: validate.errors
        };
        errors.push(errorInfo);

        if (config.verbose) {
          console.log(`  ❌ Record ${i + 1} (${record.id || 'no id'}): INVALID`);
          validate.errors.forEach(err => {
            console.log(`    - ${err.instancePath || 'root'}: ${err.message}`);
            if (err.data !== undefined) {
              console.log(`      Got: ${JSON.stringify(err.data)}`);
            }
          });
        }
      }
    }

    if (invalidRecords === 0) {
      console.log(`  ✅ All records valid`);
    } else {
      console.log(`  ❌ ${invalidRecords} invalid record(s) found`);
    }

  } catch (error) {
    console.error(`  ❌ Failed to process file: ${error.message}`);
    errors.push({ file: filePath, error: error.message });
  }
}

// Summary
console.log('\n📊 Validation Summary:');
console.log(`  Total records: ${totalRecords}`);
console.log(`  Valid: ${validRecords}`);
console.log(`  Invalid: ${invalidRecords}`);
console.log(`  Files with errors: ${errors.length > 0 ? errors.map(e => e.file).filter((v, i, a) => a.indexOf(v) === i).length : 0}`);

if (errors.length > 0) {
  console.log('\n❌ Validation FAILED');

  if (!config.verbose) {
    console.log('\nFirst 5 errors:');
    errors.slice(0, 5).forEach((error, i) => {
      if (error.errors) {
        console.log(`${i + 1}. ${error.file}:${error.record} (${error.id})`);
        error.errors.slice(0, 2).forEach(err => {
          console.log(`   - ${err.instancePath || 'root'}: ${err.message}`);
        });
      } else {
        console.log(`${i + 1}. ${error.file}: ${error.error}`);
      }
    });

    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more errors`);
    }
    console.log('\nUse --verbose for detailed error information');
  }

  process.exit(1);
} else {
  console.log('\n✅ All validations PASSED');
  process.exit(0);
}