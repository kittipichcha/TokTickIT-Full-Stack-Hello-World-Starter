const fs = require('fs');
const path = require('path');

// Read the TypeScript source
const source = fs.readFileSync(path.join(__dirname, 'src/integer-validation.ts'), 'utf8');

// Extract the validateIntegerFields function logic
console.log('Analyzing integer validation logic...');

// Simulate the readNumberToken logic
function simulateReadNumberToken(input) {
  let pos = 0;
  const len = input.length;
  const body = input;
  
  const start = pos;
  if (body[pos] === "-") pos++;
  if (pos < len && body[pos] >= "0" && body[pos] <= "9") {
    if (body[pos] === "0") {
      pos++;
    } else {
      pos++;
      while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
    }
  }
  if (pos < len && body[pos] === ".") {
    pos++;
    while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
  }
  if (pos < len && (body[pos] === "e" || body[pos] === "E")) {
    pos++;
    if (pos < len && (body[pos] === "+" || body[pos] === "-")) pos++;
    while (pos < len && body[pos] >= "0" && body[pos] <= "9") pos++;
  }
  return body.substring(start, pos);
}

console.log('Testing readNumberToken simulation:');
console.log('Input "01":', simulateReadNumberToken('01'));
console.log('Input "001":', simulateReadNumberToken('001'));
console.log('Input "0123":', simulateReadNumberToken('0123'));
console.log('Input "0":', simulateReadNumberToken('0'));
console.log('Input "123":', simulateReadNumberToken('123'));
console.log('Input "1.0":', simulateReadNumberToken('1.0'));
console.log('Input "1e0":', simulateReadNumberToken('1e0'));

// Test regex
const pattern = /^(?:0|[1-9]\d*)$/;
console.log('\nRegex test:');
console.log('"01" matches?', pattern.test('01'));
console.log('"001" matches?', pattern.test('001'));
console.log('"0123" matches?', pattern.test('0123'));
console.log('"0" matches?', pattern.test('0'));
console.log('"123" matches?', pattern.test('123'));

// Now test the actual compiled module
console.log('\nTesting actual module:');
const { validateIntegerFields } = require('./dist/src/integer-validation.js');

// Create a test that logs what happens
const testJSON = '{"categoryId":01}';
console.log('Test JSON:', testJSON);
console.log('Result:', validateIntegerFields(testJSON, ['categoryId']));

// Let's also test with a valid JSON string (with quotes around numbers)
const validJSON = '{"categoryId":1}';
console.log('\nValid JSON:', validJSON);
console.log('Result:', validateIntegerFields(validJSON, ['categoryId']));

// Test with JSON.parse
console.log('\nJSON.parse tests:');
try {
  console.log('JSON.parse("{\\"categoryId\\":01}"):', JSON.parse('{"categoryId":01}'));
} catch(e) {
  console.log('JSON.parse fails for 01:', e.message);
}

try {
  console.log('JSON.parse("{\\"categoryId\\":1}"):', JSON.parse('{"categoryId":1}'));
} catch(e) {
  console.log('JSON.parse fails for 1:', e.message);
}