import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HelperConnection } from '../HelperConnection';

class Socket extends EventEmitter {
	readyState = 1;
	pings = 0;
	terminated = 0;
	sent: string[] = [];
	ping() { this.pings++; }
	terminate() { this.terminated++; this.readyState = 3; }
	send(payload: string) { this.sent.push(payload); }
}

test('replacement clears the old session once; its late close cannot clear the new session', () => {
	let disconnects = 0;
	const connection = new HelperConnection<Socket>(() => disconnects++);
	const old = new Socket();
	const next = new Socket();
	connection.accept(old);
	connection.accept(next);
	assert.equal(old.terminated, 1);
	assert.equal(disconnects, 1);
	old.emit('close');
	assert.equal(disconnects, 1);
	assert.equal(connection.isActive(old), false);
	assert.equal(connection.isActive(next), true);
	connection.send('new request');
	assert.deepEqual(next.sent, ['new request']);
	assert.deepEqual(old.sent, []);
	next.emit('close');
	assert.equal(disconnects, 2);
	assert.equal(connection.connected, false);
	connection.stop();
	assert.equal(disconnects, 2);
});

test('an unanswered ping terminates the helper and clears readiness', t => {
	(t.mock.timers as any).enable({ apis: ['setInterval'] });
	let disconnects = 0;
	const connection = new HelperConnection<Socket>(() => disconnects++);
	const socket = new Socket();
	connection.accept(socket);
	t.mock.timers.tick(30_000);
	assert.equal(socket.pings, 1);
	assert.equal(connection.connected, true);
	t.mock.timers.tick(30_000);
	assert.equal(socket.terminated, 1);
	assert.equal(disconnects, 1);
	assert.equal(connection.connected, false);
	t.mock.timers.tick(90_000);
	assert.equal(socket.pings, 1, 'disconnect cancels the heartbeat');
});

test('pong keeps a helper alive and shutdown removes timers and listeners', t => {
	(t.mock.timers as any).enable({ apis: ['setInterval'] });
	const connection = new HelperConnection<Socket>(() => {});
	const socket = new Socket();
	connection.accept(socket);
	for (let i = 0; i < 4; i++) {
		t.mock.timers.tick(30_000);
		socket.emit('pong');
	}
	assert.equal(socket.pings, 4);
	assert.equal(connection.connected, true);
	connection.stop();
	assert.equal(socket.listenerCount('pong'), 0);
	assert.equal(socket.listenerCount('close'), 0);
	t.mock.timers.tick(90_000);
	assert.equal(socket.pings, 4);
});

test('old pongs cannot keep a replacement alive, and old timers cannot terminate it', t => {
	(t.mock.timers as any).enable({ apis: ['setInterval'] });
	const connection = new HelperConnection<Socket>(() => {});
	const old = new Socket();
	const next = new Socket();
	connection.accept(old);
	t.mock.timers.tick(30_000);
	connection.accept(next);
	t.mock.timers.tick(30_000);
	assert.equal(next.terminated, 0);
	old.emit('pong');
	t.mock.timers.tick(30_000);
	assert.equal(next.terminated, 1);
	assert.equal(old.pings, 1);
});

test('both separately packaged hosts use the same helper ownership and heartbeat code', () => {
	const root = resolve(__dirname, '../..');
	assert.equal(
		readFileSync(resolve(root, 'src/HelperConnection.ts'), 'utf8'),
		readFileSync(resolve(root, 'packages/snu/src/server/helperConnection.ts'), 'utf8'),
	);
});
