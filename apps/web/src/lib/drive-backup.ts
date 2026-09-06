/**
 * Google Drive backup — stores the JSON finance backup in the app-private
 * `appDataFolder` (invisible to the user's other files, deleted with the app
 * authorisation). Uses Google Identity Services' token client in the browser,
 * so no refresh tokens or secrets ever touch our servers.
 *
 * Requires NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID (Web application client with
 * the site origin whitelisted) and the `drive.appdata` scope enabled.
 */
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const DRIVE_BACKUP_PREFIX = 'smartjib-backup-';

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}
interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
}

export function isDriveBackupConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID);
}

let gsiPromise: Promise<GoogleAccounts> | null = null;
function loadGsi(): Promise<GoogleAccounts> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const existing = (window as Window & { google?: GoogleAccounts }).google;
    if (existing?.accounts?.oauth2) return resolve(existing);
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => {
      const g = (window as Window & { google?: GoogleAccounts }).google;
      if (g?.accounts?.oauth2) resolve(g);
      else reject(new Error('gsi-unavailable'));
    };
    script.onerror = () => reject(new Error('gsi-load-failed'));
    document.head.appendChild(script);
  });
  gsiPromise.catch(() => { gsiPromise = null; });
  return gsiPromise;
}

/** Interactive: opens Google's consent popup and resolves an access token. */
export async function requestDriveToken(loginHint?: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('drive-not-configured');
  const google = await loadGsi();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error || 'drive-denied'));
      },
      error_callback: (error) => reject(new Error(error.type || 'drive-denied')),
    });
    client.requestAccessToken(loginHint ? { prompt: '' } : undefined);
  });
}

async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`drive-${res.status}`);
  return res;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: number;
}

export async function listDriveBackups(token: string): Promise<DriveBackupFile[]> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name contains '${DRIVE_BACKUP_PREFIX}' and trashed = false`,
    fields: 'files(id,name,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
    pageSize: '20',
  });
  const res = await driveFetch(token, `${API}/files?${params}`);
  const data = (await res.json()) as { files?: Array<DriveBackupFile & { size?: string }> };
  return (data.files || []).map((f) => ({ ...f, size: f.size ? Number(f.size) : undefined }));
}

/**
 * Uploads a backup as a new file (multipart). Keeps at most `keep` backups
 * per workspace so the app folder never grows without bound.
 */
export async function uploadDriveBackup(
  token: string,
  workspaceLabel: string,
  json: string,
  keep = 5,
): Promise<DriveBackupFile> {
  const name = `${DRIVE_BACKUP_PREFIX}${workspaceLabel}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const boundary = `smartjib${Date.now()}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
  const res = await driveFetch(token, `${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime,size`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const created = (await res.json()) as DriveBackupFile;

  const all = await listDriveBackups(token);
  const stale = all.filter((f) => f.name.startsWith(`${DRIVE_BACKUP_PREFIX}${workspaceLabel}-`)).slice(keep);
  await Promise.all(stale.map((f) => driveFetch(token, `${API}/files/${f.id}`, { method: 'DELETE' }).catch(() => undefined)));
  return created;
}

export async function downloadDriveBackup(token: string, fileId: string): Promise<string> {
  const res = await driveFetch(token, `${API}/files/${encodeURIComponent(fileId)}?alt=media`);
  return res.text();
}
