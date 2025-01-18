import * as vscode from 'vscode';
import { CopilotAutoFixer } from '../../copilotAutoFixer';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';

describe('Workflow Integration', () => {
    let autoFixer: CopilotAutoFixer;
    let sandbox: sinon.SinonSandbox;
    let mockDocument: vscode.TextDocument;
    let mockEditor: vscode.TextEditor;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        autoFixer = new CopilotAutoFixer();

        mockDocument = {
            uri: { fsPath: '/test/file.ts' },
            getText: sandbox.stub().returns('test code'),
            lineCount: 1,
            version: 1
        } as any;

        mockEditor = {
            document: mockDocument,
            selection: new vscode.Selection(0, 0, 0, 0)
        } as any;

        sandbox.stub(vscode.workspace, 'isTrusted').value(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should complete full fix workflow', async () => {
        const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 1),
            'Missing semicolon',
            vscode.DiagnosticSeverity.Error
        );
    
        sandbox.stub(vscode.languages, 'getDiagnostics')
            .returns([[mockDocument.uri, [diagnostic]]]);
    
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
            document: mockDocument.uri,
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
        const documents = [mockDocument, mockDocument];
        const processStub = sandbox.stub(autoFixer['batchProcessor'], 'processDocuments')
            .resolves();

        await autoFixer.fixMultiple(documents);

        expect(processStub.calledOnce).to.be.true;
        expect(processStub.firstCall.args[0]).to.deep.equal(documents);
    });

    it('should preview fixes when enabled', async () => {
        sandbox.stub(vscode.window, 'showTextDocument').resolves(mockEditor);
        sandbox.stub(vscode.window, 'showInformationMessage')
            .resolves({ title: 'Apply' } as vscode.MessageItem); // Fix MessageItem type
    
        const diagnostics = [
            new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                'test error',
                vscode.DiagnosticSeverity.Error
            )
        ];
    
        sandbox.stub(vscode.languages, 'getDiagnostics')
            .returns([[mockDocument.uri, diagnostics]]);
    
        const result = await autoFixer['previewAndApplyFix'](
            'const x = 1;',
            mockDocument,
            diagnostics[0].range // Fix: use diagnostics array item
        );
    
        expect(result).to.be.true;
    });
});