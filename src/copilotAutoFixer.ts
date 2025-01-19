import * as vscode from 'vscode';
import { FileBackupManager } from './utils/backup';
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
import { DisposableManager } from './utils/disposableManager';
import { FixDecision } from './types/enums';

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
    private readonly disposables: DisposableManager;
    

    // UI components
    private readonly statusBarItem: vscode.StatusBarItem;
    private isFixing: boolean = false;


    constructor() {
        // Initialize core services
        this.cache = new FixCache();
        this.retryStrategy = new RetryStrategy();
        this.validator = new FixValidator();
        this.errorClassifier = new ErrorClassifier();
        this.fixHistory = new FixHistory();
        this.disposables = new DisposableManager();
        this.backupManager = new FileBackupManager();
        this.telemetry = new TelemetryReporter();

        // Initialize UI
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        this.statusBarItem.text = "$(copilot) AutoFixer";
        this.statusBarItem.show();
        this.disposables.add(this.statusBarItem);

        // Initialize batch processor
        this.batchProcessor = new BatchProcessor<vscode.TextDocument>(
            Settings.configuration.batchSize || 5,
            async (document) => {
                await this.fixDocument(document);
            }
        );

        // Register commands
        this.disposables.add(
            vscode.commands.registerCommand('copilotAutoFixer.fix', this.attemptFix.bind(this))
        );
        this.disposables.add(
            vscode.commands.registerCommand('copilotAutoFixer.undo', this.undo.bind(this))
        );
        
        this.disposables.add(this.backupManager);
        this.disposables.add(this.telemetry);
    }

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
            const errorMsg = `Copilot API error: ${error instanceof Error ? error.message : String(error)}`;
            Logger.error(errorMsg);
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

    private async previewAndApplyFix(
        fix: string, 
        document: vscode.TextDocument,
        range: vscode.Range
    ): Promise<FixDecision> {
        if (!Settings.configuration.previewFixes) {
            return FixDecision.Apply;
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
        this.disposables.add(decorationType); // Track decoration for disposal

    
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
                FixDecision.Apply,
                FixDecision.Skip,
                FixDecision.Stop
            ) as FixDecision || FixDecision.Skip;
            
            return result;
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
            const errorMessage = `Undo failed: ${error instanceof Error ? error.message : String(error)}`;
            Logger.error(errorMessage);
            this.telemetry.trackEvent('fix_undone', { success: false });
            this.updateStatus('Failed to undo fix');
            throw error;
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
        } catch (error) {
            Logger.error(`Failed to fix document: ${error instanceof Error ? error.message : String(error)}`);
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
        
        // Check cache first
        const cachedFix = this.cache.get(error.message, error.stack || '');
        if (cachedFix?.success) {
            return this.applyFix(document, diagnostic.range, cachedFix.fix);
        }

        try {
            const fix = await this.retryStrategy.retry(
                async () => this.requestCopilotFix(error, errorType),
                Settings.configuration.maxAttempts
            );

            if (!await this.validator.validateFix(document.getText(diagnostic.range), fix)) {
                return false;
            }

            if (Settings.configuration.previewFixes) {
                const decision = await this.previewAndApplyFix(fix, document, diagnostic.range);
                
                switch (decision) {
                    case FixDecision.Apply:
                        return this.applyFix(document, diagnostic.range, fix);
                    case FixDecision.Stop:
                        this.batchProcessor.clear(); // Clear the queue
                        return false;
                    case FixDecision.Skip:
                    default:
                        return false;
                }
            }

            return this.applyFix(document, diagnostic.range, fix);
            
        } catch (error: unknown) {
            const errorMessage = `Fix failed: ${error instanceof Error ? error.message : String(error)}`;
            Logger.error(errorMessage);
            return false;
        }
    }

    dispose(): void {
        // Only dispose items implementing vscode.Disposable
        this.disposables.dispose();

        // Clean up processors and handlers
        this.batchProcessor.clear();
        
        // Reset state
        this.isFixing = false;
    }
}