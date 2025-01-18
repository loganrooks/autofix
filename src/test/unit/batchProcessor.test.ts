import { BatchProcessor } from '../../utils/batchProcessor';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import chai from 'chai';

chai.use(chaiAsPromised);

describe('BatchProcessor', () => {
    let processor: BatchProcessor<string>;
    let processItem: sinon.SinonStub;

    beforeEach(() => {
        processItem = sinon.stub().resolves();
        processor = new BatchProcessor(2, processItem);
    });

    it('should process items in batches', async () => {
        const items = ['item1', 'item2', 'item3', 'item4'];
        await processor.processDocuments(items);

        expect(processItem.callCount).to.equal(4);
        expect(processItem.getCall(0).args[0]).to.equal('item1');
        expect(processItem.getCall(1).args[0]).to.equal('item2');
    });

    it('should handle errors in batch processing', async () => {
        processItem.withArgs('item2').rejects(new Error('test error'));
        const items = ['item1', 'item2', 'item3'];
        
        await processor.processDocuments(items);
        expect(processItem.callCount).to.equal(3);
    });

    it('should not process when already processing', async () => {
        processor['processing'] = true;
        const items = ['item1'];
        
        await expect(processor.processDocuments(items))
            .to.be.rejectedWith('Batch processor is already running');
    });
});