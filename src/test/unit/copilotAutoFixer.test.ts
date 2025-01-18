import * as vscode from 'vscode';
import { CopilotAutoFixer } from '../../copilotAutoFixer';
import { WorkspaceTrustError } from '../../errors';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';

chai.use(chaiAsPromised);

describe('CopilotAutoFixer', () => {
    let autoFixer: CopilotAutoFixer;
    let mockEditor: vscode.TextEditor;
    let mockDocument: vscode.TextDocument;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        autoFixer = new CopilotAutoFixer();
        
        mockDocument = {
            uri: { fsPath: '/test/file.ts' },
            getText: sandbox.stub().returns('test code'),
            lineCount: 1
        } as any;

        mockEditor = {
            document: mockDocument
        } as any;

        sandbox.stub(vscode.workspace, 'isTrusted').value(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('attemptFix', () => {
        it('should throw WorkspaceTrustError if workspace is not trusted', async () => {
            sandbox.stub(vscode.workspace, 'isTrusted').value(false);
            await expect(autoFixer.attemptFix(mockEditor))
                .to.be.rejectedWith(WorkspaceTrustError);
        });
    
        it('should process fixes for document with diagnostics', async () => {
            const diagnostics = [
                new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 1),
                    'test error',
                    vscode.DiagnosticSeverity.Error
                )
            ];
            
            sandbox.stub(vscode.languages, 'getDiagnostics')
                .returns([[mockDocument.uri, diagnostics]]);
            
            const processFix = sandbox.stub(autoFixer as any, 'processFix')
                .resolves(true);
    
            await autoFixer.attemptFix(mockEditor);
            expect(processFix.calledOnce).to.be.true;
        });
    });

    describe('fixMultiple', () => {
        it('should process multiple documents in batches', async () => {
            const documents = [mockDocument, mockDocument];
            const processDocuments = sandbox.stub(autoFixer['batchProcessor'], 'processDocuments')
                .resolves();

            await autoFixer.fixMultiple(documents);
            expect(processDocuments.calledOnce).to.be.true;
            expect(processDocuments.firstCall.args[0]).to.deep.equal(documents);
        });
    });

    describe('processFix', () => {
        it('should check cache before requesting new fix', async () => {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                'test error',
                vscode.DiagnosticSeverity.Error
            );
            
            const getCacheStub = sandbox.stub(autoFixer['cache'], 'get')
                .returns({ fix: 'cached fix', success: true, timestamp: Date.now() });

            const result = await autoFixer['processFix'](mockDocument, diagnostic);
            expect(result).to.be.true;
            expect(getCacheStub.calledOnce).to.be.true;
        });

        it('should validate fix before applying', async () => {
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                'test error',
                vscode.DiagnosticSeverity.Error
            );
            
            sandbox.stub(autoFixer['cache'], 'get').returns(undefined);
            sandbox.stub(autoFixer['retryStrategy'], 'retry')
                .resolves('new fix');
            
            const validateStub = sandbox.stub(autoFixer['validator'], 'validateFix')
                .resolves(false);

            const result = await autoFixer['processFix'](mockDocument, diagnostic);
            expect(result).to.be.false;
            expect(validateStub.calledOnce).to.be.true;
        });
    });
});