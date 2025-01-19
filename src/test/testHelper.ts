import { TestContext } from './testContext';
import { TestConfig, TestEnvironment} from './types/testEnvironment';
import { DEFAULT_TEST_CONFIG } from "./testDefaults";

export class TestHelper {
    private static instance: TestHelper | undefined;
    private readonly context: TestContext;
    
    private constructor() {
        this.context = new TestContext();
    }

    static getInstance(): TestHelper {
        if (!TestHelper.instance) {
            TestHelper.instance = new TestHelper();
        }
        return TestHelper.instance;
    }

    async createTestEnvironment(config: Partial<TestConfig> = {}): Promise<TestEnvironment> {
        const baseConfig = this.cloneDefaultConfig();
        const finalConfig = {
            document: { ...baseConfig.document, ...config.document },
            editor: {...baseConfig.editor, ...config.editor },
            stubs: { ...config.stubs }
        };
        return this.context.createTestEnvironment(finalConfig);
    }

    private cloneDefaultConfig(): TestConfig {
        return JSON.parse(JSON.stringify(DEFAULT_TEST_CONFIG));
    }

    async cleanup(): Promise<void> {
        await this.context.tearDown();
    }

    static reset(): void {
        TestHelper.instance = undefined;
    }
}