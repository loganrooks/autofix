import * as vscode from 'vscode';
import { TestConfig } from './types/testEnvironment';
import { VSCodeAPIStubs } from './stubManager';
import { FixDecision } from '../types/enums';

const DEFAULT_DOCUMENT_SETUP = {
    uri: vscode.Uri.parse('file:///test/file.ts'),
    getText: () => 'test code',
    lineCount: 1,
    languageId: 'typescript',
    version: 1,
    isDirty: false,
    isClosed: false
} as vscode.TextDocument;

export const DEFAULT_TEST_CONFIG = {
    document: DEFAULT_DOCUMENT_SETUP,
    editor: {
        document: DEFAULT_DOCUMENT_SETUP, // Will be set after document creation
        selection: new vscode.Selection(0, 0, 0, 0),
        options: {
            tabSize: 4,
            insertSpaces: true,
            cursorStyle: vscode.TextEditorCursorStyle.Line,
            lineNumbers: vscode.TextEditorLineNumbersStyle.On
        } as vscode.TextEditorOptions,
    } as vscode.TextEditor,
    stubs: {
        window: {
            showInformationMessage: FixDecision.Apply,
            createOutputChannel: {
                regular: {},
                log: {},
                error: {},
                warn: {},
                info: {},
                debug: {},
                appendLine: () => {},
                append: () => {},
                clear: () => {},
                show: () => {},
                hide: () => {},
                dispose: () => {},
                name: 'test channel',
                replace: () => {},
            } as vscode.OutputChannel,
            showTextDocument: {
                editor: {
                    document: DEFAULT_DOCUMENT_SETUP,
                    selection: new vscode.Selection(0, 0, 0, 0),
                    selections: [new vscode.Selection(0, 0, 0, 0)],
                    visibleRanges: [new vscode.Range(0, 0, 10, 0)],
                    options: {
                        tabSize: 4,
                        insertSpaces: true,
                        cursorStyle: vscode.TextEditorCursorStyle.Line,
                        lineNumbers: vscode.TextEditorLineNumbersStyle.On
                    },
                    viewColumn: vscode.ViewColumn.One,
                    edit: () => Promise.resolve(true),
                    setDecorations: () => {},
                    revealRange: () => {},
                    show: () => {},
                    hide: () => {},
                    insertSnippet: () => Promise.resolve(true),
                } as vscode.TextEditor
            }
        },
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
        },
        commands: {
            copilotSuggestions: ['suggested fix']
        }
    } as VSCodeAPIStubs
} as TestConfig;