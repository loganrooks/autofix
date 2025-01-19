import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { DEFAULT_TEST_CONFIG } from './testDefaults';
import { FixDecision } from '../types/enums';

export interface VSCodeAPIStubs {
    languages?: {
        getDiagnostics?: vscode.Diagnostic[] | [vscode.Uri, vscode.Diagnostic[]][];
    };
    window?: {
        createOutputChannel?: {
            regular?: Partial<vscode.OutputChannel>;
            log?: Partial<vscode.LogOutputChannel>;
          };
          showInformationMessage?: FixDecision;
          showTextDocument?: {
            editor?: vscode.TextEditor;
        };
        };
    workspace?: {
        isTrusted?: boolean;
        applyEdit?: boolean;
    };
    commands?: {
        copilotSuggestions?: string[];
    };
}

export class StubManager implements vscode.Disposable {
    private readonly _sandbox: sinon.SinonSandbox;
    private readonly stubInstances: Map<string, vscode.Disposable> = new Map();

    constructor() {
        this._sandbox = sinon.createSandbox();
    }

    get sandbox(): sinon.SinonSandbox {
        return this._sandbox;
    }

    stubVSCode(config: VSCodeAPIStubs = {}): void {
        if (config.languages) {
            this.stubLanguagesAPI(config.languages);
        }
        if (config.window) {
            this.stubWindowAPI(config.window);
        }
        if (config.workspace) {
            this.stubWorkspaceAPI(config.workspace);
        }
        if (config.commands) {
            this.stubCommandsAPI(config.commands);
        }
    }

    private stubLanguagesAPI(config: VSCodeAPIStubs['languages']): void {
        // Remove existing diagnostics stub if it exists
        this.restoreStub('diagnostics');

        if (config?.getDiagnostics) {
            const diagnosticsStub = this._sandbox.stub(vscode.languages, 'getDiagnostics');
            
            // Handle URI version
            (diagnosticsStub as unknown as sinon.SinonStub<[uri: vscode.Uri], vscode.Diagnostic[]>)
                .callsFake((_uri: vscode.Uri) => {
                return Array.isArray(config.getDiagnostics) 
                    ? config.getDiagnostics as vscode.Diagnostic[] 
                    : [];
            });

            this.trackStubInstance('diagnostics', {
                dispose: () => {
                    diagnosticsStub.restore();
                }
            });
        }
    }

    private restoreStub(key: string): void {
        const stub = this.stubInstances.get(key);
        if (stub) {
            stub.dispose();
            this.stubInstances.delete(key);
        }
    }

    private stubWindowAPI(config: VSCodeAPIStubs['window']): void {
        // Get default window stubs
        const defaultWindowStubs = DEFAULT_TEST_CONFIG.stubs.window;
        
        // Create output channel stubs
        if (config?.createOutputChannel) {
            this.stubOutputChannel(config.createOutputChannel);
        }
    
        // Create information message stub
        if (config?.showInformationMessage) {
            const messageItems: { [K in FixDecision]: FixDecision } = {
                [FixDecision.Apply]: FixDecision.Apply,
                [FixDecision.Skip]: FixDecision.Skip,
                [FixDecision.Stop]: FixDecision.Stop
            };
    
            (this._sandbox.stub(vscode.window, 'showInformationMessage') as unknown as sinon.SinonStub<[message: string, options: vscode.MessageOptions, ...items: FixDecision[]], Thenable<FixDecision>>)
                .callsFake(async (_message: string, _options: vscode.MessageOptions, ...items: FixDecision[]) => {
                    return messageItems[config.showInformationMessage as FixDecision];
                });
        }
    
        // Always create showTextDocument stub with fallback to defaults
        const editorConfig = config?.showTextDocument?.editor || 
        DEFAULT_TEST_CONFIG.stubs.window?.showTextDocument?.editor;
    
    const showTextDocumentStub = this._sandbox.stub(vscode.window, 'showTextDocument');
    (showTextDocumentStub as unknown as sinon.SinonStub<[document: vscode.TextDocument, options?: vscode.TextDocumentShowOptions], Thenable<vscode.TextEditor>>).callsFake(async (document: vscode.TextDocument): Promise<vscode.TextEditor> => {
        const editor: vscode.TextEditor = {
            document,
            selection: editorConfig?.selection || new vscode.Selection(0, 0, 0, 0),
            selections: editorConfig?.selections || [new vscode.Selection(0, 0, 0, 0)],
            visibleRanges: editorConfig?.visibleRanges || [new vscode.Range(0, 0, 10, 0)],
            options: editorConfig?.options || {
                tabSize: 4,
                insertSpaces: true,
                cursorStyle: vscode.TextEditorCursorStyle.Line,
                lineNumbers: vscode.TextEditorLineNumbersStyle.On
            },
            viewColumn: editorConfig?.viewColumn || vscode.ViewColumn.Active,
            // Add required methods
            edit: (callback: (editBuilder: vscode.TextEditorEdit) => void) => {
                return Promise.resolve(true);
            },
            insertSnippet: (_snippet: vscode.SnippetString, _location?: vscode.Position | vscode.Range | readonly vscode.Position[] | readonly vscode.Range[]) => {
                return Promise.resolve(true);
            },
            setDecorations: editorConfig?.setDecorations || (() => {}),
            revealRange: editorConfig?.revealRange || (() => {}),
            show: editorConfig?.show || (() => {}),
            hide: editorConfig?.hide || (() => {})
        };
        
        return editor;

        });
        
        this.trackStubInstance('showTextDocument', {
            dispose: () => showTextDocumentStub.restore()
        });
    }

    private stubOutputChannel(config: {
        regular?: Partial<vscode.OutputChannel>;
        log?: Partial<vscode.LogOutputChannel>;
    }): void {
        const createOutputChannel = this._sandbox.stub(vscode.window, 'createOutputChannel');

        // Regular output channel
        (createOutputChannel.withArgs(sinon.match.string) as unknown as sinon.SinonStub<[name: string], vscode.OutputChannel>)
            .callsFake((name: string) => this.createOutputChannelStub(config?.regular)(name));

        // Log output channel
        (createOutputChannel.withArgs(sinon.match.string, sinon.match({ log: true })) as sinon.SinonStub<[name: string, { log: true }], vscode.LogOutputChannel>)
            .callsFake((name: string, _options: { log: true }) => this.createLogOutputChannelStub(config?.log)(name));

        // Track for cleanup
        this.trackStubInstance('outputChannel', {
            dispose: () => createOutputChannel.restore()
        });
    }


    private createOutputChannelStub(config?: Partial<vscode.OutputChannel>) {
        return (name: string): vscode.OutputChannel => ({
            name,
            appendLine: () => {},
            append: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            replace: () => {},
            dispose: () => {},
            ...config
        } as vscode.OutputChannel);
    }

    private createLogOutputChannelStub(config?: Partial<vscode.LogOutputChannel>) {
        return (name: string): vscode.LogOutputChannel => ({
            name,
            appendLine: () => {},
            append: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            replace: () => {},
            dispose: () => {},
            logLevel: vscode.LogLevel.Info,
            onDidChangeLogLevel: new vscode.EventEmitter<vscode.LogLevel>().event,
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            ...config
        } as vscode.LogOutputChannel);
    }

    private trackStubInstance(key: string, disposable: vscode.Disposable): void {
        this.stubInstances.set(key, disposable);
    }

    private stubWorkspaceAPI(config: VSCodeAPIStubs['workspace']): void {
        if (typeof config?.isTrusted !== 'undefined') {
            this._sandbox.stub(vscode.workspace, 'isTrusted').value(config.isTrusted);
        }
        if (typeof config?.applyEdit !== 'undefined') {
            this._sandbox.stub(vscode.workspace, 'applyEdit').resolves(config.applyEdit);
        }
    }

    private stubCommandsAPI(config: VSCodeAPIStubs['commands']): void {
        // Stub command registration
        (this._sandbox.stub(vscode.commands, 'registerCommand') as unknown as sinon.SinonStub<[command: string, callback: (...args: any[]) => any], vscode.Disposable>)
            .returns({ dispose: () => {} });
    
        // Stub executeCommand
        const executeCommandStub = this._sandbox.stub(vscode.commands, 'executeCommand');
    
        // Stub copilot-autofixer.start command
        (executeCommandStub.withArgs('copilot-autofixer.start') as unknown as sinon.SinonStub<[command: string], Promise<void>>)
            .callsFake(async () => {
                if (!vscode.window.activeTextEditor) {
                    throw new Error('No active editor');
                }
            });
    
        // Stub copilot-autofixer.undo command
        (executeCommandStub.withArgs('copilot-autofixer.undo') as unknown as sinon.SinonStub<[command: string], Promise<void>>)
            .resolves();
    
        // Stub copilot-autofixer.fixAll command
        (executeCommandStub.withArgs('copilot-autofixer.fixAll') as unknown as sinon.SinonStub<[command: string], Promise<void>>)
            .resolves();
    
        // Stub github.copilot.generate command
        (executeCommandStub.withArgs('github.copilot.generate') as unknown as sinon.SinonStub<[command: string, options: any], Promise<string[]>>)
            .resolves(config?.copilotSuggestions || ['suggested fix']);
    }





    restore(): void {
        // Cleanup stub instances
        for (const instance of this.stubInstances.values()) {
            instance.dispose();
        }
        this.stubInstances.clear();
        
        // Restore sandbox
        this._sandbox.restore();
    }

    dispose(): void {
        this.restore();
    }
}