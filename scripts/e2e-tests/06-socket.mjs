/**
 * Test 6: Verify support-service /support Socket.IO namespace accepts
 * authenticated connections.
 */
import { io } from 'file:///E:/Devtechs/node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/esm/index.js';

(async () => {
  // Get a real access token via auth-service /auth/login
  const loginRes = await fetch('http://127.0.0.1:4001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@devtechs.com', password: 'Admin@DevTechs2026' }),
  });
  const login = await loginRes.json();
  if (!login.accessToken) {
    console.error('FAIL: could not obtain accessToken from auth-service:', login);
    process.exit(1);
  }
  console.log('PASS :: obtained access token (len=' + login.accessToken.length + ')');

  // Connect to support-service Socket.IO /support namespace
  const socket = io('http://127.0.0.1:4008/support', {
    auth: { token: login.accessToken },
    transports: ['websocket'],
    reconnection: false,
    timeout: 8000,
  });

  let outcome = 'pending';
  socket.on('connect', () => {
    console.log('PASS :: socket connected, id=' + socket.id);
  });
  socket.on('connected', (payload) => {
    console.log('PASS :: server emitted "connected" event:', JSON.stringify(payload));
    outcome = 'connected';
    socket.disconnect();
  });
  socket.on('connect_error', (err) => {
    console.log('FAIL :: connect_error:', err.message);
    outcome = 'error: ' + err.message;
    socket.disconnect();
  });
  socket.on('disconnect', (reason) => {
    console.log('  disconnect reason:', reason);
  });

  // Wait up to 8s
  await new Promise((res) => setTimeout(res, 8000));
  console.log('OUTCOME:', outcome);
  process.exit(outcome === 'connected' ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
