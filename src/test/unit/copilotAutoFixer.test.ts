import * as vscode from 'vscode';
import { CopilotAutoFixer } from '../../copilotAutoFixer';
import { WorkspaceTrustError } from '../../errors';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { chai } from '../testSetup';
import chaiAsPromised from 'chai-as-promised';
import { expect } from 'chai';
import { TestHelper } from '../testHelper';
import { TestEnvironment } from '../types/testEnvironment';

chai.use(chaiAsPromised);

describe('CopilotAutoFixer', () => {
    const testHelper = TestHelper.getInstance();
    let testEnv: TestEnvironment;
    let autoFixer: CopilotAutoFixer;

    beforeEach(async () => {
        
        const documentConfig = {
            uri: vscode.Uri.parse('file:///test/file.ts'),
            getText: () => 'test code'
        };
        
        // Create test environment with base configuration - editor.document will be set after
        testEnv = await testHelper.createTestEnvironment({
            document: documentConfig,
            editor: {
                document: undefined // Will be set after document creation
            },
            stubs: {
                workspace: {
                    isTrusted: true
                },
                languages: {
                    getDiagnostics: [
                        new vscode.Diagnostic(
                            new vscode.Range(0, 0, 0, 1),
                            'test error',
                            vscode.DiagnosticSeverity.Error
                        )
                    ]
                }
            }
        });

  

        // Initialize system under test
        autoFixer = new CopilotAutoFixer();
    });

    afterEach(async () => {
        if (autoFixer) {
            autoFixer.dispose();
        }
        await testHelper.cleanup();
    });

    describe('attemptFix', () => {
        it('should throw WorkspaceTrustError if workspace is not trusted', async () => {
            // Arrange
            testEnv.sandbox.stub(vscode.workspace, 'isTrusted').value(false);

            // Act & Assert
            await expect(autoFixer.attemptFix(testEnv.mocks.editor!))
                .to.be.rejectedWith(WorkspaceTrustError);
        });
    
        it('should process fixes for document with diagnostics', async () => {
            
            
            
            if (!testEnv.mocks.document || !testEnv.mocks.editor) {
                throw new Error('Mocks not created');
            }
            
            // Reset state and setup stubs
            autoFixer['isFixing'] = false;
    
            
            const processFix = testEnv.sandbox.stub(autoFixer as any, 'processFix')
                .resolves(true);

            // Act
            await autoFixer.attemptFix(testEnv.mocks.editor!);

            // Assert
            expect(processFix.calledOnce).to.be.true;
            expect(processFix.firstCall.args).to.deep.equal([
                testEnv.mocks.document,
                testEnv.stubs?.languages?.getDiagnostics?.[0]
            ]);
        });
    });

    describe('fixMultiple', () => {
        it('should process multiple documents in batches', async () => {
            if (!testEnv.mocks.document) {
                throw new Error('Mock document not created');
            }

            // Arrange
            const documents = [testEnv.mocks.document, testEnv.mocks.document];
            const processDocuments = testEnv.sandbox.stub(autoFixer['batchProcessor'], 'processDocuments')
                .resolves();

            // Act
            await autoFixer.fixMultiple(documents);

            // Assert
            expect(processDocuments.calledOnce).to.be.true;
            expect(processDocuments.firstCall.args[0]).to.deep.equal(documents);
        });
    });

    describe('processFix', () => {
        it('should check cache before requesting new fix', async () => {
            // Arrange
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                'test error',
                vscode.DiagnosticSeverity.Error
            );
        
            const cachedFix = {
                fix: 'cached fix',
                success: true,
                timestamp: Date.now()
            };
        
            testEnv.sandbox.stub(autoFixer['cache'], 'get')
                .returns(cachedFix);
    
            // Configure workspace stubs in test environment instead of direct stubbing
            testEnv.stubs.workspace = {
                ...testEnv.stubs.workspace,
                applyEdit: true
            };
    
            testEnv.sandbox.stub(autoFixer['validator'], 'validateFix')
                .resolves(true);
    
            // Act
            const result = await autoFixer['processFix'](testEnv.mocks.document!, diagnostic);
    
            // Assert
            expect(result).to.be.true;
        });
    
        it('should request new fix when cache miss occurs', async () => {
            // Arrange
            const diagnostic = new vscode.Diagnostic(
                new vscode.Range(0, 0, 0, 1),
                'test error',
                vscode.DiagnosticSeverity.Error
            );
    
            testEnv.sandbox.stub(autoFixer['cache'], 'get')
                .returns(undefined);
    
            const requestFix = testEnv.sandbox.stub(autoFixer as any, 'requestCopilotFix')
                .resolves('new fix');
    
            testEnv.sandbox.stub(autoFixer['validator'], 'validateFix')
                .resolves(true);
    
            // Configure workspace stubs in test environment instead of direct stubbing
            testEnv.stubs.workspace = {
                ...testEnv.stubs.workspace,
                applyEdit: true
            };
    
            // Act
            await autoFixer['processFix'](testEnv.mocks.document!, diagnostic);
    
            // Assert
            expect(requestFix.calledOnce).to.be.true;
        });
    });
});