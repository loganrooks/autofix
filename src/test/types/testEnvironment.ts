import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { VSCodeAPIStubs } from '../stubManager';

export interface TestEnvironment {
    sandbox: sinon.SinonSandbox;
    mocks: {
        document: vscode.TextDocument;
        editor: vscode.TextEditor;
    };
    stubs: VSCodeAPIStubs;
}

export interface TestConfig {
    document: Partial<vscode.TextDocument>;
    editor: Partial<vscode.TextEditor>;
    stubs: VSCodeAPIStubs;
}