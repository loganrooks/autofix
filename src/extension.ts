import * as vscode from 'vscode';
import { CopilotAutoFixer } from './copilotAutoFixer';

export function activate(context: vscode.ExtensionContext) {
    const autoFixer = new CopilotAutoFixer();
    
    context.subscriptions.push(
        vscode.commands.registerCommand('copilot-autofixer.start', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            
            try {
                await autoFixer.attemptFix(editor);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to fix: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

        vscode.commands.registerCommand('copilot-autofixer.undo', async () => {
            try {
                await autoFixer.undo();
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to undo: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

        vscode.commands.registerCommand('copilot-autofixer.fixAll', async () => {
            try {
                const documents = Array.from(vscode.workspace.textDocuments);
                await autoFixer.fixMultiple(documents);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to fix all: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }),

        // Register the autoFixer for disposal
        autoFixer
    );
}

export function deactivate() {}