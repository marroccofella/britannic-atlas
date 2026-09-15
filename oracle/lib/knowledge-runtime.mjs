// Application-owned facts, kept separate from retrieved page instructions.
export const KNOWLEDGE_ARCHITECTURE='Mannin has a persistent local SQLite knowledge ledger, FTS5 keyword search and a local vector index for semantic retrieval. This is retrieval-augmented generation: source text is retrieved for answers, not used to retrain the language model. Useful eligible public source passages read during conversations are saved with their exact citations, source links, read time and expiry, then synchronised to the vector index. Conversations are stored separately and are not automatically treated as factual evidence. Source-linked does not mean independently verified; model agreement cannot establish factual truth.';
export function knowledgeOnlyQuestion(value){
 const q=String(value||'').replace(/[’‘]/g,"'").trim();
 if(/\b(?:how (?:big|large|much)|what(?:'s| is) in|what do you have|where are|gaps|knowledge map)\b/i.test(q))return false;
 // "Is Tynwald in your knowledge base?" is about Tynwald, not the store.
 if(/^(?:is|are)\s+(?!(?:this|that|it|all this|what we discuss|everything|anything)\b).+\bin\s+(?:your|the)\s+(?:knowledge\s?base|ledger|database)\b/i.test(q))return false;
 if(!/\b(?:your|the|a) (?:knowledge\s?base|database)|\b(?:RAG|retrieval.augmented|vector (?:database|index))\b/i.test(q))return false;
 return q.split(/[.!?;]+/).map(s=>s.trim()).filter(Boolean).every(s=>/^(?:(?:and|also|please)\s+)*(?:(?:can|could) you (?:tell me|explain) (?:about )?|tell me (?:about )?|explain )?(?:(?:how|what|which|is|are|does|do)\b.*\b(?:knowledge\s?base|database|RAG|retrieval.augmented|vector (?:database|index))\b.*|(?:your|the) (?:knowledge\s?base|database)(?: and how (?:it|they) works?)?|how (?:does|do) (?:it|they) work|is (?:this|that|all this|what we discuss) (?:being |getting )?(?:saved|added|stored).*)$/i.test(s))
   && !/\b(?:history|archaeolog|monument|settlement|religion|tax|weather)\w*\b/i.test(q);
}
export function knowledgeRuntime(kb,retrieval){
 let index=null;try{index=retrieval?.stats?.()?.ledger||null;}catch{/* unavailable is not healthy */}
 return {architecture:KNOWLEDGE_ARCHITECTURE,records:kb.count(),index};
}
export function knowledgeSpeech(info){return info.architecture+(info.index?` At this check, ${info.index.indexed} of ${info.index.indexable} eligible source-linked records are indexed${info.index.missing||info.index.stale?'; the index needs attention.':'.'}`:' The vector-index status is unavailable for this check.');}
