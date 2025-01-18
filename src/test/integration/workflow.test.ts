import * as vscode from 'vscode';
import { CopilotAutoFixer } from '../../copilotAutoFixer';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Logger } from '../../utils/logger';

describe('Workflow Integration', () => {
    let autoFixer: CopilotAutoFixer;
    let sandbox: sinon.SinonSandbox;
    let mockEditor: vscode.TextEditor;
    let disposables: vscode.Disposable[] = [];

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        
        // Initialize logger first
        Logger.init();
        
        // Mock vscode APIs
        mockEditor = {
            document: {
                uri: { fsPath: '/test/file.ts' },
                getText: () => 'test code',
                lineCount: 1,
                version: 1
            },
            setDecorations: sandbox.stub(),
            selection: new vscode.Selection(0, 0, 0, 0)
        } as any;

        // Mock command registration before creating AutoFixer
        sandbox.stub(vscode.commands, 'registerCommand').returns({
            dispose: () => {}
        });

         // Create AutoFixer after mocks
         autoFixer = new CopilotAutoFixer();
        
         // Store all disposables
         disposables.push(autoFixer);
     });

     afterEach(() => {
        // Cleanup in reverse order
        while (disposables.length) {
            const disposable = disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
        sandbox.restore();
        Logger.dispose();
    });


    it('should complete full fix workflow', async () => {
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'Missing semicolon',
            vscode.DiagnosticSeverity.Error
        );
    
        sandbox.stub(vscode.languages, 'getDiagnostics')
            .returns([[mockEditor.document.uri, [diagnostic]]]);
    
        const copilotStub = sandbox.stub(vscode.commands, 'executeCommand')
            .resolves(['const x = 1;']);
    
        const editStub = sandbox.stub(vscode.workspace, 'applyEdit')
            .resolves(true);
    
        await autoFixer.attemptFix(mockEditor);
    
        expect(copilotStub.calledOnce).to.be.true;
        expect(editStub.calledOnce).to.be.true;
    });

    it('should handle undo operation', async () => {
        const fix = {
            document: mockEditor.document.uri,
            range: new vscode.Range(0, 0, 0, 1),
            oldText: 'const x = 1',
            newText: 'const x = 1;'
        };

        autoFixer['fixHistory'].addFix(fix.document, fix.range, fix.oldText, fix.newText);
        
        const editStub = sandbox.stub(vscode.workspace, 'applyEdit')
            .resolves(true);

        await autoFixer.undo();

        expect(editStub.calledOnce).to.be.true;
    });

    it('should batch process multiple documents', async () => {
        const documents = [mockEditor.document, mockEditor.document];
        const processStub = sandbox.stub(autoFixer['batchProcessor'], 'processDocuments')
            .resolves();

        await autoFixer.fixMultiple(documents);

        expect(processStub.calledOnce).to.be.true;
        expect(processStub.firstCall.args[0]).to.deep.equal(documents);
    });

    it('should preview fixes when enabled', async () => {
        const showTextDocumentStub = sandbox.stub(vscode.window, 'showTextDocument')
            .resolves({
                ...mockEditor,
                setDecorations: sandbox.stub()
            });
    
        sandbox.stub(vscode.window, 'showInformationMessage')
            .resolves({ title: 'Apply' } as vscode.MessageItem);
    
        const result = await autoFixer['previewAndApplyFix'](
            'const x = 1;',
            mockEditor.document,
            new vscode.Range(0, 0, 0, 1)
        );
    
        expect(result).to.be.true;
        expect(showTextDocumentStub.called).to.be.true;
    });
});