import { DisposableManager } from "../utils/disposableManager";
import { Logger } from "../utils/logger";
import { MockFactory } from "./mockFactory";
import { StubManager, VSCodeAPIStubs } from "./stubManager";
import { TestConfig, TestEnvironment } from "./types/testEnvironment";
import { DEFAULT_TEST_CONFIG } from "./testDefaults";


export class TestContext {
    private readonly mockFactory: MockFactory;
    private readonly stubManager: StubManager;
    private readonly disposables: DisposableManager;

    constructor() {
        this.mockFactory = new MockFactory();
        this.stubManager = new StubManager();
        this.disposables = new DisposableManager();
    }

    async createTestEnvironment(config: Partial<TestConfig>): Promise<TestEnvironment> {
        // Clear existing stubs before creating new ones
        await this.tearDown();

        const finalConfig = this.mergeConfigs(DEFAULT_TEST_CONFIG, config);
        
        // Create fresh stubs
        this.stubManager.stubVSCode(finalConfig.stubs);
        
        const document = this.mockFactory.createDocument(finalConfig.document);
        const editor = this.mockFactory.createEditor({
            ...finalConfig.editor,
            document
        });

        await Logger.getInstance().init();
        this.disposables.add(Logger.getInstance());

        return {
            sandbox: this.stubManager.sandbox,
            mocks: { document, editor },
            stubs: finalConfig.stubs
        };
    }

    private mergeConfigs(base: TestConfig, override: Partial<TestConfig>): TestConfig {
        return {
            document: { ...base.document, ...override.document },
            editor: { ...base.editor, ...override.editor },
            stubs: {
                window: {
                    ...base.stubs.window,
                    ...override.stubs?.window
                },
                workspace: {
                    ...base.stubs.workspace,
                    ...override.stubs?.workspace
                },
                languages: {
                    ...base.stubs.languages,
                    ...override.stubs?.languages
                },
                commands: {
                    ...base.stubs.commands,
                    ...override.stubs?.commands
                }
            }
        };
    }


    private cloneDefaultConfig(): TestConfig {
        return JSON.parse(JSON.stringify(DEFAULT_TEST_CONFIG));
    }


    async tearDown(): Promise<void> {
        this.stubManager.restore();
        this.disposables.dispose();
        await Logger.dispose();
    }
}