/** Collect all discovery pages before choosing tables or building scope.json. */
export class ScopeMetadataLoader {
	private nextId = 0;
	private pending = new Map<string, { id: number; offset: number; rows: any[] }>();

	constructor(
		private request: (message: any) => void,
		private complete: (message: any) => void,
		private pageSize = 200,
	) {}

	start(message: any) {
		const id = ++this.nextId;
		this.pending.set(message.filePath, { id, offset: 0, rows: [] });
		this.request({
			...message,
			scopeMetadataRequestId: id,
			pageOffset: 0,
			queryString: `${message.queryString}&sysparm_limit=${this.pageSize}&sysparm_offset=0`,
		});
	}

	accept(message: any) {
		const state = this.pending.get(message.filePath);
		if (!state || state.id !== message.scopeMetadataRequestId || state.offset !== message.pageOffset) return;
		if (!Array.isArray(message.results)) throw new Error('Scope metadata response did not contain records');
		for (const row of message.results) state.rows.push(row);

		if (message.results.length >= this.pageSize) {
			state.offset += this.pageSize;
			const next = { ...message, pageOffset: state.offset };
			delete next.results;
			delete next.type;
			next.queryString = message.queryString.replace(/sysparm_offset=\d+/, `sysparm_offset=${state.offset}`);
			this.request(next);
			return;
		}

		this.pending.delete(message.filePath);
		this.complete({ ...message, results: state.rows });
	}
}
