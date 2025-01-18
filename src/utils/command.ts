import * as vscode from 'vscode';

export interface CommandResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export class CommandExecutor {
    private readonly defaultTimeout = 10000;

    async execute<T>(
        command: string,
        args?: any[],
        timeout: number = this.defaultTimeout
    ): Promise<CommandResult<T>> {
        try {
            const result = await Promise.race([
                vscode.commands.executeCommand(command, ...(args || [])),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Command timed out')), timeout)
                )
            ]);

            return {
                success: true,
                data: result as T
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    dispose(): void {
        // No cleanup needed
    }
}