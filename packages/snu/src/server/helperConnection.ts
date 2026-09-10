// Mirrored in packages/snu/src/server/helperConnection.ts for the standalone build.
interface HelperSocket {
	readyState: number;
	on(event: string, listener: () => void): unknown;
	off(event: string, listener: () => void): unknown;
	ping(): void;
	terminate(): void;
	send(payload: string): void;
}

/** One helper owns the session. Old sockets cannot clear a replacement's state. */
export class HelperConnection<T extends HelperSocket> {
	current?: T;
	private cleanup?: () => void;

	constructor(private disconnected: () => void, private heartbeatMs = 30_000) {}

	get connected(): boolean { return this.current?.readyState === 1; }
	isActive(socket: T): boolean { return this.current === socket; }

	accept(socket: T): void {
		if (this.isActive(socket)) return;
		// Reject old requests and forget old permissions before accepting the new session.
		this.stop();
		this.current = socket;
		let alive = true;
		const pong = () => { alive = true; };
		const closed = () => {
			if (!this.isActive(socket)) return;
			this.cleanup?.();
			this.cleanup = undefined;
			this.current = undefined;
			this.disconnected();
		};
		const timer = setInterval(() => {
			if (!this.isActive(socket)) return;
			if (!alive || !this.connected) { this.stop(); return; }
			alive = false;
			try { socket.ping(); } catch { this.stop(); }
		}, this.heartbeatMs);
		timer.unref();
		socket.on('pong', pong);
		socket.on('close', closed);
		this.cleanup = () => {
			clearInterval(timer);
			socket.off('pong', pong);
			socket.off('close', closed);
		};
	}

	send(payload: string): void {
		if (this.connected) this.current!.send(payload);
	}

	stop(): void {
		const socket = this.current;
		this.cleanup?.();
		this.cleanup = undefined;
		this.current = undefined;
		if (!socket) return;
		this.disconnected();
		try { socket.terminate(); } catch { /* already closed */ }
	}
}
