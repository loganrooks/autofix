import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DisposableManager } from './disposableManager';

export class Logger {
    private static instance: Logger | undefined;
    private channel: vscode.OutputChannel | undefined;
    private disposables: DisposableManager;
    private logFile: string | undefined;
    private readonly MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
    private initialized = false;

    private constructor() {
        this.disposables = new DisposableManager();
    }

    public static getInstance(): Logger {
        if (!Logger.instance || Logger.instance.isDisposed) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private getLogDirectory(): string {
        // Try workspace folder first
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            // Save logs in a persistent .logs directory in the workspace
            return path.join(workspaceFolder, '.logs');
        }

        // If no workspace, save to user's home directory instead of temp
        return path.join(
            os.homedir(), // Use home directory instead of tmpdir
            '.vscode-copilot-autofixer-logs',
            `session-${new Date().toISOString().replace(/[:.]/g, '-')}`
        );
    }

    public init(): void {
        if (this.initialized) {
            console.debug('Logger already initialized');
            return;
        }

        try {
            // Create output channel
            this.channel = vscode.window.createOutputChannel('Copilot AutoFixer');
            this.disposables.add(this.channel);
            console.debug('Created output channel');

            // Setup log directory
            const logDir = this.getLogDirectory();
            try {
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true, mode: 0o755 });
                    console.debug(`Created log directory: ${logDir}`);
                }

                this.logFile = path.join(logDir, 'copilot-autofixer.log');
                // Verify we can write to the log file
                fs.writeFileSync(this.logFile, '', { flag: 'a' });
                console.debug(`Initialized log file: ${this.logFile}`);

            } catch (error) {
                const errorMsg = `Failed to setup log directory: ${error instanceof Error ? error.message : String(error)}`;
                console.error(errorMsg);
                this.channel?.appendLine(errorMsg);
                // Continue without file logging
                this.logFile = undefined;
            }

            this.initialized = true;
            this.channel?.appendLine('Logger initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize logger:', error);
            throw error;
        }
    }

    private async writeToLogFile(message: string): Promise<void> {
        if (!this.logFile) {
            console.debug('No log file configured');
            return;
        }

        try {
            // Check file size and rotate if needed
            try {
                const stats = await fs.promises.stat(this.logFile);
                if (stats.size > this.MAX_LOG_SIZE) {
                    const backupFile = `${this.logFile}.old`;
                    if (fs.existsSync(backupFile)) {
                        await fs.promises.unlink(backupFile);
                    }
                    await fs.promises.rename(this.logFile, backupFile);
                    console.debug('Rotated log file');
                }
            } catch (err) {
                console.debug('Log file does not exist yet');
            }

            // Append message with timestamp
            const timestamp = new Date().toISOString();
            await fs.promises.appendFile(this.logFile, `${timestamp} ${message}\n`);
            console.debug('Wrote to log file');
        } catch (err) {
            console.error('Failed to write to log file:', err);
            this.channel?.appendLine(`Failed to write to log file: ${err}`);
            throw err;
        }
    }

    public async log(level: 'INFO' | 'ERROR' | 'WARN', message: string): Promise<void> {
        if (!this.initialized) {
            this.init();
        }

        const formattedMessage = `[${level}] ${message}`;
        this.channel?.appendLine(formattedMessage);

        // For errors, ensure we write to a persistent location
        if (level === 'ERROR') {
            // If we're using temp directory, switch to persistent storage
            if (this.logFile?.includes(os.tmpdir())) {
                const persistentDir = path.join(
                    os.homedir(),
                    '.vscode-copilot-autofixer-logs'
                );
                fs.mkdirSync(persistentDir, { recursive: true });
                this.logFile = path.join(persistentDir, 'error.log');
            }
        }

        await this.writeToLogFile(formattedMessage).catch(error => {
            console.error('Failed to write log:', error);
            this.channel?.appendLine(`Failed to write log: ${error}`);
        });
    }


    public dispose(): void {
        if (!this.initialized) return;
        
        // Only cleanup temp logs, preserve error logs
        if (this.logFile?.includes(os.tmpdir()) && !this.logFile.includes('error.log')) {
            try {
                fs.rmdirSync(path.dirname(this.logFile), { recursive: true });
            } catch (error) {
                console.error('Failed to cleanup temp logs:', error);
            }
        }

        this.disposables.dispose();
        this.channel = undefined;
        this.initialized = false;
    }

    get isDisposed(): boolean {
        return !this.initialized;
    }

    // Convenience methods
    public static async info(message: string): Promise<void> {
        await Logger.getInstance().log('INFO', message);
    }

    public static async error(message: string): Promise<void> {
        await Logger.getInstance().log('ERROR', message);
    }

    public static async warn(message: string): Promise<void> {
        await Logger.getInstance().log('WARN', message);
    }

    public static dispose(): void {
        Logger.instance?.dispose();
        Logger.instance = undefined;
    }
}