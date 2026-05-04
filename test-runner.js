// Quick minimal test to verify imports work
try {
  const zod = require('zod');
  console.log('✓ zod imported successfully:', typeof zod.z);
} catch(e) {
  console.log('✗ zod failed:', e.message);
}

try {
  const lz = require('lz-string');
  console.log('✓ lz-string imported successfully:', typeof lz.compress);
} catch(e) {
  console.log('✗ lz-string failed:', e.message);
}

try {
  const vitest = require('vitest');
  console.log('✓ vitest imported successfully');
} catch(e) {
  console.log('✗ vitest failed:', e.message);
}
