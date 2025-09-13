import { CodeMapping, LanguagePlugin, VirtualCode } from '@volar/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { transformSync, type BabelFileResult } from '@babel/core';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plugin has no types
import jsxTransform from '@babel/plugin-transform-react-jsx';
import { decode as decodeMappings } from '@jridgewell/sourcemap-codec';
import * as babelParser from '@babel/parser';

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
			const result = new JsxVirtualCode(uri, snapshot);
			return result
		}
	},
	updateVirtualCode(_scriptId, virtualCode: JsxVirtualCode, newSnapshot) {
		// Re-transform and update snapshot + mappings incrementally
		virtualCode.originalText = newSnapshot.getText(0, newSnapshot.getLength());
		const transform = virtualCode['transformJsx'](virtualCode.originalText);
		virtualCode.transformedText = transform.code;
		virtualCode['lastSourceMap'] = transform.map;
		virtualCode.mappings = virtualCode['createMappingsFromSourceMap']();
		virtualCode.snapshot = {
			getText: (start, end) => virtualCode.transformedText.substring(start, end),
			getLength: () => virtualCode.transformedText.length,
			getChangeRange: () => undefined,
		};
		return virtualCode;
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
	snapshot: ts.IScriptSnapshot;
	mappings: CodeMapping[];
	embeddedCodes: VirtualCode[] = [];

	// Store original and transformed code
	originalText: string;
	transformedText: string;
	private lastSourceMap: BabelFileResult['map'] | null = null;
	private readonly originalUri: URI;

	constructor(public uri: URI, originalSnapshot: ts.IScriptSnapshot) {
		this.languageId = 'typescript';
		this.originalUri = uri;
		this.originalText = originalSnapshot.getText(0, originalSnapshot.getLength());
		const transform = this.transformJsx(this.originalText);
		this.transformedText = transform.code;
		this.lastSourceMap = transform.map;
		this.mappings = this.createMappingsFromSourceMap();
		this.embeddedCodes = [];
		// Expose transformed code via snapshot for TS language service
		this.snapshot = {
			getText: (start, end) => this.transformedText.substring(start, end),
			getLength: () => this.transformedText.length,
			getChangeRange: () => undefined,
		};
	}

	/**
	 * Transform JSX code according to your custom logic
	 * This is where you implement your specific transformation
	 */
	private transformJsx(originalCode: string): { code: string; map: BabelFileResult['map'] | null } {
		const isTsx = this.originalUri.path.endsWith('.tsx');
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
		const map = this.lastSourceMap;
		if (!map || !map.mappings) {
			return [{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [Math.min(this.originalText.length, this.transformedText.length)],
				data: {
					completion: true,
					format: true,
					navigation: true,
					semantic: { shouldHighlight: () => false },
					structure: true,
					verification: true,
				},
			}];
		}
		const generatedLineStarts = computeLineStarts(this.transformedText);
		const sourceLineStarts = computeLineStarts(this.originalText);
		const decoded = decodeMappings(map.mappings);
		// Find source index for our original file (we only have one input source)
		const srcIndex = 0;
		// Collect all mapping points (generated offset -> source offset)
		const points: Array<{ gen: number; src: number }> = [];
		for (let gLine = 0; gLine < decoded.length; gLine++) {
			const segs = decoded[gLine];
			if (!segs) continue;
			for (const seg of segs) {
				if (seg.length < 4) continue;
				const gCol = seg[0] as number;
				const sIdx = seg[1] as number;
				const sLine = seg[2] as number;
				const sCol = seg[3] as number;
				if (sIdx !== srcIndex) continue;
				const genOffset = (generatedLineStarts[gLine] ?? 0) + gCol;
				const srcOffset = (sourceLineStarts[sLine] ?? 0) + sCol;
				points.push({ gen: genOffset, src: srcOffset });
			}
		}
		if (points.length === 0) {
			return [{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [Math.min(this.originalText.length, this.transformedText.length)],
				data: {
					completion: true,
					format: true,
					navigation: true,
					semantic: { shouldHighlight: () => false },
					structure: true,
					verification: true,
				},
			}];
		}
		points.sort((a, b) => a.gen - b.gen);
		let mappings: CodeMapping[] = [];
		for (let i = 0; i < points.length; i++) {
			const cur = points[i];
			const next = points[i + 1];
			const genEnd = next ? next.gen : this.transformedText.length;
			const srcEnd = next ? next.src : this.originalText.length;
			const genLen = Math.max(0, genEnd - cur.gen);
			const srcLen = Math.max(0, srcEnd - cur.src);
			const len = Math.min(genLen, srcLen);
			if (len <= 0) continue;
			mappings.push({
				sourceOffsets: [cur.src],
				generatedOffsets: [cur.gen],
				lengths: [len],
				data: {
					completion: true,
					format: true,
					navigation: true,
					semantic: { shouldHighlight: () => false },
					structure: true,
					verification: true,
				},
			});
		}
		// Add synthetic mappings for closing tag names to mirror opening tag hovers
		const pairs = collectJsxNamePairs(this.originalText);
		mappings = addClosingTagHoverMappings(mappings, pairs);
		return mappings;
	}

	// snapshot is provided in constructor and reflects transformed code
}

type JsxNamePair = { openStart: number; openEnd: number; closeStart: number; closeEnd: number };

function collectJsxNamePairs(code: string): JsxNamePair[] {
	const pairs: JsxNamePair[] = [];
	let ast: any;
	try {
		ast = babelParser.parse(code, {
			sourceType: 'module',
			plugins: ['typescript', 'jsx'],
			allowReturnOutsideFunction: false,
			allowAwaitOutsideFunction: false,
			errorRecovery: true,
		});
	} catch {
		return pairs;
	}
	const stack: any[] = [ast];
	while (stack.length) {
		const node = stack.pop();
		if (!node || typeof node !== 'object') continue;
		if (node.type === 'JSXElement') {
			const opening = node.openingElement;
			const closing = node.closingElement;
			if (
				opening?.name &&
				typeof opening.name.start === 'number' &&
				typeof opening.name.end === 'number' &&
				closing?.name &&
				typeof closing.name.start === 'number' &&
				typeof closing.name.end === 'number'
			) {
				pairs.push({
					openStart: opening.name.start,
					openEnd: opening.name.end,
					closeStart: closing.name.start,
					closeEnd: closing.name.end,
				});
			}
		}
		for (const key in node) {
			const value = (node as any)[key];
			if (Array.isArray(value)) {
				for (let i = 0; i < value.length; i++) stack.push(value[i]);
			} else if (value && typeof value === 'object') {
				stack.push(value);
			}
		}
	}
	return pairs;
}

function addClosingTagHoverMappings(mappings: CodeMapping[], pairs: JsxNamePair[]): CodeMapping[] {
	if (!pairs.length) return mappings;
	const result = mappings.slice();
	for (const p of pairs) {
		const closeLen = Math.max(0, p.closeEnd - p.closeStart);
		if (closeLen <= 0) continue;
		// Skip if closing already covered by any mapping
		const covered = result.some(m => {
			const s = m.sourceOffsets[0];
			const l = m.lengths[0];
			return p.closeStart >= s && p.closeStart < s + l;
		});
		if (covered) continue;
		// Find opening mapping and mirror its generated offset
		const openMap = result.find(m => {
			const s = m.sourceOffsets[0];
			const l = m.lengths[0];
			return p.openStart >= s && p.openStart < s + l;
		});
		if (!openMap) continue;
		const offsetInMap = p.openStart - openMap.sourceOffsets[0];
		const genOffset = openMap.generatedOffsets[0] + offsetInMap;
		result.push({
			sourceOffsets: [p.closeStart],
			generatedOffsets: [genOffset],
			lengths: [closeLen],
			data: {
				completion: true,
				format: true,
				navigation: true,
				semantic: { shouldHighlight: () => false },
				structure: true,
				verification: true,
			},
		});
	}
	return result;
}
function computeLineStarts(text: string): number[] {
	const starts: number[] = [0];
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i);
		if (ch === 13 /* \r */) {
			if (i + 1 < text.length && text.charCodeAt(i + 1) === 10 /* \n */) {
				starts.push(i + 2);
				i++;
			} else {
				starts.push(i + 1);
			}
		} else if (ch === 10 /* \n */) {
			starts.push(i + 1);
		}
	}
	return starts;
}

