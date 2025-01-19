import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { TestHelper } from './testHelper';

// Configure chai plugins
chai.use(chaiAsPromised);
chai.use(sinonChai);

// Export configured chai instance
export { chai };

// Export helper initialization functions
export const initializeTestHelper = (): void => {
    TestHelper.reset();
};

export const cleanupTestHelper = async (): Promise<void> => {
    await TestHelper.getInstance().cleanup();
};