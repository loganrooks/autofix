import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { runTests } from '@vscode/test-electron';


async function createTestWorkspace(tmpDir: string, timestamp: string): Promise<string> {
    const workspacePath = path.resolve(tmpDir, `vscode-test-workspace-${timestamp}`);
    try {
        // Clean up existing workspace if it exists
        await fs.rm(workspacePath, { recursive: true, force: true }).catch(() => {});
        await fs.mkdir(workspacePath, { recursive: true });
        return workspacePath;
    } catch (err) {
        throw new Error(`Failed to create test workspace: ${err instanceof Error ? err.message : String(err)}`);
    }
}

async function copyFixtures(projectRoot: string, workspacePath: string): Promise<void> {
    const fixturesPath = path.resolve(projectRoot, 'src/test/fixtures');
    try {
        // Check if fixtures exist before copying
        const fixturesExist = await fs.access(fixturesPath).then(() => true).catch(() => false);
        if (fixturesExist) {
            await fs.cp(fixturesPath, workspacePath, { recursive: true });
        }
    } catch (err) {
        throw new Error(`Failed to copy fixtures: ${err instanceof Error ? err.message : String(err)}`);
    }
}
async function cleanup(workspacePath?: string): Promise<void> {
    if (workspacePath) {
        try {
            await fs.rm(workspacePath, { recursive: true, force: true });
            console.log('Cleaned up workspace:', workspacePath);
        } catch (err) {
            console.error('Cleanup failed:', err);
        }
    }
}

async function exitWithError(error: unknown, code = 1): Promise<never> {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    await cleanup(globalWorkspacePath);
    process.exit(code);
}

let globalWorkspacePath: string | undefined;

async function main() {
    const tmpDir = os.tmpdir();
    const timestamp = new Date().getTime().toString();
    
    try {
        // Use absolute paths and ensure proper directory structure
        const projectRoot = path.resolve(__dirname, '../../');
        const extensionDevelopmentPath = projectRoot;
        const extensionTestsPath = path.resolve(__dirname, './suite');

        // Setup test workspace
        globalWorkspacePath = await createTestWorkspace(tmpDir, timestamp);
        await copyFixtures(projectRoot, globalWorkspacePath);

        console.log('Test paths:', {
            extensionDevelopmentPath,
            extensionTestsPath,
            workspacePath: globalWorkspacePath
        });
                
        // Run tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                globalWorkspacePath,
                '--disable-gpu',
                '--disable-extensions',
                '--disable-updates',
                '--disable-workspace-trust',
                '--user-data-dir=/tmp/vscode-test-user-data'
            ],
            extensionTestsEnv: {
                ELECTRON_ENABLE_LOGGING: '1',
                VSCODE_SKIP_PRELAUNCH: '1',
                MOCHA_TIMEOUT: '60000'
            }
        });

        await cleanup(globalWorkspacePath);
        process.exit(0);
    } catch (err) {
        await exitWithError(err);
    }
}

// Handle process events
process.on('uncaughtException', exitWithError);
process.on('unhandledRejection', exitWithError);
process.on('SIGTERM', () => exitWithError(new Error('Process terminated')));
process.on('SIGINT', () => exitWithError(new Error('Process interrupted')));

// Start tests
main().catch(exitWithError);