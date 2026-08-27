import { validateIntegerFields } from './dist/src/integer-validation.js';

// Test edge cases for integer validator
console.log('Testing integer validator edge cases...\n');

// Test 1: Decimal forms
console.log('Test 1: Decimal forms');
console.log('1.0:', validateIntegerFields('{"categoryId":1.0}', ['categoryId']));
console.log('0.0:', validateIntegerFields('{"categoryId":0.0}', ['categoryId']));
console.log('1.5:', validateIntegerFields('{"categoryId":1.5}', ['categoryId']));

// Test 2: Exponent forms  
console.log('\nTest 2: Exponent forms');
console.log('1e0:', validateIntegerFields('{"categoryId":1e0}', ['categoryId']));
console.log('1e+0:', validateIntegerFields('{"categoryId":1e+0}', ['categoryId']));
console.log('1e-0:', validateIntegerFields('{"categoryId":1e-0}', ['categoryId']));
console.log('1E0:', validateIntegerFields('{"categoryId":1E0}', ['categoryId']));

// Test 3: Negative numbers
console.log('\nTest 3: Negative numbers');
console.log('-1:', validateIntegerFields('{"categoryId":-1}', ['categoryId']));
console.log('-0:', validateIntegerFields('{"categoryId":-0}', ['categoryId']));

// Test 4: Whitespace variations
console.log('\nTest 4: Whitespace variations');
console.log('With spaces:', validateIntegerFields('{ "categoryId" : 1 }', ['categoryId']));
console.log('With tabs:', validateIntegerFields('{\t"categoryId"\t:\t1\t}', ['categoryId']));
console.log('With newlines:', validateIntegerFields('{\n"categoryId":\n1\n}', ['categoryId']));

// Test 5: Nested objects with whitespace
console.log('\nTest 5: Nested objects with whitespace');
console.log('Nested with spaces:', validateIntegerFields('{"ignored": {"a": 1, "b": 2}, "categoryId": 1}', ['categoryId']));
console.log('Nested with commas spaces:', validateIntegerFields('{"ignored": {"a":1, "b":2}, "categoryId":1}', ['categoryId']));

// Test 6: Edge cases from spec §0
console.log('\nTest 6: Edge cases from spec §0');
console.log('Leading zeros (invalid):', validateIntegerFields('{"categoryId":01}', ['categoryId']));
console.log('Multiple zeros (valid):', validateIntegerFields('{"categoryId":0}', ['categoryId']));
console.log('Large number:', validateIntegerFields('{"categoryId":1234567890}', ['categoryId']));

// Test 7: Unicode escaped property names
console.log('\nTest 7: Unicode escaped property names');
console.log('\\u0063\\u0061\\u0074\\u0065\\u0067\\u006f\\u0072\\u0079\\u0049\\u0064:', 
  validateIntegerFields('{"\\u0063\\u0061\\u0074\\u0065\\u0067\\u006f\\u0072\\u0079\\u0049\\u0064":1.0}', ['categoryId']));

// Test 8: Invalid JSON
console.log('\nTest 8: Invalid JSON');
console.log('Invalid JSON:', validateIntegerFields('{invalid}', ['categoryId']));
console.log('Empty string:', validateIntegerFields('', ['categoryId']));
console.log('Undefined:', validateIntegerFields(undefined, ['categoryId']));