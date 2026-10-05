import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

const saEmail = process.env.GOOGLE_SA_EMAIL;
const saPrivateKey = process.env.GOOGLE_SA_PRIVATE_KEY;
const folderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID;

if (!saEmail || !saPrivateKey || !folderId) {
  throw new Error('Google Drive credentials tidak lengkap di environment');
}

const auth = new JWT({
  email: saEmail,
  key: saPrivateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive: drive_v3.Drive = google.drive({ version: 'v3', auth });

/**
 * Upload file ke Google Drive.
 * Folder: checklist-shift-archive/{branch_code}/
 * Nama: {branch_name}-{shift_date}-{shift_name}-{branch_id}-{ulid}.pdf
 */
export async function uploadFileToDrive(
  folderId: string,
  name: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ id: string; url: string }> {
  const fileMetadata = {
    name,
    parents: [folderId],
  };

  const media = {
    mimeType,
    body: buffer,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webViewLink',
  });

  const fileId = response.data.id!;
  const url = response.data.webViewLink!;

  // Set permission: anyone with link can view
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return { id: fileId, url };
}

/**
 * Buat folder di Google Drive (jika belum ada).
 */
export async function createDriveFolder(
  name: string,
  parentFolderId?: string
): Promise<string> {
  const fileMetadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: parentFolderId ? [parentFolderId] : undefined,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  return response.data.id!;
}

/**
 * Cari folder by name di dalam parent folder.
 */
export async function findFolderByName(
  name: string,
  parentFolderId?: string
): Promise<string | null> {
  const query = parentFolderId
    ? `name='${name}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  return response.data.files?.[0]?.id ?? null;
}
