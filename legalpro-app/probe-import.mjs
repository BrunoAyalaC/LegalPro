// Reproduce exactamente el import de vitest desde legalpro-app/
const m = await import('../../../tools/rag/retrieve.mjs');
console.log('import OK:', typeof m.retrieve, typeof m.buildAugmentedPrompt);
