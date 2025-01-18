import * as vscode from 'vscode';

export interface AutoFixerConfig {
    maxAttempts: number;
    includePatterns: string[];
    excludePatterns: string[];
    validateFixes: boolean;
    showNotifications: boolean;
    timeoutSeconds: number;
    previewFixes: boolean;
    cacheDuration: number;
    batchSize: number;
    retryBaseDelay: number;
    retryMaxDelay: number;
    maxConcurrentFixes: number;
}

export class Settings {
    static get configuration(): AutoFixerConfig {
        const config = vscode.workspace.getConfiguration('copilotAutoFixer');
        return {
            maxAttempts: config.get('maxAttempts', 5),
            includePatterns: config.get('includePatterns', ['**/*']),
            excludePatterns: config.get('excludePatterns', ['node_modules/**']),
            validateFixes: config.get('validateFixes', true),
            showNotifications: config.get('showNotifications', true),
            timeoutSeconds: config.get('timeoutSeconds', 30),
            previewFixes: config.get('previewFixes', true),
            cacheDuration: config.get('cacheDuration', 1000 * 60 * 30), // 30 minutes
            batchSize: config.get('batchSize', 5),
            retryBaseDelay: config.get('retryBaseDelay', 1000),
            retryMaxDelay: config.get('retryMaxDelay', 10000),
            maxConcurrentFixes: config.get('maxConcurrentFixes', 3)
        };
    }
}
