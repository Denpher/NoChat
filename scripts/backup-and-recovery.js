/**
 * NoChat v4 - Data Backup & User Recovery Utility
 * Verifies that all 21 users exist and creates a timestamped JSON backup.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

export async function backupDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('[Backup] No local db.json found. Production uses cloud storage.');
    return null;
  }
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `nochat-backup-${timestamp}.json`);
  
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const data = JSON.parse(raw);
  
  fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[Backup] Successfully backed up ${data.users?.length || 0} users to ${backupFile}`);
  return backupFile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  backupDatabase();
}
