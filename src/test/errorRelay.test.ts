import test from 'node:test';
import assert from 'node:assert';
import { instanceFolderMatchesError, readErrorInstance } from '../agent/errorRelay';

const dev = { name: 'dev221527', url: 'https://dev221527.service-now.com' };

test('an error without an instance tag still reaches every folder', () => {
	assert.strictEqual(instanceFolderMatchesError('dev221527', dev.url, undefined), true);
	assert.strictEqual(instanceFolderMatchesError('acme', 'https://acme.service-now.com', undefined), true);
});

test('a tagged error reaches only the folder named after the instance', () => {
	assert.strictEqual(instanceFolderMatchesError('dev221527', dev.url, dev), true);
	assert.strictEqual(instanceFolderMatchesError('acme', 'https://acme.service-now.com', dev), false);
});

test('a renamed folder still matches on the settings url origin', () => {
	assert.strictEqual(instanceFolderMatchesError('client-dev', 'https://dev221527.service-now.com/', dev), true);
	assert.strictEqual(instanceFolderMatchesError('client-dev', 'https://DEV221527.service-now.com/nav_to.do', { url: dev.url }), true);
	assert.strictEqual(instanceFolderMatchesError('client-dev', 'not a url', { url: dev.url }), false);
	assert.strictEqual(instanceFolderMatchesError('client-dev', undefined, { url: dev.url }), false);
});

test('readErrorInstance ignores malformed tags', () => {
	assert.strictEqual(readErrorInstance({}), undefined);
	assert.strictEqual(readErrorInstance({ errorInstance: 'dev' }), undefined);
	assert.strictEqual(readErrorInstance({ errorInstance: { name: '  ', url: '' } }), undefined);
	assert.deepStrictEqual(readErrorInstance({ errorInstance: { name: ' dev ', url: dev.url } }), { name: 'dev', url: dev.url });
});
