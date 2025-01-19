import { chai } from '../testSetup';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { CopilotAutoFixer } from '../../copilotAutoFixer';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { TestHelper } from '../testHelper';
import { TestEnvironment } from '../types/testEnvironment';
import { FixDecision } from '../../types/enums';
import { DEFAULT_TEST_CONFIG } from '../testDefaults';

describe('Workflow Integration', () => {
    const testHelper = TestHelper.getInstance();
    let testEnv: TestEnvironment;
    let autoFixer: CopilotAutoFixer;
    const testFixData = {
        code: 'const x = 1;',
        range: new vscode.Range(0, 0, 0, 1)
    };


    beforeEach(async () => {
        // Create base test environment with common configuration
        testEnv = await testHelper.createTestEnvironment({
            document: undefined,
            editor: {
                document: undefined,
                setDecorations: () => {}
            },
            stubs: {
                workspace: {
                    isTrusted: true,
                    applyEdit: true
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

        autoFixer = new CopilotAutoFixer();
    });

    afterEach(async () => {
        if (autoFixer) {
            autoFixer.dispose();
        }
        await testHelper.cleanup();
    });

    describe('End-to-end workflows', () => {
        it('should complete full fix workflow', async () => {
            // Arrange
            if (!testEnv.mocks.editor) {
                throw new Error('Editor mock not created');
            }

            // Act
            await autoFixer.attemptFix(testEnv.mocks.editor);

            // Assert - Verify applyEdit was called via stubs configuration
            const workspaceStubs = testEnv.stubs?.workspace;
            expect(workspaceStubs?.applyEdit).to.be.true;
        });

        it('should handle undo operation', async () => {
            // Arrange
            if (!testEnv.mocks.document) {
                throw new Error('Document mock not created');
            }

            const fix = {
                document: testEnv.mocks.document.uri,
                range: new vscode.Range(0, 0, 0, 1),
                oldText: 'const x = 1',
                newText: 'const x = 1;'
            };

            // Add fix to history
            autoFixer['fixHistory'].addFix(
                fix.document,
                fix.range,
                fix.oldText,
                fix.newText
            );

            // Act
            await autoFixer.undo();

            // Assert - Verify applyEdit was called via stubs configuration
            const workspaceStubs = testEnv.stubs?.workspace;
            expect(workspaceStubs?.applyEdit).to.be.true;
        });

        it('should batch process multiple documents', async () => {
            // Arrange
            if (!testEnv.mocks.document) {
                throw new Error('Document mock not created');
            }

            const documents = [testEnv.mocks.document, testEnv.mocks.document];
            const processStub = testEnv.sandbox.stub(autoFixer['batchProcessor'], 'processDocuments')
                .resolves();

            // Act
            await autoFixer.fixMultiple(documents);

            // Assert
            expect(processStub.calledOnce).to.be.true;
            expect(processStub.firstCall.args[0]).to.deep.equal(documents);
        });

    });

    describe('Fix Preview', () => {
        const testFixData = {
            code: 'const x = 1;',
            range: new vscode.Range(0, 0, 0, 1)
        };
    
        beforeEach(async () => {
            autoFixer = new CopilotAutoFixer();
        });
    
        const decisions = [
            {
                name: 'apply fix when approved',
                decision: FixDecision.Apply,
                expectedResult: FixDecision.Apply,
                additionalChecks: () => {}
            },
            {
                name: 'skip fix when selected',
                decision: FixDecision.Skip,
                expectedResult: FixDecision.Skip,
                additionalChecks: () => {}
            },
            {
                name: 'stop processing when selected',
                decision: FixDecision.Stop,
                expectedResult: FixDecision.Stop,
                additionalChecks: () => {
                    expect(autoFixer['batchProcessor'].queueLength).to.equal(0);
                }
            }
        ];
    
        decisions.forEach(({ name, decision, expectedResult, additionalChecks }) => {
            it(`should ${name}`, async () => {
                // Create fresh environment for each test with specific decision
                testEnv = await testHelper.createTestEnvironment({
                    document: {
                        ...DEFAULT_TEST_CONFIG.document,
                        getText: () => testFixData.code
                    },
                    editor: {
                        document: undefined,
                        setDecorations: () => {}
                    },
                    stubs: {
                        window: {
                            showInformationMessage: decision,
                            showTextDocument: {
                                editor: undefined
                            }
                        },
                        workspace: {
                            isTrusted: true,
                            applyEdit: true
                        }
                    }
                });
    
                const result = await autoFixer['previewAndApplyFix'](
                    testFixData.code,
                    testEnv.mocks.document!,
                    testFixData.range
                );
    
                expect(result).to.equal(expectedResult);
                additionalChecks();
            });
        });
    });
});