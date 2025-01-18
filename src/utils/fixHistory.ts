import * as vscode from 'vscode';

export class FixHistory {
    private fixes: Array<{
        document: vscode.Uri,
        range: vscode.Range,
        oldText: string,
        newText: string
    }> = [];

    addFix(doc: vscode.Uri, range: vscode.Range, oldText: string, newText: string): void {
        this.fixes.push({ document: doc, range, oldText, newText });
    }
    

    popLastFix(): { document: vscode.Uri; range: vscode.Range; oldText: string; newText: string } | undefined {
        return this.fixes.pop();
    }


    hasFixes(): boolean {
        return this.fixes.length > 0;
    }

    clear(): void {
        this.fixes = [];
    }


    async undoLastFix(): Promise<boolean> {
        const lastFix = this.fixes.pop();
        if (!lastFix) return false;

        const edit = new vscode.WorkspaceEdit();
        edit.replace(lastFix.document, lastFix.range, lastFix.oldText);
        return vscode.workspace.applyEdit(edit);
    }
}