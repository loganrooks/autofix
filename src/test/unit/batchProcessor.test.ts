import { BatchProcessor } from '../../utils/batchProcessor';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { chai } from '../testSetup';
import { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TestHelper } from '../testHelper';
import * as vscode from 'vscode';
import { TestEnvironment } from '../types/testEnvironment';

chai.use(chaiAsPromised);

describe('BatchProcessor', () => {
    const testHelper = TestHelper.getInstance();
    let testEnv: TestEnvironment;
    let processor: BatchProcessor<vscode.TextDocument>;
    let processItemStub: sinon.SinonStub;
    let mockDocument: vscode.TextDocument;

    beforeEach(async () => {
        // Create test environment with configuration
        testEnv = await testHelper.createTestEnvironment({
            document: {
                uri: vscode.Uri.parse('file:///test.ts'),
                getText: () => 'test content'
            }
        });
        // Store mock document reference
        if (!testEnv.mocks.document) {
            throw new Error('Mock document not created');
        }
        mockDocument = testEnv.mocks.document;

        // Setup processing stub
        processItemStub = testEnv.sandbox.stub().resolves();

        // Initialize processor
        processor = new BatchProcessor<vscode.TextDocument>(
            2, // batchSize
            processItemStub
        );
    });

    afterEach(async () => {
        processor.clear();
        await testHelper.cleanup();
    });

    describe('processDocuments', () => {
        it('should process items in configured batch size', async () => {
            // Arrange
            const documents = Array(4).fill(testEnv.mocks.document);

            // Act
            await processor.processDocuments(documents);

            // Assert
            expect(processItemStub.callCount).to.equal(4);
            expect(processItemStub.getCall(0).args[0]).to.deep.equal(documents[0]);
            expect(processItemStub.getCall(1).args[0]).to.deep.equal(documents[1]);
        });

        it('should continue processing remaining items when one batch fails', async () => {
            // Arrange
            const documents = Array(3).fill(testEnv.mocks.document);
            processItemStub
                .withArgs(documents[1])
                .rejects(new Error('Planned test error'));

            // Act
            await processor.processDocuments(documents);

            // Assert
            expect(processItemStub.callCount).to.equal(3);
            expect(processItemStub.firstCall.args[0]).to.deep.equal(documents[0]);
            expect(processItemStub.thirdCall.args[0]).to.deep.equal(documents[2]);
        });

        it('should prevent concurrent processing attempts', async () => {
            if (!testEnv.mocks.document) {
                
                throw new Error('Mock document not created');
            }

            // Arrange
            processor['processing'] = true;
            const documents = [testEnv.mocks.document];

            // Act & Assert
            await expect(processor.processDocuments(documents))
                .to.be.rejectedWith('Batch processor is already running');
            expect(processItemStub.called).to.be.false;
        });
    });

    describe('processQueue', () => {
        it('should process queued items in batches', async () => {
            // Arrange
            const documents = Array(3).fill(testEnv.mocks.document);
            documents.forEach(doc => processor.add(doc));

            // Act
            await processor.processQueue();

            // Assert
            expect(processItemStub.callCount).to.equal(3);
            expect(processor.queueLength).to.equal(0);
        });

        it('should handle errors during queue processing', async () => {
            // Arrange
            const documents = Array(2).fill(testEnv.mocks.document);
            processItemStub.onFirstCall().rejects(new Error('Planned test error'));
            documents.forEach(doc => processor.add(doc));

            // Act
            await processor.processQueue();

            // Assert
            expect(processItemStub.callCount).to.equal(2);
            expect(processor.isProcessing).to.be.false;
        });
    });

    describe('clear', () => {
        it('should clear all queued items', () => {
            // Arrange

            if (!testEnv.mocks.document) {
                throw new Error('Mock document not created');
            }

            // Stub processQueue to prevent automatic processing
            testEnv.sandbox.stub(processor as any, 'processQueue').resolves();
            
            // Now we can add items without them being processed
            processor.add(testEnv.mocks.document);
            processor.add(testEnv.mocks.document);

            // Verify initial state
            expect(processor.queueLength).to.equal(2);

            // Act
            processor.clear();

            // Assert
            expect(processor.queueLength).to.equal(0);
        });
    });
});