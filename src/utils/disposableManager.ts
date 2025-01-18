import * as vscode from 'vscode';

export class DisposableManager {
    private disposables: vscode.Disposable[] = [];

    public add(disposable: vscode.Disposable): void {
        this.disposables.push(disposable);
    }

    public dispose(): void {
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                try {
                    disposable.dispose();
                } catch (err) {
                    console.error('Error disposing:', err);
                }
            }
        }
    }
}