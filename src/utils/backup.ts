import * as vscode from 'vscode';
import * as crypto from 'crypto';

export class FileBackupManager {
    private backups: Map<string, { content: string, timestamp: number }>;
    private readonly backupTTL = 1000 * 60 * 60; // 1 hour

    constructor() {
        this.backups = new Map();
    }

    async backup(document: vscode.TextDocument): Promise<string> {
        const key = this.createBackupKey(document);
        this.backups.set(key, {
            content: document.getText(),
            timestamp: Date.now()
        });
        return key;
    }

    async restore(document: vscode.TextDocument, backupKey: string): Promise<boolean> {
        const backup = this.backups.get(backupKey);
        if (!backup) return false;

        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0),
            backup.content
        );

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            this.backups.delete(backupKey);
        }
        return success;
    }

    private createBackupKey(document: vscode.TextDocument): string {
        return crypto
            .createHash('md5')
            .update(`${document.uri.toString()}-${Date.now()}`)
            .digest('hex');
    }

    cleanup(): void {
        const now = Date.now();
        for (const [key, backup] of Array.from(this.backups.entries())) {            if (now - backup.timestamp > this.backupTTL) {
                this.backups.delete(key);
            }
        }
    }

    dispose(): void {
        this.backups.clear();
    }
}