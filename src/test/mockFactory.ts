import * as vscode from 'vscode';

export interface MockTextEditor extends Omit<vscode.TextEditor, 'document'> {
    document: vscode.TextDocument;  // Remove readonly
}


export class MockFactory {
    createDocument(options?: Partial<vscode.TextDocument>): vscode.TextDocument {
        return {
            uri: vscode.Uri.parse('file:///test/file.ts'),
            fileName: '/test/file.ts',
            getText: () => 'test code',
            lineCount: 1,
            languageId: 'typescript',
            version: 1,
            isDirty: false,
            isClosed: false,
            save: () => Promise.resolve(true),
            eol: vscode.EndOfLine.LF,
            lineAt: () => ({
                lineNumber: 0,
                text: 'test code',
                range: new vscode.Range(0, 0, 0, 9),
                rangeIncludingLineBreak: new vscode.Range(0, 0, 0, 10),
                firstNonWhitespaceCharacterIndex: 0,
                isEmptyOrWhitespace: false
            }),
            offsetAt: () => 0,
            positionAt: () => new vscode.Position(0, 0),
            getWordRangeAtPosition: () => undefined,
            validateRange: (range) => range,
            validatePosition: (position) => position,
            ...options
        } as vscode.TextDocument;
    }

    createEditor(options?: Partial<vscode.TextEditor>): vscode.TextEditor {
        const document = options?.document || this.createDocument();
        return {
            document,
            selection: new vscode.Selection(0, 0, 0, 0),
            selections: [new vscode.Selection(0, 0, 0, 0)],
            visibleRanges: [new vscode.Range(0, 0, 10, 0)],
            options: {
                tabSize: 4,
                insertSpaces: true,
                cursorStyle: vscode.TextEditorCursorStyle.Line,
                lineNumbers: vscode.TextEditorLineNumbersStyle.On
            },
            viewColumn: vscode.ViewColumn.One,
            edit: () => Promise.resolve(true),
            setDecorations: () => {},
            revealRange: () => {},
            show: () => {},
            hide: () => {},
            ...options
        } as vscode.TextEditor;
    }
}