// Scope a helper-tab error to the instance folder it came from.
//
// The helper tab tags non-agent error replies with `errorInstance: { name, url }`.
// When that tag is present, only the matching workspace folder receives
// `_last_error.json` and only its pending Agent API calls are rejected. When it
// is absent (helper builds that predate the tag), every instance folder is
// treated as a match, which is the pre-4.9.3 behaviour.

export interface ErrorInstanceRef {
	name?: string;
	url?: string;
}

export function readErrorInstance(message: any): ErrorInstanceRef | undefined {
	const ref = message?.errorInstance;
	if (!ref || typeof ref !== 'object') return undefined;
	const name = typeof ref.name === 'string' ? ref.name.trim() : '';
	const url = typeof ref.url === 'string' ? ref.url.trim() : '';
	if (!name && !url) return undefined;
	return { name, url };
}

function originOf(url: string | undefined): string | null {
	if (!url) return null;
	try { return new URL(url).origin.toLowerCase(); } catch { return null; }
}

/**
 * Does the workspace folder `folderName` (whose settings file declares
 * `settingsUrl`) belong to the instance that reported the error?
 */
export function instanceFolderMatchesError(
	folderName: string,
	settingsUrl: string | undefined,
	errorInstance: ErrorInstanceRef | undefined,
): boolean {
	if (!errorInstance) return true;
	if (errorInstance.name && folderName === errorInstance.name) return true;
	const errorOrigin = originOf(errorInstance.url);
	const folderOrigin = originOf(settingsUrl);
	return !!errorOrigin && !!folderOrigin && errorOrigin === folderOrigin;
}
