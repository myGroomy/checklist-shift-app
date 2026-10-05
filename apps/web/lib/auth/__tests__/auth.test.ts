import assert from 'node:assert';
import { hashPin, verifyPin, isWeakPin } from '../pin';
import { signToken, verifyToken } from '../session';

async function runAuthTests() {
  console.log('Running Phase 2 Auth Unit Checks...');

  // Set test environment variable
  process.env.PIN_PEPPER = 'test-pepper-secret-key-12345';
  process.env.SESSION_SECRET = 'test-session-secret-key-67890';

  // 1. PIN Hashing & Verification
  const pin = '582914';
  const hashed = await hashPin(pin);
  assert(hashed !== pin, 'Hash should not match raw PIN');
  assert(await verifyPin(pin, hashed) === true, 'Valid PIN should verify');
  assert(await verifyPin('000000', hashed) === false, 'Invalid PIN should fail');

  // 2. Weak PIN Detection (BR-30)
  assert(isWeakPin('111111') === true, 'Same digits should be weak');
  assert(isWeakPin('123456') === true, 'Sequential up should be weak');
  assert(isWeakPin('654321') === true, 'Sequential down should be weak');
  assert(isWeakPin('121212') === true, 'Repeating 2-digit should be weak');
  assert(isWeakPin('123123') === true, 'Repeating 3-digit should be weak');
  assert(isWeakPin('582914') === false, 'Random PIN should not be weak');

  // 3. JWT Token Signing & Verification
  const payload = { userId: 'usr_123', sessionId: 'ses_456', exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = signToken(payload);
  assert(typeof token === 'string' && token.split('.').length === 3, 'Token should be valid JWT structure');

  const decoded = verifyToken(token);
  assert(decoded !== null, 'Token should decode successfully');
  assert(decoded?.userId === 'usr_123', 'Decoded userId should match');
  assert(decoded?.sessionId === 'ses_456', 'Decoded sessionId should match');

  // Expired token check
  const expiredPayload = { userId: 'usr_123', sessionId: 'ses_456', exp: Math.floor(Date.now() / 1000) - 3600 };
  const expiredToken = signToken(expiredPayload);
  assert(verifyToken(expiredToken) === null, 'Expired token should fail verification');

  console.log('All Phase 2 Auth Unit Checks Passed!');
}

runAuthTests().catch((err) => {
  console.error('Auth test failed:', err);
  process.exit(1);
});
