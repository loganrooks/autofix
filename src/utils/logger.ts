import * as vscode from 'vscode';
import { DisposableManager } from './disposableManager';

export class Logger {
    private static channel: vscode.OutputChannel;
    private static disposables = new DisposableManager();


    static init(): void {
        this.channel = vscode.window.createOutputChannel('Copilot AutoFixer');
    }

    static info(message: string): void {
        this.channel.appendLine(`[INFO] ${message}`);
    }

    static error(message: string, error?: Error): void {
        this.channel.appendLine(`[ERROR] ${message}`);
        if (error?.stack) {
            this.channel.appendLine(error.stack);
        }
    }

    static warn (message: string): void {
        this.channel.appendLine(`[WARN] ${message}`);
    }

    static dispose(): void {
        this.disposables.dispose();
    }
}
