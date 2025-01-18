import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileBackupManager } from './utils/backup';
import { CommandExecutor } from './utils/command';
import { FixHistory } from './utils/fixHistory';
import { FixValidator } from './utils/fixValidator';
import { TelemetryReporter } from './utils/telemetry';
import { ErrorClassifier, ErrorType } from './utils/errorClassifier';
import { ProgressHandler } from './ui/progressHandler';
import { Logger } from './utils/logger';
import { Settings } from './config/settings';
import { FixCache } from './utils/fixCache';
import { RetryStrategy } from './utils/retryStrategy';
import { BatchProcessor } from './utils/batchProcessor';
import { WorkspaceTrustError } from './errors';

/**
 * Main class responsible for fixing code issues using GitHub Copilot
 */
export class CopilotAutoFixer {
    // Core services
    private readonly cache: FixCache;
    private readonly retryStrategy: RetryStrategy;
    private readonly validator: FixValidator;
    private readonly errorClassifier: ErrorClassifier;
    private readonly backupManager: FileBackupManager;
    private readonly telemetry: TelemetryReporter;
    private readonly fixHistory: FixHistory;
    private readonly batchProcessor: BatchProcessor<vscode.TextDocument>;

    // UI components
    private readonly statusBarItem: vscode.StatusBarItem;
    private isFixing: boolean = false;

    // Configuration
    private readonly config: Settings;

    constructor() {
        // Initialize core services
        this.cache = new FixCache();
        this.retryStrategy = new RetryStrategy();
        this.validator = new FixValidator();
        this.errorClassifier = new ErrorClassifier();
        this.backupManager = new FileBackupManager();
        this.telemetry = new TelemetryReporter();
        this.fixHistory = new FixHistory();
        
        // Load configuration
        this.config = Settings.configuration;
        
        // Initialize batch processor with unified pipeline
        this.batchProcessor = new BatchProcessor<vscode.TextDocument>(
            Settings.configuration.batchSize || 5,
            async (document) => {
                await this.fixDocument(document);
            }
        );

        // Initialize UI
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBarItem.text = "$(copilot) AutoFixer";
        this.statusBarItem.show();

        // Register undo command
        const undoCommand = vscode.commands.registerCommand('copilotAutoFixer.undo', () => {
            this.undo().catch(error => {
                vscode.window.showErrorMessage(`Failed to undo: ${error.message}`);
            });
        });
    }

    

    /**
     * Attempts to fix code issues in the given editor
     * @param editor The active text editor
     * @throws {WorkspaceTrustError} If workspace is not trusted
     * @throws {ValidationError} If fix validation fails
     */
   
    private async requestCopilotFix(error: Error, errorType: ErrorType): Promise<string> {
        if (!error?.message) {
            throw new Error('Invalid error object provided');
        }
    
        const prompt = this.buildPrompt(error, errorType);
        
        try {
            const suggestions = await vscode.commands.executeCommand(
                'github.copilot.generate',
                { prompt }
            ) as string[];
    
            if (!suggestions?.length) {
                throw new Error('No suggestions received from Copilot');
            }
    
            return suggestions[0];
        } catch (error) {
            Logger.error('Copilot API error', error instanceof Error ? error : new Error(String(error)));
            throw new Error('Failed to get fix from Copilot');
        }
    }
    
    // processFix remains unchanged since it's already correctly:
    // 1. Classifying the error
    // 2. Passing both error and errorType to requestCopilotFix
    
    private buildPrompt(error: Error, errorType: ErrorType): string {
        return [
            `// Fix the following code that has a ${ErrorType[errorType]} error:`,
            `// Error: ${error.message}`,
            `// Original code:`,
            error.stack?.split('\n')[1] || '',
            `// Fixed code:`
        ].join('\n');
    }
    
    // Remove the second implementation entirely

    private async tryApplyFix(
        document: vscode.TextDocument,
        range: vscode.Range,
        fix: string
    ): Promise<boolean> {
        if (!await this.validator.validateFix(document.getText(range), fix)) {
            return false;
        }
    
        if (await this.previewAndApplyFix(fix, document, range)) {
            this.telemetry.trackEvent('fix_applied', { success: true });
            return true;
        }
    
        return false;
    }

    private async handleFixError(error: Error, document: vscode.TextDocument): Promise<void> {
        Logger.error('Fix failed', error);
        await this.backupManager.backup(document);
        this.updateStatus('Fix failed: ' + error.message);
        throw error;
    }

    private async previewAndApplyFix(
        fix: string, 
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<boolean> {
        if (!Settings.configuration.previewFixes) {
            return true;
        }
    
        // Create decoration type for the fix preview
        const decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: `\n// Proposed fix:\n${fix}`,
                color: new vscode.ThemeColor('editorLineNumber.foreground'),
                margin: '0 0 0 3em',
            },
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
        });
    
        let previewEditor: vscode.TextEditor | undefined;
        
        try {
            // Show document in preview
            previewEditor = await vscode.window.showTextDocument(document, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside,
                selection: range
            });
    
            // Add fix preview decoration
            previewEditor.setDecorations(decorationType, [range]);
    
            // Show confirmation dialog
            const result = await vscode.window.showInformationMessage(
                'Apply this fix?',
                { modal: true },
                'Apply',
                'Skip',
                'Stop'
            );
    
            return result === 'Apply';
        } finally {
            // Cleanup
            decorationType.dispose();
            if (previewEditor) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        }
    }

    async undo(): Promise<void> {
        const lastFix = this.fixHistory.popLastFix();
        if (!lastFix) {
            this.updateStatus('No fixes to undo');
            return;
        }

        try {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(lastFix.document, lastFix.range, lastFix.oldText);
            
            if (await vscode.workspace.applyEdit(edit)) {
                this.telemetry.trackEvent('fix_undone', { success: true });
                this.updateStatus('Fix undone successfully');
            } else {
                throw new Error('Failed to apply undo');
            }
        } catch (error) {
            Logger.error('Undo failed', error instanceof Error ? error : new Error(String(error)));
            this.telemetry.trackEvent('fix_undone', { success: false });
            this.updateStatus('Failed to undo fix');
            throw error;
        }
    }

    private updateUndoStatus(): void {
        if (this.fixHistory.hasFixes()) {
            this.statusBarItem.text = "$(arrow-left) Undo Copilot Fix";
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }

    private async getActiveDocument(): Promise<vscode.TextDocument> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor');
        }
        return editor.document;
    }

    private createProgressBar(): vscode.StatusBarItem {
        const progressBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        progressBar.text = '$(tools) Copilot AutoFixer: Running...';
        progressBar.show();
        return progressBar;
    }

    private updateStatus(message: string): void {
        this.statusBarItem.text = `$(tools) Copilot AutoFixer: ${message}`;
        this.statusBarItem.show();
    }


    async fixMultiple(documents: vscode.TextDocument[]): Promise<void> {
        if (!vscode.workspace.isTrusted) {
            throw new WorkspaceTrustError();
        }
    
        await this.batchProcessor.processDocuments(documents, async (doc) => {
            await this.fixDocument(doc);
        });
    }

    async attemptFix(editor: vscode.TextEditor): Promise<void> {
        if (!vscode.workspace.isTrusted) {
            throw new WorkspaceTrustError();
        }
        await this.fixDocument(editor.document);
    }

    private async fixDocument(document: vscode.TextDocument): Promise<void> {
        if (this.isFixing) return;
        this.isFixing = true;
        
        try {
            const diagnostics = vscode.languages.getDiagnostics(document.uri);
            if (diagnostics.length === 0) return;

            const backupKey = await this.backupManager.backup(document);
            
            try {
                await ProgressHandler.withProgress(
                    'Fixing issues',
                    async (progress) => {
                        for (const diagnostic of diagnostics) {
                            progress.report({
                                increment: 100 / diagnostics.length,
                                message: `Fixing: ${diagnostic.message}`
                            });

                            if (await this.processFix(document, diagnostic)) {
                                return;
                            }
                        }
                    }
                );
            } catch (error) {
                await this.backupManager.restore(document, backupKey);
                throw error;
            }
        } finally {
            this.isFixing = false;
        }
    }

    private async applyFix(
        document: vscode.TextDocument, 
        range: vscode.Range, 
        fix: string
    ): Promise<boolean> {
        // Create backup
        const backupKey = await this.backupManager.backup(document);
        
        try {
            // Apply fix
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, range, fix);
            
            if (await vscode.workspace.applyEdit(edit)) {
                // Track fix
                this.fixHistory.addFix(document.uri, range, document.getText(range), fix);
                this.telemetry.trackEvent('fix_applied', { success: true });
                return true;
            }
            return false;
        } catch (error) {
            // Restore backup on failure
            await this.backupManager.restore(document, backupKey);
            throw error;
        }
    }

    private async processFix(
        document: vscode.TextDocument, 
        diagnostic: vscode.Diagnostic
    ): Promise<boolean> {
        const error = new Error(diagnostic.message);
        const errorType = this.errorClassifier.classify(error.message);
        
        // Check cache
        const cachedFix = this.cache.get(error.message, error.stack || '');
        if (cachedFix?.success) {
            return this.applyFix(document, diagnostic.range, cachedFix.fix);
        }
    
        // Get and validate fix
        try {
            const fix = await this.retryStrategy.retry(
                async () => this.requestCopilotFix(error, errorType), // Pass errorType to provide context
                Settings.configuration.maxAttempts // Use Settings instead of this.config
            );
    
            if (!await this.validator.validateFix(
                document.getText(diagnostic.range), 
                fix
            )) {
                return false;
            }
    
            // Preview if enabled
            if (Settings.configuration.previewFixes && // Use Settings instead of this.config
                !await this.previewAndApplyFix(fix, document, diagnostic.range)) {
                return false;
            }
    
            // Apply fix
            return this.applyFix(document, diagnostic.range, fix);
        } catch (error: unknown) { // Add type annotation
            Logger.error('Fix failed', error instanceof Error ? error : new Error(String(error)));
            return false;
        }
    }
    
    dispose(): void {
        // Only dispose items implementing vscode.Disposable
        this.statusBarItem.dispose();
        this.backupManager.dispose();
        this.telemetry.dispose();
        
        // Clean up processors and handlers
        this.batchProcessor.clear();
        Logger.dispose();
        
        // Reset state
        this.isFixing = false;
    }
}