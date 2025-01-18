import { EventEmitter } from 'events';

export class MockTextDocument {
    uri: any;
    fileName: string;
    lineCount: number;
    private content: string;

    constructor(content: string = '', fileName: string = 'test.ts') {
        this.content = content;
        this.fileName = fileName;
        this.lineCount = content.split('\n').length;
        this.uri = {
            fsPath: `/test/${fileName}`,
            scheme: 'file'
        };
    }

    getText(range?: Range): string {
        if (!range) return this.content;
        // Simple range implementation
        const lines = this.content.split('\n');
        return lines.slice(range.start.line, range.end.line + 1).join('\n');
    }
}

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    constructor(
        public readonly start: Position,
        public readonly end: Position
    ) {}

    static fromPositions(start: number, end: number): Range {
        return new Range(new Position(0, start), new Position(0, end));
    }
}

export class Selection extends Range {
    constructor(start: Position, end: Position) {
        super(start, end);
    }
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2
}

export class MockStatusBarItem {
    public text: string = '';
    public tooltip?: string;
    public command?: string;
    private visible: boolean = false;

    constructor(public alignment: StatusBarAlignment) {}

    show(): void {
        this.visible = true;
    }

    hide(): void {
        this.visible = false;
    }

    dispose(): void {}
}

export const window = {
    createStatusBarItem: (_alignment?: StatusBarAlignment) => 
        new MockStatusBarItem(_alignment || StatusBarAlignment.Left),
    showTextDocument: async (doc: MockTextDocument) => ({
        document: doc,
        selection: new Selection(new Position(0, 0), new Position(0, 0))
    }),
    // Fix: Use rest operator with underscore prefix for unused params
    showInformationMessage: async (_message: string, ..._items: string[]) => _items[0],
    showErrorMessage: async (_message: string) => {},
    withProgress: async <T>(_options: any, task: (progress: any) => Promise<T>): Promise<T> => {
        return task({
            report: (_progress: any) => {}
        });
    }
};

export const workspace = {
    isTrusted: true,
    getConfiguration: () => ({
        get: (_key: string) => true
    }),
    applyEdit: async (_edit: WorkspaceEdit) => true,
    openTextDocument: async (_uri: any) => new MockTextDocument()
};

export const languages = {
    getDiagnostics: (_uri: any) => []
};

export const commands = {
    registerCommand: (_id: string, _callback: (...args: any[]) => any) => ({
        dispose: () => {}
    }),
    executeCommand: async (_command: string, ..._args: any[]) => {}
};

export class WorkspaceEdit {
    private edits: Array<{uri: any; range: Range; newText: string}> = [];

    replace(uri: any, range: Range, newText: string): void {
        this.edits.push({ uri, range, newText });
    }
}

export class Diagnostic {
    constructor(
        public range: Range,
        public message: string,
        public severity: DiagnosticSeverity = DiagnosticSeverity.Error
    ) {}
}

export enum DiagnosticSeverity {
    Error = 0,
    Warning = 1,
    Information = 2,
    Hint = 3
}

export class CancellationTokenSource {
    token: CancellationToken;

    constructor() {
        this.token = {
            isCancellationRequested: false,
            onCancellationRequested: new EventEmitter()
        };
    }

    cancel(): void {
        this.token.isCancellationRequested = true;
    }

    dispose(): void {}
}

export interface CancellationToken {
    isCancellationRequested: boolean;
    onCancellationRequested: EventEmitter;
}

export const ThemeColor = class {
    constructor(public id: string) {}
};