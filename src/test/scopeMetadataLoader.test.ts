import test from 'node:test';
import assert from 'node:assert/strict';
import { ScopeMetadataLoader } from '../ScopeMetadataLoader';

function harness() {
	const sent: any[] = [];
	const completed: any[] = [];
	const loader = new ScopeMetadataLoader(message => sent.push(message), message => completed.push(message));
	const request = {
		action: 'requestRecords', actionGoal: 'writeInstanceMetaDataScope',
		filePath: '/dev/x_app/scope.json', scopeName: 'x_app',
		instance: { name: 'dev' }, includeEmpty: true, tableName: 'sys_metadata',
		queryString: 'sysparm_fields=sys_class_name,sys_name,sys_id,sys_updated_on&sysparm_query=sys_scope=scope_id^sys_class_name!=sys_metadata_delete^sys_update_name!=NULL^ORDERBYDESCsys_class_name^ORDERBYsys_id',
	};
	return { sent, completed, loader, request };
}

test('large discovery retains tables beyond the first 10,000 metadata records', () => {
	const { sent, completed, loader, request } = harness();
	const rows = Array.from({ length: 10201 }, (_, i) => ({
		sys_id: i.toString(16).padStart(32, '0'), sys_name: `Record ${i}`,
		sys_updated_on: '2026-09-10 10:00:00',
		sys_class_name: i < 10000 ? 'sys_transform_entry' : 'catalog_script_client',
	}));
	loader.start(request);
	for (let offset = 0; offset < rows.length; offset += 200) {
		assert.equal(completed.length, 0, 'do not build the tree or download tables from partial discovery');
		const page = sent[offset / 200];
		assert.equal(page.queryString, `${request.queryString}&sysparm_limit=200&sysparm_offset=${offset}`);
		assert.equal(page.results, undefined, 'do not send accumulated records back to the browser');
		assert.equal(page.type, undefined);
		loader.accept({ ...page, type: 'response', results: rows.slice(offset, offset + 200) });
	}
	assert.equal(sent.length, 52);
	assert.equal(completed.length, 1);
	assert.deepEqual(completed[0].results, rows);
	for (const key of ['filePath', 'scopeName', 'instance', 'includeEmpty', 'actionGoal']) {
		assert.deepEqual(completed[0][key], request[key]);
	}
	assert.deepEqual([...new Set(completed[0].results.map(row => row.sys_class_name))], ['sys_transform_entry', 'catalog_script_client']);
});

test('a full last page requires an empty page before completing', () => {
	const { sent, completed, loader, request } = harness();
	loader.start(request);
	const rows = Array.from({ length: 200 }, (_, i) => ({ sys_id: String(i) }));
	loader.accept({ ...sent[0], results: rows });
	assert.equal(completed.length, 0);
	loader.accept({ ...sent[1], results: [] });
	assert.deepEqual(completed[0].results, rows);
	assert.equal(sent.length, 2);
});

test('empty and small scopes complete after one page', () => {
	for (const rows of [[], [{ sys_id: 'a', sys_class_name: 'catalog_script_client' }]]) {
		const { sent, completed, loader, request } = harness();
		loader.start(request);
		loader.accept({ ...sent[0], results: rows });
		assert.deepEqual(completed[0].results, rows);
		assert.equal(sent.length, 1);
	}
});

test('restarting discovery discards earlier pages and ignores stale responses', () => {
	const { sent, completed, loader, request } = harness();
	loader.start(request);
	loader.accept({ ...sent[0], results: Array.from({ length: 200 }, () => ({ sys_id: 'old' })) });
	loader.start(request);
	loader.accept({ ...sent[1], results: [{ sys_id: 'stale' }] });
	assert.equal(completed.length, 0);
	loader.accept({ ...sent[2], results: [{ sys_id: 'new' }] });
	assert.deepEqual(completed[0].results, [{ sys_id: 'new' }]);
	loader.accept({ ...sent[2], results: [{ sys_id: 'duplicate' }] });
	assert.equal(completed.length, 1);
});
