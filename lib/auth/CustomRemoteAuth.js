'use strict';

/* Require Optional Dependencies */
const fs = require('fs-extra');
const unzipper = require('unzipper');
const archiver = require('archiver');
const path = require('path');
const { Events } = require('../util/Constants');
const BaseAuthStrategy = require('./BaseAuthStrategy');

class CustomRemoteAuth extends BaseAuthStrategy {
    constructor({ clientId, dataPath, store, backupSyncIntervalMs } = {}) {
        if (!fs || !unzipper || !archiver) throw new Error('Optional Dependencies [fs-extra, unzipper, archiver] are required to use CustomRemoteAuth.');
        super();

        const idRegex = /^[-_\w]+$/i;
        if (clientId && !idRegex.test(clientId)) {
            throw new Error('Invalid clientId. Only alphanumeric characters, underscores, and hyphens are allowed.');
        }
        if (!backupSyncIntervalMs || backupSyncIntervalMs < 60000) {
            throw new Error('Invalid backupSyncIntervalMs. Accepts values starting from 60000ms {1 minute}.');
        }
        if (!store) throw new Error('Remote database store is required.');

        this.store = store;
        this.clientId = clientId;
        this.backupSyncIntervalMs = backupSyncIntervalMs;
        this.dataPath = path.resolve(dataPath || './.wwebjs_auth/');
        this.tempDir = path.join(this.dataPath, `wwebjs_temp_session_${this.clientId}`);
        this.requiredDirs = ['Default', 'IndexedDB', 'Local Storage'];
    }

    async beforeBrowserInitialized() {
        console.log('[CustomRemoteAuth] Initializing before browser setup...');
        const puppeteerOpts = this.client.options.puppeteer;
        const sessionDirName = this.clientId ? `CustomRemoteAuth-${this.clientId}` : 'CustomRemoteAuth';
        const dirPath = path.join(this.dataPath, sessionDirName);

        if (puppeteerOpts.userDataDir && puppeteerOpts.userDataDir !== dirPath) {
            throw new Error('CustomRemoteAuth is not compatible with a user-supplied userDataDir.');
        }

        this.userDataDir = dirPath;
        this.sessionName = sessionDirName;

        console.log('[CustomRemoteAuth] Extracting remote session if available...');
        await this.extractRemoteSession();

        this.client.options.puppeteer = {
            ...puppeteerOpts,
            userDataDir: dirPath,
        };
        console.log('[CustomRemoteAuth] Browser initialization setup complete.');
    }

    async afterAuthReady() {
        console.log('[CustomRemoteAuth] Authentication complete. Checking for existing session...');
        const sessionExists = await this.store.sessionExists({ session: this.sessionName });
        if (!sessionExists) {
            console.log('[CustomRemoteAuth] No existing session found. Waiting for session to stabilize before backup...');
            await this.delay(60000); // Initial delay sync required for session to be stable enough to recover
            await this.storeRemoteSession({ emit: true });
        } else {
            console.log('[CustomRemoteAuth] Session already exists. Skipping initial backup.');
        }

        console.log(`[CustomRemoteAuth] Starting periodic backup every ${this.backupSyncIntervalMs}ms...`);
        this.backupSync = setInterval(async () => {
            console.log('[CustomRemoteAuth] Performing scheduled session backup...');
            await this.storeRemoteSession();
        }, this.backupSyncIntervalMs);
    }

    async storeRemoteSession(options) {
        console.log('[CustomRemoteAuth] Starting session storage process...');
        const pathExists = await this.isValidPath(this.userDataDir);
        if (pathExists) {
            console.log('[CustomRemoteAuth] Compressing session files...');
            await this.compressSession();
            console.log('[CustomRemoteAuth] Saving compressed session to remote store...');
            await this.store.save({ session: this.sessionName });
            console.log('[CustomRemoteAuth] Session stored successfully.');
            await fs.promises.unlink(`${this.sessionName}.zip`);
            await fs.promises.rm(this.tempDir, {
                recursive: true,
                force: true,
            }).catch(() => console.error('[CustomRemoteAuth] Error cleaning up temporary files.'));
            if (options && options.emit) this.client.emit(Events.REMOTE_SESSION_SAVED);
            console.log('[CustomRemoteAuth] Session storage process complete.');
        } else {
            console.log('[CustomRemoteAuth] No valid session path found. Skipping session storage.');
        }
    }

    async extractRemoteSession() {
        console.log('[CustomRemoteAuth] Checking if session extraction is necessary...');
        const pathExists = await this.isValidPath(this.userDataDir);
        const compressedSessionPath = `${this.sessionName}.zip`;
        const sessionExists = await this.store.sessionExists({ session: this.sessionName });

        if (pathExists) {
            console.log('[CustomRemoteAuth] Clearing existing session data...');
            await fs.promises.rm(this.userDataDir, {
                recursive: true,
                force: true,
            }).catch(() => console.error('[CustomRemoteAuth] Error clearing existing session data.'));
        }

        if (sessionExists) {
            console.log('[CustomRemoteAuth] Extracting session from remote store...');
            await this.store.extract({ session: this.sessionName, path: compressedSessionPath });
            await this.unCompressSession(compressedSessionPath);
            console.log('[CustomRemoteAuth] Session extraction and decompression complete.');
        } else {
            console.log('[CustomRemoteAuth] No remote session found. Creating new session directory.');
            fs.mkdirSync(this.userDataDir, { recursive: true });
        }
    }

    async deleteRemoteSession() {
        console.log('[CustomRemoteAuth] Attempting to delete session from remote store...');
        const sessionExists = await this.store.sessionExists({ session: this.sessionName });
        if (sessionExists) {
            await this.store.delete({ session: this.sessionName });
            console.log('[CustomRemoteAuth] Session deleted successfully from remote store.');
        } else {
            console.log('[CustomRemoteAuth] No session found to delete in remote store.');
        }
    }

    async compressSession() {
        console.log('[CustomRemoteAuth] Starting compression of session data...');
        const archive = archiver('zip');
        const stream = fs.createWriteStream(`${this.sessionName}.zip`);

        await fs.copy(this.userDataDir, this.tempDir).catch((err) => console.error('[CustomRemoteAuth] Error copying session files:', err));
        await this.deleteMetadata(); // Delete unnecessary files

        return new Promise((resolve, reject) => {
            archive
                .directory(this.tempDir, false)
                .on('error', (err) => reject(err))
                .pipe(stream);

            stream.on('close', () => {
                console.log('[CustomRemoteAuth] Compression complete.');
                resolve();
            });
            archive.finalize();
        });
    }

    async unCompressSession(compressedSessionPath) {
        console.log('[CustomRemoteAuth] Starting decompression of session data...');
        const stream = fs.createReadStream(compressedSessionPath);
        return new Promise((resolve, reject) => {
            stream
                .pipe(unzipper.Extract({ path: this.userDataDir }))
                .on('error', (err) => {
                    console.error('[CustomRemoteAuth] Error during decompression:', err);
                    reject(err);
                })
                .on('finish', () => {
                    console.log('[CustomRemoteAuth] Decompression complete.');
                    resolve();
                });
        }).finally(async () => {
            console.log('[CustomRemoteAuth] Cleaning up compressed session file...');
            await fs.promises.unlink(compressedSessionPath).catch(() => console.error('[CustomRemoteAuth] Error deleting compressed session file.'));
        });
    }

    async deleteMetadata() {
        console.log('[CustomRemoteAuth] Cleaning up unnecessary session metadata...');
        const sessionDirs = [this.tempDir, path.join(this.tempDir, 'Default')];
        for (const dir of sessionDirs) {
            const sessionFiles = await fs.promises.readdir(dir);
            for (const element of sessionFiles) {
                if (!this.requiredDirs.includes(element)) {
                    const dirElement = path.join(dir, element);
                    const stats = await fs.promises.lstat(dirElement);

                    if (stats.isDirectory()) {
                        await fs.promises.rm(dirElement, {
                            recursive: true,
                            force: true,
                        }).catch(() => console.error('[CustomRemoteAuth] Error deleting directory during metadata cleanup.'));
                    } else {
                        await fs.promises.unlink(dirElement).catch(() => console.error('[CustomRemoteAuth] Error deleting file during metadata cleanup.'));
                    }
                }
            }
        }
        console.log('[CustomRemoteAuth] Metadata cleanup complete.');
    }

    async isValidPath(path) {
        try {
            await fs.promises.access(path);
            return true;
        } catch {
            console.log('[CustomRemoteAuth] Path is not valid:', path);
            return false;
        }
    }

    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

module.exports = CustomRemoteAuth;
