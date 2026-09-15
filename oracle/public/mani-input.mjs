// Input feedback is independent of answer/playback state. Real input events
// cover typing, deletion, paste and composition without counting focus as input.
export function bindManiInput(fields, visual, platform=globalThis) {
  let timer=null;
  const clear=()=>{ platform.clearTimeout(timer);timer=null;visual.clearInput("typing"); };
  const pulse=()=>{ platform.clearTimeout(timer);visual.inputPulse("typing");timer=platform.setTimeout(clear,700); };
  const elements=[...fields];
  for(const field of elements) { field.addEventListener("input",pulse);field.addEventListener("blur",clear); }
  return { clear, destroy() { clear();for(const field of elements) { field.removeEventListener("input",pulse);field.removeEventListener("blur",clear); } } };
}
