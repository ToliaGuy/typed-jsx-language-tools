import { CodeMapping, LanguagePlugin, VirtualCode } from '@volar/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { transformSync, type BabelFileResult } from '@babel/core';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plugin has no types
import jsxTransform from '@babel/plugin-transform-react-jsx';
import { decode as decodeMappings } from '@jridgewell/sourcemap-codec';

export const jsxLanguagePlugin: LanguagePlugin<URI> = {
	getLanguageId(uri) {
		if (uri.path.endsWith('.jsx')) {
			return 'javascriptreact';
		}
		if (uri.path.endsWith('.tsx')) {
			return 'typescriptreact';
		}
	},
	createVirtualCode(uri, languageId, snapshot) {
		if (languageId === 'javascriptreact' || languageId === 'typescriptreact') {
			const result = new JsxVirtualCode(uri, snapshot, languageId);
			return result
		}
	},
	typescript: {
		extraFileExtensions: [
			{ extension: 'jsx', isMixedContent: false, scriptKind: 2 satisfies ts.ScriptKind.JSX },
			{ extension: 'tsx', isMixedContent: false, scriptKind: 4 satisfies ts.ScriptKind.TSX }
		],
		getServiceScript(root) {
			// Feed transformed code to TS as pure TypeScript (no JSX left after transform)
			return {
				code: root,
				extension: '.ts',
				scriptKind: 3 satisfies ts.ScriptKind.TS,
			};
		},
		getExtraServiceScripts() {
			return [];
		},
	},
};

export class JsxVirtualCode implements VirtualCode {
	id = 'root';
	languageId: string;
	mappings: CodeMapping[];
	embeddedCodes: VirtualCode[] = [];

	// Store original and transformed code
	originalText: string;
	transformedText: string;
	private lastSourceMap: BabelFileResult['map'] | null = null;
	private readonly originalUri: URI;

	constructor(public uri: URI, public snapshot: ts.IScriptSnapshot, languageId: string) {
		this.languageId = 'typescript';
		this.originalUri = uri;
		this.originalText = snapshot.getText(0, snapshot.getLength());
		const transform = this.transformJsx(this.originalText);
		this.transformedText = transform.code;
		this.lastSourceMap = transform.map;
		this.mappings = this.createMappingsFromSourceMap();
		this.embeddedCodes = [];
	}

	/**
	 * Transform JSX code according to your custom logic
	 * This is where you implement your specific transformation
	 */
	private transformJsx(originalCode: string): { code: string; map: BabelFileResult['map'] | null } {
		const isTsx = this.originalUri.path.endsWith('.tsx') || this.languageId === 'typescriptreact';
		const filename = isTsx ? 'virtual.tsx' : 'virtual.jsx';
		const result = transformSync(originalCode, {
			filename,
			babelrc: false,
			configFile: false,
			generatorOpts: { retainLines: false },
			parserOpts: {
				sourceType: 'module',
				plugins: ['typescript', 'jsx'],
				allowReturnOutsideFunction: false,
				allowAwaitOutsideFunction: false,
			},
			plugins: [
				[
					jsxTransform as any,
					{
						runtime: 'classic',
						pragma: 'createElement',
						pragmaFrag: 'Fragment',
						throwIfNamespace: false,
					},
				],
			],
			sourceMaps: true,
			sourceFileName: filename,
		});
		if (!result || !result.code) {
			throw new Error('Babel transform returned no code');
		}
		return { code: result.code, map: result.map ?? null };
	}

	/**
	 * Create mappings between original and transformed code
	 * This is crucial for accurate diagnostics and IDE features
	 */
	private createMappingsFromSourceMap(): CodeMapping[] {
		
	}

	// Implement the snapshot interface for the transformed code
	getText(start: number, end: number): string {
		return this.transformedText.substring(start, end);
	}

	getLength(): number {
		return this.transformedText.length;
	}

	getChangeRange(): ts.TextChangeRange | undefined {
		return undefined;
	}
}
