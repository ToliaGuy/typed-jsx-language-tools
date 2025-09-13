import * as serverProtocol from '@volar/language-server/protocol';
import { createLabsInfo, getTsdk } from '@volar/vscode';
import { BaseLanguageClient, LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from '@volar/vscode/node';
import * as vscode from 'vscode';

let client: BaseLanguageClient;

export async function activate(context: vscode.ExtensionContext) {

	const serverModule = vscode.Uri.joinPath(context.extensionUri, 'dist', 'server.js');
	const runOptions = { execArgv: <string[]>[] };
	const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
	const serverOptions: ServerOptions = {
		run: {
			module: serverModule.fsPath,
			transport: TransportKind.ipc,
			options: runOptions
		},
		debug: {
			module: serverModule.fsPath,
			transport: TransportKind.ipc,
			options: debugOptions
		},
	};
	const clientOptions: LanguageClientOptions = {
		documentSelector: [
			{ language: 'javascriptreact' },
			{ language: 'typescriptreact' }
		],
		middleware: {
			async provideHover(document, position, token, next) {
				const hover = await next(document, position, token);
				if (!hover) {
					return hover;
				}
				const header = new vscode.MarkdownString('', true);
				header.supportThemeIcons = true;
				header.appendMarkdown('$(zap) *Typed JSX*  \n');
				const footer = new vscode.MarkdownString('', true);
				footer.appendMarkdown('Default JSX:  \n');
				const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
				return new vscode.Hover([header, ...contents, footer], hover.range);
			},
		},
		initializationOptions: {
			typescript: {
				tsdk: (await getTsdk(context))!.tsdk,
			},
		},
	};
	client = new LanguageClient(
		'typed-jsx-language-server',
		'Typed JSX Language Server',
		serverOptions,
		clientOptions,
	);
	await client.start();

	// support for https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
	// ref: https://twitter.com/johnsoncodehk/status/1656126976774791168
	const labsInfo = createLabsInfo(serverProtocol);
	labsInfo.addLanguageClient(client);
	return labsInfo.extensionExports;
}

export function deactivate(): Thenable<any> | undefined {
	return client?.stop();
}
