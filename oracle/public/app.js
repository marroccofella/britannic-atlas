/* Mannin voice client: Web Speech recognition (en-GB) in, sentence-streamed speech out. */
import {mountActivityProgress,toolActivity} from './activity-progress.mjs';
import {renderReasoningCheck} from './reasoning-view.mjs';
import { assessSpeech } from "./speech.mjs";
import { bindQuestionComposer } from "./question-composer.mjs";
import { bindDiscovery } from "./discovery-bridge.mjs";
import { messageProblem, localConversation } from "./conversation-policy.mjs";
import { voiceOptions } from "./voice-options.mjs";
import { createManiVisual } from "./mani-visual.mjs";
import { bindManiInput } from "./mani-input.mjs";
import { createManiMicrophone } from "./mani-microphone.mjs";
import { createVoiceCapture } from "./voice-capture.mjs";
import { STATUSES, finiteNumber, safeExternalHref } from "./policy.mjs";
import {approvedPage} from './page-actions.mjs';
import {renderSourceAccess} from './source-access.mjs';
import { agentStyle, assignVoices, buildConversationScript, completionOrder, createConversationState, formatDuration, humanReviewerStatus, progressOf, reduceDeliberationEvent, usageLine, verdictWord } from "./momm-conversation.mjs";

(() => {
  const $ = (s) => document.querySelector(s);
  const orb = $("#orb"), orbLabel = $("#orbLabel"), heard = $("#heard"), liveStatus = $("#liveStatus"), transcript = $("#transcript"), tpl = $("#turnTpl");
  const maniVisual = createManiVisual(orb);
  // The Three Legs turning is the only visual sign that Mannin is working, so
  // the system's reduced-motion default must be overridable in both directions.
  const motionSelect = document.querySelector("#motionPreference");
  function applyMotionPreference(value) {
    const choice = value === "on" || value === "off" ? value : "auto";
    motionSelect.value = choice;
    maniVisual.setMotionPreference(choice);
    try { localStorage.setItem("oracle.motion", choice); } catch { /* storage unavailable */ }
  }
  motionSelect.onchange = () => applyMotionPreference(motionSelect.value);
  $("#enableMotion").onclick = () => applyMotionPreference("on");
  applyMotionPreference((() => { try { return localStorage.getItem("oracle.motion"); } catch { return "auto"; } })());
  const voiceSel = $("#voice"), rate = $("#rate"), conversation = $("#conversation"), speakLearned = $("#speakLearned"), health = $("#health");
  const wakeListening=$("#wakeListening"), wakeStatus=$("#wakeStatus");
  // Remember speaking pace; inaccessible or invalid storage keeps the default.
  try {
    const savedRate = Number(localStorage.getItem("oracle.rate"));
    if (Number.isFinite(savedRate) && savedRate >= .7 && savedRate <= 1.3) rate.value = String(savedRate);
  } catch { /* storage unavailable */ }
  rate.oninput = rate.onchange = () => {
    try { localStorage.setItem("oracle.rate", rate.value); } catch { /* storage unavailable */ }
  };
  if (!globalThis.crypto?.getRandomValues) {
    heard.textContent="This browser cannot create secure conversation IDs. Open Mannin in a current version of Chrome or Edge.";
    liveStatus.textContent=heard.textContent;
    document.querySelectorAll("button,input,textarea,select").forEach(control=>{control.disabled=true;});
    return;
  }
  const microphoneMeter = createManiMicrophone(maniVisual, globalThis, mode => {
    orb.dataset.maniInputSource = mode;
    if(orb.dataset.maniState==="listening" && mode==="microphone") setLiveStatus("Listening. The outline follows your voice level.");
    if(orb.dataset.maniState==="listening" && mode==="transcript") setLiveStatus("Listening. Voice-level glow is unavailable here; the outline follows recognised words.");
  });
  const typedActivity = bindManiInput(document.querySelectorAll("#askText, #speechDraft"),maniVisual);
  window.addEventListener("pagehide",()=>{typedActivity.clear();wantListening=false;stopListening({discard:true});});
  document.addEventListener("visibilitychange",()=>{if(document.hidden) {wantListening=false;stopListening({discard:true});setLiveStatus("Microphone paused while this tab is hidden. Any displayed draft is kept.");}else scheduleWake();});
  function secureRandomId(prefix) {
    const bytes = new Uint8Array(16);
    if (!globalThis.crypto?.getRandomValues) throw new Error("Secure browser randomness is unavailable.");
    globalThis.crypto.getRandomValues(bytes);
    return prefix + [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const newSessionId = () => secureRandomId("s_");
  let sessionId = (() => { try { return sessionStorage.getItem("oracle.session.v2") || localStorage.getItem("oracle.lastConversation") || newSessionId(); } catch { return newSessionId(); } })();
  function rememberSession() { try { sessionStorage.setItem("oracle.session.v2",sessionId); localStorage.setItem("oracle.lastConversation",sessionId); } catch { /* storage unavailable; the transcript remains in SQLite */ } }
  rememberSession();
  let historyReady = Promise.resolve(), historyCursor = null, historyGeneration = 0, navigationIntent = 0;
  const pendingConversationResets = new Map();
  let activeController = null, activeQuestion = "", activeTurnElement = null, responseGeneration = 0;
  const activeToolControllers = new Set();
  const pendingAsks = new Set();
  let searchQueue = Promise.resolve(), searchGeneration = 0;
  const pendingSearches = new Set();
  const renderedActions = new Map();
  const researchRecords = new Map();
  const MAX_DEFERRED_RESEARCH_SPEECH = 50;
  const deferredResearchSpeech = new Map();
  const announcedResearchSpeech = new Set();
  const completedResearchAnnouncements = new Set();
  let clientTurn = (() => { try { const value = Number(sessionStorage.getItem(`oracle.turn.${sessionId}`)); return Number.isSafeInteger(value) && value >= 0 ? value : 0; } catch { return 0; } })();
  function rememberClientTurn() { try { sessionStorage.setItem(`oracle.turn.${sessionId}`, String(clientTurn)); } catch { /* storage unavailable */ } }
  const newRequestId = () => secureRandomId("r_");
  function setLiveStatus(message, { echo=false } = {}) { liveStatus.textContent = String(message || ""); liveStatus.classList.toggle("activityEcho",echo); }
  const spokenProgress=$("#spokenProgress");
  try{spokenProgress.checked=localStorage.getItem('oracle.spokenProgress')!=='off';}catch{spokenProgress.checked=true;}
  spokenProgress.onchange=()=>{try{localStorage.setItem('oracle.spokenProgress',spokenProgress.checked?'on':'off');}catch{/* local preference only */}if(!spokenProgress.checked&&activeProgress)hush({cancelAnswer:false,preserveListening:true,clearDeferred:false});activity.render();};
  const activity=mountActivityProgress($('#activityProgress'),{announce:message=>setLiveStatus(message,{echo:true}),speak:text=>say(text,{progress:true}),speechOptions:()=>({enabled:spokenProgress.checked&&!speechBlocked,busy:speaking||speechQueue.length>0,hidden:document.hidden,listening:['starting','listening','finishing','wake'].includes(state)})});
  window.addEventListener('pagehide',()=>activity.clear());
  function noteActivity(id,event){activity.update(id,event);}
  function finishActivity(id,status){activity.finish(id,status);}

  function isCurrentResponse(generation, controller) {
    return generation === responseGeneration && activeController === controller && !controller.signal.aborted;
  }

  // ---------- speech synthesis: British male first ----------
  const PREFERRED = ["Ryan", "Thomas", "George", "Oliver", "Google UK English Male", "Daniel", "Arthur", "Alfie", "Brian", "Microsoft George"];
  let voices = [], voice = null;
  function rankVoice(v) {
    const gb = /en[-_]GB/i.test(v.lang) ? 0 : /^en/i.test(v.lang) ? 10 : 20;
    const idx = PREFERRED.findIndex((n) => v.name.includes(n));
    const female = /(Sonia|Libby|Maisie|Hazel|Susan|Kate|Female|Zira|Aria|Jenny|Google UK English Female)/i.test(v.name) ? 5 : 0;
    const natural = /Natural|Online/i.test(v.name) ? -1 : 0;
    return gb + (idx < 0 ? 4 : idx / 10) + female + natural;
  }
  function loadVoices() {
    voices = speechSynthesis.getVoices().slice().sort((a, b) => rankVoice(a) - rankVoice(b));
    if (!voices.length) return;
    let saved = null; try { saved = localStorage.getItem("oracle.voice"); } catch { /* storage unavailable */ }
    voice = voices.find((v) => v.name === saved) || voices.find(v=>v.name===voice?.name) || voices[0];
    voiceSel.innerHTML = "";
    for (const v of voiceOptions(voices,voice.name,{all:$("#allVoices")?.checked===true})) { const o = document.createElement("option"); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; voiceSel.appendChild(o); }
    voiceSel.value = voice.name;
  }
  $("#allVoices").onchange = loadVoices;
  speechSynthesis.onvoiceschanged = loadVoices; loadVoices();
  voiceSel.onchange = () => { voice = voices.find((v) => v.name === voiceSel.value) || voice; try { localStorage.setItem("oracle.voice", voice.name); } catch { /* storage unavailable */ } readAloud("Very good. I shall use this voice."); };

  const speechQueue = [];
  const playbackHooks = new Set(); // called whenever speech is cut off, so lane highlights never go stale
  let speaking = false, playbackActive = false, speechGeneration = 0, activeUtterance = null, drainHook = null, wantListening = false;
  let speechStartTimer = null, speechBlocked = false, activeProgress = false;
  // opts may carry a per-line voice, pitch and rate (the MOMM conversation gives
  // each model its own British voice) plus onstart/onend hooks for highlighting.
  function say(text, opts = {}) { if (!text) return; if (speechBlocked) { opts.onerror?.(); return; } speechQueue.push({ text, ...opts }); pumpSpeech(); }
  function pumpSpeech() {
    if (speaking || !speechQueue.length) { if (!speaking && !speechQueue.length) onSpeechDrained(); return; }
    if(typeof voiceCapture!=="undefined" && voiceCapture.mode!=="off")stopListening({discard:true});
    const item = speechQueue.shift(); activeProgress=Boolean(item.progress);
    const u = new SpeechSynthesisUtterance(item.text);
    const chosen = item.voice || voice;
    if (chosen) u.voice = chosen;
    u.lang = "en-GB"; u.rate = Number(rate.value) * (Number(item.rate) || 1); u.pitch = Number.isFinite(Number(item.pitch)) ? Number(item.pitch) : 0.95;
    const generation = speechGeneration;
    activeUtterance = u; speaking = true;
    const isCurrent = () => generation === speechGeneration && activeUtterance === u;
    let playbackStarted = false;
    const markPlaying = () => {
      if (!isCurrent() || playbackStarted || speechSynthesis.paused) return;
      playbackStarted = true; playbackActive = true;
      setState("speaking"); maniVisual.beginSpeech({text:item.text,rate:u.rate}); item.onstart?.();
    };
    const finish = () => {
      if (!isCurrent()) return;
      clearTimeout(speechStartTimer); speechStartTimer = null;
      activeUtterance = null; speaking = false; playbackActive = false; activeProgress = false;
      maniVisual.setState("idle"); item.onend?.(); pumpSpeech(); refreshActivityState();
    };
    const fail = () => {
      if (!isCurrent()) return;
      clearTimeout(speechStartTimer); speechStartTimer = null;
      activeUtterance = null; speaking = false; playbackActive = false; activeProgress = false; speechBlocked = true;
      const abandoned = speechQueue.splice(0);
      try { speechSynthesis.cancel(); } catch { /* voice service unavailable */ }
      item.onerror?.(); for (const pending of abandoned) pending.onerror?.();
      for (const hook of playbackHooks) hook(); playbackHooks.clear();
      drainHook = null; refreshActivityState();
      const retryVoice=$("#retryVoice");if(retryVoice)retryVoice.hidden=false;
      setLiveStatus("Voice playback failed. Select Enable voice feedback to retry, or choose another voice in settings. Your text remains available.");
      if(typeof resumeIfConversation==="function")resumeIfConversation();
    };
    u.onstart = markPlaying;
    u.onboundary = (event) => { if (isCurrent() && !speechSynthesis.paused) { markPlaying(); maniVisual.speechBoundary(event); } };
    u.onpause = () => { if (isCurrent() && speechSynthesis.paused) setState("paused"); };
    u.onresume = () => { if (isCurrent() && !speechSynthesis.paused) { markPlaying(); setState("speaking"); } };
    u.onend = finish; u.onerror = fail;
    // Keep a generation-bound watchdog after startup: some voices omit end.
    let probes = 0, silentProbes = 0;
    const probePlayback = () => {
      speechStartTimer = null;
      if (!isCurrent()) return;
      if (speechSynthesis.paused) { speechStartTimer = setTimeout(probePlayback, 150); return; }
      if (playbackStarted) {
        if (!speechSynthesis.speaking && !speechSynthesis.pending) { if (++silentProbes >= 3) { finish(); return; } }
        else silentProbes = 0;
      // "speaking" can be true while a remote voice is only buffering.
      // Only utterance start/boundary/resume events confirm playback.
      } else if (++probes >= 60) { fail(); return; }
      speechStartTimer = setTimeout(probePlayback, 150);
    };
    speechStartTimer = setTimeout(probePlayback, 150);
    try { if (speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); }
    catch { fail(); }
  }
  // cancelTools: abort the fetches watching paid server work (reviews,
  // canvases). Only an explicit Stop does that; a new question or opening
  // another conversation leaves them to finish and save.
  function hush({ cancelAnswer = true, preserveListening = false, clearDeferred = cancelAnswer, cancelTools = false } = {}) {
    typedActivity.clear();maniVisual.clearInput();
    speechGeneration += 1;
    speechBlocked = false;
    const retryVoice=$("#retryVoice");if(retryVoice)retryVoice.hidden=true;
    if (clearDeferred) deferredResearchSpeech.clear();
    clearTimeout(speechStartTimer); speechStartTimer = null;
    if (activeUtterance) {
      for (const event of ["onstart", "onboundary", "onpause", "onresume", "onend", "onerror"]) activeUtterance[event] = null;
      activeUtterance = null;
    }
    activeProgress=false;
    speechQueue.length = 0; speechSynthesis.cancel(); speaking = false; playbackActive = false;
    maniVisual.setState("idle");
    for (const hook of playbackHooks) hook();
    playbackHooks.clear();
    drainHook = null;
    if (!preserveListening) { wantListening = false; stopListening({discard:true}); }
    if (cancelAnswer) {
      searchGeneration += 1;
      pendingSearches.clear();
      for(const pending of pendingAsks)if(typeof activity!=='undefined')activity.finish(pending.activityId,'stopped');
      pendingAsks.clear();
      responseGeneration += 1;
      if (cancelTools) {
        for (const controller of activeToolControllers) controller.abort();
        activeToolControllers.clear();
      }
      if (activeController) {
        activeController.abort();
        if (activeTurnElement) markIncomplete(activeTurnElement, "Stopped — this answer is incomplete.");
        activeController = null; activeQuestion = ""; activeTurnElement = null;
      }
    }
    if (state === "speaking" || state === "thinking" || state === "paused") setState("idle");
    if (!cancelAnswer) refreshActivityState();
  }
  function onSpeechDrained() {
    refreshActivityState();
    // Research may finish while the user is talking or another answer is being
    // read. Keep the optional update until the audio channel is genuinely free.
    if (flushDeferredResearchSpeech()) return;
    const h = drainHook; drainHook = null; h?.();
    if(typeof scheduleWake==="function")scheduleWake();
  }

  // ---------- state ----------
  let state = "idle";
  function refreshActivityState() {
    if (state === "starting" || state === "listening" || state === "finishing" || state === "wake") return;
    if (playbackActive && activeUtterance) {
      if (speechSynthesis.paused) setState("paused");
      else setState("speaking");
      return;
    }
    const researchBusy=[...researchRecords.values()].some(record=>record.sessionId===sessionId && ["queued","running","cancelling"].includes(record.status));
    setState(activeController || activeToolControllers.size || pendingAsks.size || researchBusy || speaking || speechQueue.length ? "thinking" : "idle");
  }
  function setState(s) {
    const previous = state;
    state = s; orb.className = `orb ${s}`;
    maniVisual.setState(s);
    orbLabel.textContent = { idle: "Tap to speak", wake: "Say Hey Mannin", starting: "Opening mic · cancel", listening: "Listening · tap to send", finishing: "Finishing voice · cancel", thinking: "Working · interrupt", speaking: "Speaking · interrupt", paused: "Paused · tap to speak" }[s];
    const consolePanel=$("#voiceConsole"), consoleState=$("#voiceConsoleState");
    if(consolePanel)consolePanel.dataset.state=s;
    if(consoleState)consoleState.textContent={idle:"READY",wake:"WAKE MIC ON",starting:"CONNECTING",listening:"LISTENING",finishing:"FINISHING",thinking:"THINKING",speaking:"MANNIN SPEAKING",paused:"PAUSED"}[s] || "READY";
    orb.setAttribute("aria-pressed", String(s === "listening" || s === "starting"));
    orb.setAttribute("aria-label", s === "finishing" ? "Cancel voice processing" : s === "starting" ? "Cancel microphone opening" : s === "listening" ? "Stop listening" : s === "speaking" || s === "thinking" ? "Interrupt and speak" : "Start listening");
    if (s === "thinking" && previous !== s) { const active=activity.snapshot().filter(t=>!t.terminal);setLiveStatus(active.length?active.map(t=>t.title+(t.note?". "+t.note:"")).join(" "):"Mannin is working. Activate Interrupt and speak to take over.",{echo:active.length>0}); }
    if (s === "speaking" && previous !== s) setLiveStatus("Mannin is speaking. Activate Interrupt and speak to take over.");
    if (s === "paused" && previous !== s) setLiveStatus("Speech paused. Resume playback or ask another question.");
    if (s === "idle" && previous !== s && !activity.snapshot().some(t=>!t.terminal)) setLiveStatus("Ready. You can ask another question or read a saved result aloud.");
    if(s==="idle" && typeof scheduleWake==="function")scheduleWake();
  }

  // ---------- speech recognition ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, restartTimer = null;
  const speechConfirm = $("#speechConfirm"), speechDraft = $("#speechDraft");
  let pendingSpeechConfidence = null;
  function closeSpeechConfirm() { speechConfirm.classList.add("hidden"); pendingSpeechConfidence = null; }
  function confirmSpeech(text, confidence) {
    // Never reopen the microphone behind a confirmation panel.
    clearTimeout(restartTimer); wantListening = false; stopListening();
    pendingSpeechConfidence = confidence;
    speechDraft.value = text;
    speechConfirm.classList.remove("hidden");
    heard.textContent = "Please check what I heard before I send it.";
    speechDraft.focus(); speechDraft.select();
  }
  $("#useSpeech").onclick = () => {
    const text = speechDraft.value.trim(); if (!text) return;
    const confidence = pendingSpeechConfidence;
    const resumeAfterAnswer = conversation.checked;
    closeSpeechConfirm(); wantListening = resumeAfterAnswer;
    ask(text, { source: "speech", recognitionConfidence: confidence, confirmed: true });
  };
  $("#retrySpeech").onclick = () => { closeSpeechConfirm(); wantListening = true; startListening(); };
  $("#cancelSpeech").onclick = () => { closeSpeechConfirm(); wantListening = false; heard.textContent = "Cancelled. We’re still focused on the Isle of Man.";scheduleWake(); };
  if (!SR) {
    heard.textContent = "This browser has no speech recognition. Use Chrome or Edge, or type below.";
    orb.disabled = true; orbLabel.textContent = "Type a question below";
    wakeListening.disabled=true;
  }
  const voiceCapture = createVoiceCapture({
    Recognition: SR,
    onActive: current => { rec=current; },
    onMeter: enabled => { if(enabled) void microphoneMeter.start(); else microphoneMeter.stop(); },
    onState: next => { setState(next); if(next==="idle")afterCaptureStops(); },
    onStatus: message => { setLiveStatus(message); if(voiceCapture.mode==="wake")wakeStatus.textContent=message; },
    onWake: () => { wantListening=true;heard.textContent="I’m here. What would you like to know?";wakeStatus.textContent="Awake · capturing your question"; },
    onInput: kind => { if(kind==="pause")maniVisual.inputPause("speech");else maniVisual.inputPulse("speech"); },
    onDraft: ({final,interim}) => {
      // Keep recognised words stable while the browser revises its live hypothesis.
      // Render literal text immediately: no scramble, typewriter delay or extra speech.
      let settled=heard.querySelector('.final'), pending=heard.querySelector('.interim');
      const followEnd=heard.scrollHeight-heard.scrollTop-heard.clientHeight<32;
      if(!settled || !pending){
        settled=document.createElement('span');pending=document.createElement('span');
        settled.className='final';pending.className='interim';heard.replaceChildren(settled,pending);
      }
      if(settled.textContent!==final)settled.textContent=final;
      const draft=(final && interim ? ' ' : '')+interim;
      if(pending.textContent!==draft)pending.textContent=draft;
      if(followEnd)heard.scrollTop=heard.scrollHeight;
    },
    onSubmit: ({text,confidence,needsConfirmation}) => {
      const assessment=assessSpeech(text,confidence);
      heard.textContent=assessment.repaired ? `I heard “${assessment.original}” — understood as “${assessment.suggested}”.` : assessment.original;
      if(needsConfirmation || assessment.needsConfirmation)confirmSpeech(assessment.suggested,assessment.confidence);
      else void ask(assessment.original,{source:"speech",recognitionConfidence:assessment.confidence});
    },
    onFatal: () => { wakeListening.checked=false;wantListening=false;clearTimeout(restartTimer);wakeStatus.textContent="Wake listening stopped · click to retry"; },
  });
  function afterCaptureStops() {
    refreshActivityState();
    // Let a submitted question claim the channel before reading a deferred update.
    queueMicrotask(()=>{if(voiceCapture.mode==="off")flushDeferredResearchSpeech();});
  }
  function scheduleWake() {
    clearTimeout(restartTimer);
    if(!wakeListening.checked || pendingSearches.size || rec || speaking || speechQueue.length || state!=="idle" || document.hidden || !speechConfirm.classList.contains("hidden") || $("#conversationWorkspace").hidden)return;
    // A quiet tail prevents the microphone from treating the end of our reply as input.
    restartTimer=setTimeout(()=>{
      if(wakeListening.checked && !pendingSearches.size && !rec && !speaking && state==="idle" && !document.hidden && speechConfirm.classList.contains("hidden") && !$("#conversationWorkspace").hidden)voiceCapture.start("wake");
    },800);
  }
  function disableWake() {
    wakeListening.checked=false;clearTimeout(restartTimer);
    wakeStatus.textContent="Wake listening off · click to speak";
  }
  wakeListening.onchange=()=>{
    clearTimeout(restartTimer);
    if(!wakeListening.checked){if(voiceCapture.mode==="wake")stopListening({discard:true});wakeStatus.textContent="Wake listening off · click to speak";return;}
    wakeStatus.textContent="Wake listening enabled · waiting for a quiet moment";
    if(!SR){disableWake();return;}
    scheduleWake();
  };
  conversation.onchange=()=>{
    wantListening=conversation.checked;
    if(!conversation.checked) {
      clearTimeout(restartTimer);
      if(voiceCapture.mode==="capture")stopListening({discard:true});
      scheduleWake();
    } else if(!document.hidden && speechConfirm.classList.contains("hidden"))resumeIfConversation();
  };
  function startListening() {
    if(document.hidden || !SR || (rec && voiceCapture.mode!=="wake"))return;
    if(activeProgress)hush({cancelAnswer:false,preserveListening:true,clearDeferred:false});
    clearTimeout(restartTimer);pendingAsks.clear();searchGeneration += 1;pendingSearches.clear();
    heard.textContent="Listening…";
    voiceCapture.start("capture");
  }
  function stopListening({awaitFinal=false,discard=false}={}) {
    clearTimeout(restartTimer);
    voiceCapture.stop({awaitFinal,discard});
    maniVisual.clearInput("speech");
    if(wakeListening.checked)wakeStatus.textContent=document.hidden ? "Wake listening paused · tab hidden" : "Wake listening paused";
  }
  function resumeIfConversation() {
    if(pendingSearches.size)return;
    if(wakeListening.checked){scheduleWake();return;}
    if(conversation.checked && wantListening && !speaking && state==="idle")startListening();
  }
  function canSpeakBackgroundUpdate() {
    return speakLearned.checked && !speechBlocked && !rec && !speaking && !activeController && !activeToolControllers.size && !pendingAsks.size && !["starting", "listening", "finishing", "paused"].includes(state) && speechQueue.length === 0;
  }
  function deferResearchSpeech(id, text) {
    const key = String(id || ""), message = cleanText(text, 3000);
    if (!speakLearned.checked || !key || !message || announcedResearchSpeech.has(key) || deferredResearchSpeech.has(key)) return;
    if (deferredResearchSpeech.size >= MAX_DEFERRED_RESEARCH_SPEECH) { setLiveStatus("More research results are ready. Use Read aloud on a result to hear it."); return; }
    deferredResearchSpeech.set(key, { message });
    flushDeferredResearchSpeech();
  }
  function flushDeferredResearchSpeech() {
    if (!canSpeakBackgroundUpdate() || !deferredResearchSpeech.size) return false;
    const [id, item] = deferredResearchSpeech.entries().next().value;
    deferredResearchSpeech.delete(id);
    say(item.message, { onend: () => announcedResearchSpeech.add(id) });
    return true;
  }
  speakLearned.onchange = () => {
    try { localStorage.setItem("oracle.readResearch", String(speakLearned.checked)); } catch { /* storage unavailable */ }
    if (speakLearned.checked) flushDeferredResearchSpeech();
    else deferredResearchSpeech.clear();
  };
  try { speakLearned.checked = localStorage.getItem("oracle.readResearch") !== "false"; } catch { speakLearned.checked = true; }
  function readAloud(text) {
    hush({ cancelAnswer: false });
    say(cleanText(text, 12000));
  }
  $("#retryVoice").onclick=()=>{
    spokenProgress.checked=true;
    try{localStorage.setItem('oracle.spokenProgress','on');}catch{/* current visit still works */}
    hush({cancelAnswer:false,preserveListening:true,clearDeferred:false});
    say("Voice feedback is on. I’ll speak short updates while I work.",{progress:true});
    activity.render();
  };
  function bargeIn() {
    const recognitionIsActive = Boolean(rec) && voiceCapture.mode==="capture";
    hush({ preserveListening: true });
    wantListening = true;
    heard.textContent = "Interrupted. I’m listening.";
    setLiveStatus("Interrupted. The previous answer is incomplete. Listening for you.");
    if (recognitionIsActive) setState("listening");
    else startListening();
  }

  orb.onclick = () => {
    if (state === "finishing") { wantListening=false;stopListening({discard:true});setLiveStatus("Voice processing cancelled."); }
    else if (state === "listening" || state === "starting") { wantListening = false; stopListening({awaitFinal:true}); setLiveStatus(state==="finishing" ? "Processing what you said…" : "Listening stopped."); }
    else if (speaking || activeController || activeToolControllers.size) bargeIn();
    else { wantListening = true; startListening(); }
  };
  function isEditableTarget(target) { return target instanceof Element && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']")); }
  let spaceHeld = false;
  window.addEventListener("keydown", (e) => {
    // Escape in a text field or a dropdown is editing, not a request to stop paid work.
    if (e.code === "Escape" && !isEditableTarget(e.target)) stopRequestedWork();
    if (e.code === "Space" && !$("#conversationWorkspace").hidden && !spaceHeld && !isEditableTarget(e.target)) { spaceHeld = true; e.preventDefault(); if (speaking || activeController || activeToolControllers.size) bargeIn(); else { wantListening = true; startListening(); } }
  });
  window.addEventListener("keyup", (e) => { if (e.code === "Space" && spaceHeld) { spaceHeld = false; e.preventDefault(); stopListening({awaitFinal:true}); } });
  function stopRequestedWork(){
    disableWake();hush({cancelTools:true});
    void postJson('/api/tools/stop',{sessionId}).then(()=>setLiveStatus('Stop requested for this conversation’s active work.')).catch(()=>setLiveStatus('Could not confirm that server work stopped. Check its saved status.'));
  }
  $("#stop").onclick = stopRequestedWork;

  // ---------- asking ----------
  bindQuestionComposer({ form: $("#askForm"), input: $("#askText"), counter: $("#askCount"), error: $("#askError"), onSubmit: question => ask(question) });
  bindDiscovery({ input: $("#askText"), setStatus: setLiveStatus, onExplore: () => { spaceHeld = false; wantListening = false; disableWake();stopListening({discard:true}); refreshActivityState(); } });
  let lastResolvedQuestion = "";
  const turns = new Map(); // episodeId -> element
  document.querySelectorAll("[data-question]").forEach((button) => { button.onclick = () => ask(button.dataset.question); });
  function clearConversationView() {
    document.querySelector("#researchNotice")?.remove();
    lastResolvedQuestion = ""; turns.clear(); renderedActions.clear(); researchRecords.clear(); deferredResearchSpeech.clear(); announcedResearchSpeech.clear(); completedResearchAnnouncements.clear(); transcript.replaceChildren(); closeSpeechConfirm();
    for (const entry of deliberations.values()) { stopConversationPlayback(entry); clearInterval(entry.timer); }
    deliberations.clear();
    $("#focus").replaceChildren(); $("#coverage").textContent = "";
  }
  async function refreshConversationList() {
    const response = await fetch("/api/conversations",{cache:"no-store"});
    if (!response.ok) throw new Error("Saved conversations are unavailable");
    const payload = await response.json();
    const select = $("#conversationHistory"); select.replaceChildren();
    for (const row of payload.conversations || []) {
      const option = document.createElement("option"); option.value=row.id;
      option.textContent=`${row.title} · ${row.turn_count} messages`; select.append(option);
    }
    if (![...select.options].some(option=>option.value===sessionId)) {
      const option=document.createElement("option"); option.value=sessionId; option.textContent="New conversation"; select.prepend(option);
    }
    select.value=sessionId;
  }
  function renderSavedTurn(row, before = transcript.firstElementChild) {
    if ([...transcript.children].some(el=>el.dataset.requestId===row.id)) return;
    const recovered = row.metadata?.expedition?.id ? turns.get(`expedition:${row.metadata.expedition.id}`) : null;
    const el=recovered?.classList.contains("researchReturn") ? recovered : tpl.content.firstElementChild.cloneNode(true);
    el.classList.remove("researchReturn");
    el.dataset.requestId=row.id; el.dataset.question=row.resolved_question || row.question;
    el.querySelector(".q").textContent=row.question;
    el.querySelector(".a").textContent=String(row.answer || "").replace(/\[c_[a-z0-9]+\]/g,"");
    transcript.insertBefore(el,before);
    const metadata=row.metadata || {};
    if (metadata.meta) handle("meta",metadata.meta,el,null,null,true);
    else if (row.episode_id) handle("meta",{...metadata,episodeId:row.episode_id,resolvedQuestion:row.resolved_question,jurisdiction:row.jurisdiction},el,null,null,true);
    if (metadata.interpretation) handle("interpretation",metadata.interpretation,el,null,null,true);
    if (metadata.action && metadata.action.kind !== "generate_canvas") handle("action",metadata.action,el,null,null,true);
    if (metadata.expedition?.id) { el.dataset.expedition=metadata.expedition.id; turns.set(`expedition:${metadata.expedition.id}`,el); }
    if (row.reviewResult) restoreReview(el,row.reviewResult);
    if (row.canvasResult?.ok) renderCanvasWorkspace(el,row.canvasResult.spec,row.canvasResult.narration);
    else if (metadata.action?.kind === "generate_canvas" && metadata.action.actionId) {
      // The request is on record server-side; offer to (re)generate it here
      // instead of asking the user to ask again.
      const panel = el.querySelector(".canvasWorkspace");
      if (panel) {
        const failed = row.canvasResult?.phase === "failed";
        panel.replaceChildren();
        appendTextElement(panel, "p", failed
          ? `The visual for this answer was not completed: ${cleanText(row.canvasResult.narration || row.canvasResult.reason, 300) || "no reason was recorded"}.`
          : "The visual for this answer was not generated before the page was reloaded.", "muted");
        const button = document.createElement("button"); button.type = "button"; button.textContent = failed ? "Try the visual again" : "Generate the visual";
        button.onclick = () => { void generateCanvasFromAction(el, metadata.action.actionId, responseGeneration); };
        panel.append(button); panel.classList.remove("hidden");
      }
    }
    if (row.status !== "complete") markIncomplete(el,row.status === "processing" ? "This answer is still running in another window. Reopen this conversation to refresh it." : "This answer was interrupted before it finished.");
  }
  async function restoreConversation(id, {older=false} = {}) {
    if(!older)activity.clear();
    const generation=++historyGeneration;
    $("#historyStatus").textContent=older ? "Loading earlier messages…" : "Opening conversation…";
    try {
      const response=await fetch(`/api/conversation?sessionId=${encodeURIComponent(id)}&optional=1${older && historyCursor ? `&before=${historyCursor}` : ""}`,{cache:"no-store"});
      if (response.status===404) { if(id===sessionId && generation===historyGeneration) { $("#historyStatus").textContent="Saved on this computer after your first message."; await syncResearch(); } return; }
      if (!response.ok) throw new Error("Could not restore this conversation");
      const result=await response.json();
      if (id!==sessionId || generation!==historyGeneration) return;
      if(!result.conversation){$("#historyStatus").textContent="Saved on this computer after your first message.";await syncResearch();return;}
      // The database remains chronological. Reverse presentation in the DOM,
      // including older pages, so keyboard and screen-reader order agree.
      const rows=older ? [...(result.turns || [])].reverse() : result.turns || [];
      for(const row of rows) renderSavedTurn(row,older ? null : undefined);
      historyCursor=result.before;
      $("#olderTurns").classList.toggle("hidden",!historyCursor);
      clientTurn=Math.max(clientTurn,result.lastClientTurn || 0); rememberClientTurn();
      if (!older) {
        lastResolvedQuestion=result.conversation?.dialogue?.lastSubstantiveQuestion || "";
        $("#conversationTitle").textContent=result.conversation.title;
        await syncResearch();
      }
      if(id===sessionId) $("#historyStatus").textContent="Saved on this computer";
    } catch(error) { if(id===sessionId) $("#historyStatus").textContent=error.message; }
    finally { await refreshConversationList().catch(()=>{}); }
  }
  async function openConversation(id) {
    const oldSession = sessionId;
    const previousReset=pendingConversationResets.get(oldSession);
    const requestedReset=fetch("/api/session/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: oldSession }) }).catch(() => {});
    const reset=Promise.all([previousReset,requestedReset]).finally(()=>{if(pendingConversationResets.get(oldSession)===reset) pendingConversationResets.delete(oldSession);});
    pendingConversationResets.set(oldSession,reset);
    hush(); sessionId=id; clientTurn=0; historyCursor=null; rememberSession();
    clearConversationView();
    $("#olderTurns").classList.add("hidden");
    $("#conversationTitle").textContent="What would you like to know?";
    heard.textContent="Continue this conversation, or ask a new question.";
    await pendingConversationResets.get(id);
    if(sessionId!==id) return;
    await restoreConversation(id);
    if(sessionId===id) connectResearchEvents();
  }
  $("#newConversation").onclick = () => {
    const intent=++navigationIntent;
    historyReady=(async()=>{
      try { const result=await postJson("/api/conversations",{}); if(intent!==navigationIntent) return; await openConversation(result.conversation.id); if(intent===navigationIntent) setLiveStatus("New Manx conversation ready. Your previous chat is saved in history."); }
      catch(error) { if(intent===navigationIntent) $("#historyStatus").textContent=error.message; }
    })();
  };
  $("#conversationHistory").onchange=event=>{ navigationIntent++; historyReady=openConversation(event.target.value); };
  $("#olderTurns").onclick=()=>{ historyReady=restoreConversation(sessionId,{older:true}); };
  $("#deeper").onclick = () => {
    if (!lastResolvedQuestion) return say("Let me finish a useful answer first, then I can go deeper on it.");
    ask("Go deeper on what you suggested");
  };
  $("#dream").onclick = async () => {
    try {
      const r = await postJson("/api/dream", { sessionId });
      say(r.queued ? `I shall go and think about this: ${r.target.question.slice(0, 140)}` : `Nothing to dream about: ${r.reason}.`);
    } catch (err) { heard.textContent = `Could not start a research check: ${err.message}`; }
  };

  async function postJson(url, body, { signal } = {}) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `request failed (${response.status})`);
    return payload;
  }

  function markIncomplete(el, message, announce = true) {
    el.classList.add("incomplete");
    const note = el.querySelector(".note");
    note.textContent = message;
    note.classList.add("incomplete");
    note.classList.remove("hidden");
    if (announce) setLiveStatus(message);
  }

  function safeMapWorkspaceHref(value) {
    if (typeof value !== "string" || value.length > 500) return null;
    try {
      const url = new URL(value, location.origin);
      const trustedOrigin = url.origin === location.origin || url.origin === "https://britannica-atlas.marroccofella.chatgpt.site";
      return url.protocol === "https:" || url.origin === location.origin
        ? trustedOrigin && /^\/manx\/earth\/?$/.test(url.pathname) ? url.href : null
        : null;
    } catch { return null; }
  }

  function safeOsmMapHref(value) {
    const href = safeExternalHref(value);
    if (!href || href.length > 500) return null;
    try {
      const url = new URL(href);
      if (url.protocol !== "https:" || url.hostname !== "www.openstreetmap.org" || url.pathname !== "/search") return null;
      if (!url.searchParams.get("query") || [...url.searchParams.keys()].some((key) => key !== "query")) return null;
      return url.href;
    } catch { return null; }
  }

  const MAP_PROVIDER_ALLOWLIST = Object.freeze({
    "manx-earth": Object.freeze({ label: "MANX Earth", href: "https://britannica-atlas.marroccofella.chatgpt.site/manx/earth" }),
    "iom-government": Object.freeze({ label: "Isle of Man Government maps", href: "https://www.gov.im/maps" }),
    openstreetmap: Object.freeze({ label: "OpenStreetMap", href: "https://www.openstreetmap.org/search?query=Isle%20of%20Man" }),
    "google-maps": Object.freeze({ label: "Google Maps", href: "https://www.google.com/maps/search/?api=1&query=Isle+of+Man" }),
    "google-earth": Object.freeze({ label: "Google Earth", href: "https://earth.google.com/web?hl=en-GB" }),
  });

  function safeMapProvider(value) {
    if (!value || typeof value !== "object" || typeof value.id !== "string") return null;
    const trusted = MAP_PROVIDER_ALLOWLIST[value.id];
    return trusted && value.label === trusted.label && value.href === trusted.href ? trusted : null;
  }

  function appendMapProviders(parent, values, fallbackHref) {
    const providers = (Array.isArray(values) ? values : []).map(safeMapProvider).filter(Boolean);
    const unique = [...new Map(providers.map((provider) => [provider.href, provider])).values()];
    if (!unique.length && fallbackHref) unique.push({ label: "MANX Earth", href: fallbackHref });
    if (!unique.length) return;
    const heading = document.createElement("span"); heading.textContent = "Choose a trusted map:";
    const list = document.createElement("ul"); list.className = "mapProviders";
    for (const provider of unique) {
      const item = document.createElement("li"), link = document.createElement("a");
      link.href = provider.href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = provider.label;
      item.appendChild(link); list.appendChild(item);
    }
    parent.append(heading, list);
  }

  function actionIdentity(action) {
    if (action.artifact?.id === "manx-map") return "artifact|manx-map";
    if (action.kind === "open_full_map" && safeMapWorkspaceHref(action.href)) return "artifact|manx-map";
    const supplied = typeof action.actionId === "string" && /^[a-z0-9_.:-]{1,200}$/i.test(action.actionId) ? action.actionId : "";
    if (supplied) return `${String(action.kind || "action")}|${supplied}`;
    const destination = action.kind === "show_external_map" ? safeOsmMapHref(action.href) : safeMapWorkspaceHref(action.fullHref);
    return `${String(action.kind || "unknown")}|${destination || String(action.title || "").slice(0, 120)}`;
  }

  function renderManxMapCard(card, action, { capability = false } = {}) {
    const img = document.createElement("img"); img.src = "/manx-map.svg"; img.alt = "Diagrammatic map of the Isle of Man, its main towns, the Calf and nearby rocks";
    const body = document.createElement("div");
    const title = document.createElement("strong"); title.textContent = action.title || "Isle of Man map";
    const note = document.createElement("span");
    note.textContent = capability
      ? "Mannin displayed this bundled diagram. It cannot inspect your screen, and the diagram is not navigation-grade."
      : "Diagrammatic orientation — not for navigation.";
    const fullHref = safeMapWorkspaceHref(action.fullHref);
    body.append(title, note); appendMapProviders(body, action.providers, fullHref);
    card.replaceChildren(img, body); card.classList.remove("hidden");
  }

  function claimActionCard(action, turn) {
    const key = actionIdentity(action);
    const existing = renderedActions.get(key);
    if (existing?.isConnected) {
      existing.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const note = turn.querySelector(".note");
      note.textContent = "That map is already open in this conversation.";
      note.classList.remove("hidden");
      setLiveStatus("The requested map is already open.");
      return null;
    }
    const card = turn.querySelector(".action");
    renderedActions.set(key, card);
    return card;
  }

  function cleanText(value, max = 800) {
    if (typeof value !== "string") return "";
    const text = [...value.normalize("NFKC")]
      .filter((character) => { const code = character.charCodeAt(0); return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127); })
      .join("").replace(/\s+/g, " ").trim();
    return text.length > max ? text.slice(0, Math.max(0,max - 1)).trimEnd() + "…" : text;
  }

  function appendTextElement(parent, tag, text, className = "", max = 800) {
    const value = cleanText(text, max);
    if (!value) return null;
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value;
    parent.appendChild(node);
    return node;
  }

  function renderReviewSummary(turn, review, result = {}) {
    const panel = turn.querySelector(".reviewSummary");
    panel.replaceChildren();
    appendTextElement(panel, "h3", "MOMM review");
    const status = document.createElement("div");
    status.className = "reviewStatus";
    const safeStatus = cleanText(result.status, 60);
    if (safeStatus) status.appendChild(badge(safeStatus, STATUSES.includes(safeStatus) ? safeStatus : ""));
    const confidence = (typeof result.confidence==='number' || typeof result.confidence==='string' && result.confidence.trim()) ? Number(result.confidence) : NaN;
    if (Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) status.appendChild(badge(`confidence ${Math.round(confidence * 100)}%`));
    const rawAgreement = (typeof review?.agreement==='number' || typeof review?.agreement==='string' && review.agreement.trim()) ? Number(review.agreement) : NaN;
    const agreementRatio = Number.isFinite(rawAgreement) && rawAgreement >= 0 && rawAgreement <= 100
      ? rawAgreement > 1 ? rawAgreement / 100 : rawAgreement
      : null;
    const agreement = agreementRatio == null ? cleanText(review?.agreement, 80) : `agreement ${Math.round(agreementRatio * 100)}%`;
    if (agreement) status.appendChild(badge(agreement));
    if (status.childNodes.length) panel.appendChild(status);

    if (cleanText(result.answer, 6000)) {
      appendTextElement(panel, "h4", "Considered answer");
      appendTextElement(panel, "p", cleanText(result.answer, 6000), "", 6000);
      if (result.evidenceChanged) appendTextElement(panel, "p", "This wording changed materially. Reviewer agreement is not source evidence, so this considered answer remains marked not source-verified until its new claims are checked.", "canvasError");
    }
    const corrections = Array.isArray(result.corrections) ? result.corrections.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 8) : [];
    if (corrections.length) {
      appendTextElement(panel, "h4", "What changed");
      const list = document.createElement("ul"); list.className = "reviewPoints";
      for (const correction of corrections) appendTextElement(list, "li", correction);
      panel.appendChild(list);
    }
    if (cleanText(review?.summary, 2000)) {
      appendTextElement(panel, "h4", "Review summary");
      appendTextElement(panel, "p", cleanText(review.summary, 2000));
    }
    if (cleanText(review?.runId, 100)) appendTextElement(panel, "p", `Review record: ${cleanText(review.runId, 100)}`, "muted");

    const reviewers = Array.isArray(review?.reviewers) ? review.reviewers.slice(0, 12) : [];
    if (reviewers.length) {
      appendTextElement(panel, "h4", "Reviewers");
      const list = document.createElement("ul"); list.className = "reviewers";
      for (const item of reviewers) {
        if (!item || typeof item !== "object") continue;
        const li = document.createElement("li");
        const reviewerConfidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1 ? `${Math.round(item.confidence * 100)}%` : "";
        const heading = [cleanText(item.agent, 80), cleanText(item.verdict || item.status, 80), reviewerConfidence].filter(Boolean).join(" — ");
        appendTextElement(li, "strong", heading || "Reviewer");
        appendTextElement(li, "p", cleanText(item.summary, 800));
        list.appendChild(li);
      }
      if (list.childNodes.length) panel.appendChild(list);
    }

    const findings = Array.isArray(review?.findings) ? review.findings.slice(0, 40) : [];
    if (findings.length) {
      appendTextElement(panel, "h4", "Findings");
      const list = document.createElement("ol"); list.className = "reviewFindings";
      for (const finding of findings) {
        if (!finding || typeof finding !== "object") continue;
        const li = document.createElement("li");
        appendTextElement(li, "span", cleanText(finding.severity, 30) || "finding", "badge severity");
        appendTextElement(li, "strong", cleanText(finding.title, 180) || "Review finding");
        appendTextElement(li, "p", cleanText(finding.rationale, 1000));
        const recommendation = cleanText(finding.recommendation, 1000);
        if (recommendation) appendTextElement(li, "p", `Recommendation: ${recommendation}`);
        list.appendChild(li);
      }
      if (list.childNodes.length) panel.appendChild(list);
    }

    for (const [field, title] of [["agreements", "Where reviewers agree"], ["disagreements", "Where reviewers differ"]]) {
      const points = Array.isArray(review?.[field]) ? review[field].map((item) => cleanText(item, 500)).filter(Boolean).slice(0, 20) : [];
      if (!points.length) continue;
      appendTextElement(panel, "h4", title);
      const list = document.createElement("ul"); list.className = "reviewPoints";
      for (const point of points) appendTextElement(list, "li", point);
      panel.appendChild(list);
    }

    // What this review left behind. A review that teaches the ledger nothing
    // says so, rather than quietly looking the same as one that did.
    const learned = Array.isArray(result.learned) ? result.learned : [];
    if (learned.length) {
      appendTextElement(panel, "h4", `Added to the ledger (${learned.length})`);
      const list = document.createElement("ul"); list.className = "reviewPoints";
      for (const row of learned) {
        if (!row || typeof row !== "object") continue;
        const li = document.createElement("li");
        li.append(badge(cleanText(row.status, 40), cleanText(row.status, 40)), " ", cleanText(row.text, 500));
        list.appendChild(li);
      }
      if (list.childNodes.length) panel.appendChild(list);
      appendTextElement(panel, "p", "These are kept because several models independently agreed and the answer carried real sources. The next question on this subject is answered from the ledger.", "muted");
    } else if (cleanText(result.learnedSkipped, 200)) {
      appendTextElement(panel, "p", `Nothing was added to the ledger: ${cleanText(result.learnedSkipped, 200)}.`, "muted");
    }

    const ledger = safeExternalHref(review?.ledgerUrl);
    if (ledger) {
      const link = document.createElement("a");
      link.href = ledger; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Open review record";
      panel.appendChild(link);
    }
    panel.classList.remove("hidden");
  }

  function searchAnswer(turn, step) {
    const session=sessionId, generation=searchGeneration, navigation=navigationIntent;
    const token={requestId:turn.dataset.requestId};pendingSearches.add(token);
    const valid=()=>pendingSearches.has(token) && sessionId===session && generation===searchGeneration && navigation===navigationIntent && turn.isConnected && turn.dataset.requestId===token.requestId;
    const run=async()=>{
      await historyReady;
      // Let every sentence of the current answer enter the audio queue first.
      // Search must neither abort its stream nor cut off its narration.
      while(valid() && activeController) await activeController.settled;
      if(!valid()){ if(session===sessionId) setLiveStatus("The queued search was cancelled because a new request started. Say “search this answer” to queue it again."); return; }
      const command=step.researchMode==='live_sources' ? 'Search this answer' : step.researchMode==='sources' ? 'Yes, check relevant sources' : 'Yes, check official Manx sources';
      await ask(command,{researchTurnId:token.requestId,preserveSpeech:true,canDispatch:valid});
    };
    const task=searchQueue.then(run).finally(()=>{pendingSearches.delete(token);resumeIfConversation();});
    searchQueue=task.catch(()=>{if(session===sessionId && generation===searchGeneration)setLiveStatus("Search could not start. Please try again.");});
    return searchQueue;
  }
  function renderKnowledgeWrite(turn, receipt) {
    turn.querySelector('.knowledgeReceipt')?.remove();
    if (!receipt || !(receipt.stored || receipt.rejected || receipt.omitted || (receipt.reason && receipt.considered))) return;
    const details=document.createElement('details');details.className='knowledgeReceipt';
    const summary=document.createElement('summary');
    summary.textContent=receipt.stored?`Knowledge saved · ${Number(receipt.added)||0} added, ${Number(receipt.refreshed)||0} refreshed`:'Knowledge was not added';details.appendChild(summary);
    const note=document.createElement('p');note.textContent='Public source passages, not independently verified facts. Conversations and model opinions are kept separately.';details.appendChild(note);
    if(receipt.reason){const p=document.createElement('p');p.textContent=cleanText(receipt.reason,160);details.appendChild(p);}
    if(receipt.index){const p=document.createElement('p');p.textContent=`Vector index: ${finiteNumber(receipt.index.indexed)} of ${finiteNumber(receipt.index.indexable)} eligible records indexed; ${finiteNumber(receipt.index.missing)} missing, ${finiteNumber(receipt.index.stale)} stale.`;details.appendChild(p);}
    else if(receipt.stored){const p=document.createElement('p');p.textContent=receipt.indexError?'Saved source records; vector indexing failed.':'Saved source records; vector indexing has not been confirmed.';details.appendChild(p);}
    if(receipt.rejected||receipt.omitted){const p=document.createElement('p');p.textContent=`${finiteNumber(receipt.rejected)} passages rejected by evidence checks; ${finiteNumber(receipt.omitted)} outside this bounded save.`;details.appendChild(p);}
    const list=document.createElement('ul');
    for(const entry of (Array.isArray(receipt.entries)?receipt.entries:[]).slice(0,48)){
      const li=document.createElement('li');li.append(cleanText(entry.text,240)+' ');
      for(const source of (Array.isArray(entry.sources)?entry.sources:[]).slice(0,4)){const href=safeExternalHref(source.url);if(!href)continue;const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=cleanText(source.title,160)||'Source passage';li.append(a,' ');}
      if(entry.fetchedAt)li.append(' Read '+cleanText(entry.fetchedAt,40)+'.');list.appendChild(li);
    }
    details.appendChild(list);turn.appendChild(details);
  }

  function renderNextSteps(turn, nextSteps) {
    const panel = turn.querySelector(".nextSteps");
    panel.replaceChildren();
    const pageStep=(Array.isArray(nextSteps)?nextSteps:[]).find(item=>item?.kind==='open_page' && approvedPage(item.target));
    if(pageStep){
      const page=approvedPage(pageStep.target);
      appendTextElement(panel,'strong',page.title);
      const link=document.createElement('a');link.href=page.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open official weather';
      panel.appendChild(link);appendTextElement(panel,'p','Say “open it” to open this page. No paid research is needed.');panel.classList.remove('hidden');return;
    }
    const step = (Array.isArray(nextSteps) ? nextSteps : []).find((item) => item?.kind === "research" && cleanText(item.subject, 2000));
    if (!step) { panel.classList.add("hidden"); return; }
    const subject = cleanText(step.subject, 2000);
    const scope=document.createElement("details");
    appendTextElement(scope,"summary","Search scope");
    appendTextElement(scope,"p",subject);panel.appendChild(scope);
    const actions = document.createElement("div"); actions.className = "nextStepActions";
    const check = document.createElement("button"); check.type = "button"; check.textContent = cleanText(step.label,180) || "Check official Manx sources";
    check.onclick = () => {
      check.disabled=true;
      setLiveStatus(activeController ? "Search queued after the current answer. Narration will continue." : "Searching this answer. Current narration will continue.");
      searchAnswer(turn,step).finally(()=>{if(check.isConnected)check.disabled=false;});
    };
    const change = document.createElement("button"); change.type = "button"; change.textContent = "Change";
    change.onclick = () => { const input = $("#askText"); input.value = subject; input.dispatchEvent(new Event("input")); input.focus(); input.select(); setLiveStatus("Edit the suggested research question, then press Ask."); };
    const dismiss = document.createElement("button"); dismiss.type = "button"; dismiss.textContent = "Not now";
    dismiss.onclick = () => { panel.classList.add("hidden"); setLiveStatus("Research suggestion dismissed."); };
    if(step.reviewAvailable)appendTextElement(panel,'p','You can say “search this answer”, “use MOMM”, or “do both”. MOMM reviews the completed answer while the source search checks current evidence.');
    actions.append(check, change, dismiss); panel.appendChild(actions); panel.classList.remove("hidden");
  }

  // ---------- conversation-visible research ----------
  const ACTIVE_RESEARCH_STATUSES = new Set(["queued", "running", "started", "in_progress", "cancelling"]);
  const FINISHED_RESEARCH_STATUSES = new Set(["done", "partial", "empty", "failed", "interrupted", "cancelled"]);

  function validResearchId(value) {
    const id = typeof value === "string" ? value.trim() : "";
    return /^[a-z0-9_.:-]{3,200}$/i.test(id) ? id : "";
  }

  function canonicalResearchStatus(value, fallback = "") {
    const status = cleanText(value, 40).toLowerCase();
    if (["complete", "completed", "finished", "success"].includes(status)) return "done";
    if (["error", "errored"].includes(status)) return "failed";
    if (status === "cancelled") return "interrupted";
    if (["started", "in_progress"].includes(status)) return "running";
    return ["queued", "running", "cancelling", "done", "partial", "empty", "failed", "interrupted"].includes(status) ? status : fallback;
  }

  function optionalResearchBoolean(source, camel, snake) {
    if (typeof source?.[camel] === "boolean") return source[camel];
    if (typeof source?.[snake] === "boolean") return source[snake];
    return undefined;
  }

  function researchRevision(raw, progress, preview) {
    const timestamps = [
      raw.finishedAt, raw.finished_at, progress.updatedAt, progress.updated_at,
      preview.updatedAt, preview.updated_at, raw.updatedAt, raw.updated_at, raw.at,
      raw.createdAt, raw.created_at,
    ].map((value) => Date.parse(value)).filter(Number.isFinite);
    return timestamps.length ? Math.max(...timestamps) : 0;
  }

  /** Official pages a research pass could not read. Model-written, so bounded. */
  function normaliseUnreachable(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
      if (!row || typeof row !== "object") return null;
      const url = cleanText(row.url, 400);
      return url ? { url, reason: cleanText(row.reason, 200), official: row.official === true } : null;
    }).filter(Boolean).slice(0, 8);
  }

  function normaliseResearchRow(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const id = validResearchId(raw.id || raw.expeditionId || raw.expedition_id);
    if (!id) return null;
    const progress = raw.progress && typeof raw.progress === "object" && !Array.isArray(raw.progress) ? raw.progress : {};
    const preview = raw.preview && typeof raw.preview === "object" && !Array.isArray(raw.preview) ? raw.preview : {};
    const learned = Array.isArray(raw.learned) ? raw.learned.filter((item) => item && typeof item === "object").slice(0, 40) : [];
    const findings = Array.isArray(preview.findings) ? preview.findings.slice(0, 20) : [];
    const unresolvedRaw = Array.isArray(raw.unresolved) ? raw.unresolved : Array.isArray(preview.unresolved) ? preview.unresolved : [];
    const status = canonicalResearchStatus(raw.status);
    // Terminal truth is persisted with the final progress snapshot. Prefer an
    // event's top-level flags, then that durable snapshot, before the earlier
    // first-pass preview so reload cannot resurrect a provisional verdict.
    const officialRequested = optionalResearchBoolean(raw, "officialRequested", "official_requested")
      ?? optionalResearchBoolean(progress, "officialRequested", "official_requested");
    const officialSourceFound = optionalResearchBoolean(raw, "officialSourceFound", "official_source_found")
      ?? optionalResearchBoolean(progress, "officialSourceFound", "official_source_found");
    const officialAnswerFound = optionalResearchBoolean(raw, "officialAnswerFound", "official_answer_found")
      ?? optionalResearchBoolean(progress, "officialAnswerFound", "official_answer_found");
    return {
      id,
      sessionId: cleanText(raw.sessionId || raw.session_id, 80),
      question: cleanText(raw.question, 2000),
      mode: cleanText(raw.mode, 40),
      status,
      revision: researchRevision(raw, progress, preview),
      officialRequested,
      officialSourceFound,
      officialAnswerFound,
      progress: {
        stage: cleanText(progress.stage || raw.stage || raw.step, 80),
        detail: cleanText(progress.detail || raw.detail, 500),
        updatedAt: cleanText(progress.updatedAt || progress.updated_at || raw.updatedAt || raw.updated_at || raw.at, 80),
        count: Number.isFinite(Number(progress.count ?? raw.count)) ? Number(progress.count ?? raw.count) : null,
        completed: Number.isFinite(Number(progress.completed)) ? Math.max(0, Number(progress.completed)) : null,
        total: Number.isFinite(Number(progress.total)) ? Math.max(0, Number(progress.total)) : null,
        percent: Number.isFinite(Number(progress.percent)) ? Math.min(100, Math.max(0, Number(progress.percent))) : null,
      },
      preview: {
        summary: cleanText(preview.summary, 3000),
        findings,
        unresolved: Array.isArray(preview.unresolved) ? preview.unresolved.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 12) : [],
        officialRequested: typeof preview.officialRequested === "boolean" ? preview.officialRequested : typeof preview.official_requested === "boolean" ? preview.official_requested : undefined,
        officialSourceFound: typeof preview.officialSourceFound === "boolean" ? preview.officialSourceFound : typeof preview.official_source_found === "boolean" ? preview.official_source_found : undefined,
        officialAnswerFound: typeof preview.officialAnswerFound === "boolean" ? preview.officialAnswerFound : typeof preview.official_answer_found === "boolean" ? preview.official_answer_found : undefined,
        deeperChecksPending: typeof preview.deeperChecksPending === "boolean" ? preview.deeperChecksPending : typeof preview.deeper_checks_pending === "boolean" ? preview.deeper_checks_pending : undefined,
        sources: Array.isArray(preview.sources) ? preview.sources.slice(0, 80) : [],
        unreachable: normaliseUnreachable(preview.unreachable),
        officialAccessBlocked: typeof preview.officialAccessBlocked === "boolean" ? preview.officialAccessBlocked : undefined,
      },
      summary: cleanText(raw.summary, 6000),
      reviewResult: raw.reviewResult && typeof raw.reviewResult === "object" ? raw.reviewResult : null,
      addendum: cleanText(raw.addendum, 6000),
      unreachable: normaliseUnreachable(raw.unreachable),
      learned,
      unresolved: unresolvedRaw.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 20),
      sources: Array.isArray(raw.sources) ? raw.sources.slice(0, 80) : [],
      error: cleanText(raw.error || (["failed", "empty", "interrupted"].includes(status) ? raw.reason : ""), 1200),
      costUsd: Number.isFinite(Number(raw.costUsd ?? raw.cost_usd)) ? Number(raw.costUsd ?? raw.cost_usd) : null,
      durationMs: Number.isFinite(Number(raw.durationMs ?? raw.duration_ms)) ? Number(raw.durationMs ?? raw.duration_ms) : null,
      createdAt: cleanText(raw.createdAt || raw.created_at, 80),
      finishedAt: cleanText(raw.finishedAt || raw.finished_at, 80),
    };
  }

  function mergeResearchRow(raw) {
    const next = normaliseResearchRow(raw);
    if (!next) return null;
    const old = researchRecords.get(next.id) || {};
    const oldPreview = old.preview || {};
    const nextTerminal = FINISHED_RESEARCH_STATUSES.has(next.status);
    const staleNonterminal = Boolean(old.id && !nextTerminal && old.revision && next.revision && next.revision < old.revision);
    if (staleNonterminal) return old;
    if (old.status === "running" && next.status === "queued") return old;
    let status = FINISHED_RESEARCH_STATUSES.has(old.status) && !nextTerminal
      ? old.status
      : next.status || old.status || "running";
    const officialRequested = next.officialRequested ?? old.officialRequested ?? next.preview.officialRequested ?? oldPreview.officialRequested;
    const officialSourceFound = next.officialSourceFound ?? old.officialSourceFound ?? next.preview.officialSourceFound ?? oldPreview.officialSourceFound;
    const officialAnswerFound = next.officialAnswerFound ?? old.officialAnswerFound ?? next.preview.officialAnswerFound ?? oldPreview.officialAnswerFound;
    if (status === "done" && officialRequested && (officialSourceFound === false || officialAnswerFound === false)) status = "partial";
    const record = {
      ...old,
      ...next,
      sessionId: next.sessionId || old.sessionId || "",
      question: next.question || old.question || "",
      mode: next.mode || old.mode || "",
      status,
      revision: Math.max(next.revision || 0, old.revision || 0),
      officialRequested,
      officialSourceFound,
      officialAnswerFound,
      progress: {
        ...(old.progress || {}),
        ...next.progress,
        stage: next.progress.stage || old.progress?.stage || "",
        detail: next.progress.detail || old.progress?.detail || "",
        updatedAt: next.progress.updatedAt || old.progress?.updatedAt || "",
        count: next.progress.count ?? old.progress?.count ?? null,
        completed: next.progress.completed ?? old.progress?.completed ?? null,
        total: next.progress.total ?? old.progress?.total ?? null,
        percent: next.progress.percent ?? old.progress?.percent ?? null,
      },
      preview: {
        ...oldPreview,
        ...next.preview,
        summary: next.preview.summary || oldPreview.summary || "",
        findings: next.preview.findings.length ? next.preview.findings : oldPreview.findings || [],
        unresolved: next.preview.unresolved.length ? next.preview.unresolved : oldPreview.unresolved || [],
        sources: next.preview.sources.length ? next.preview.sources : oldPreview.sources || [],
        officialRequested: next.preview.officialRequested ?? oldPreview.officialRequested,
        officialSourceFound: next.preview.officialSourceFound ?? oldPreview.officialSourceFound,
        officialAnswerFound: next.preview.officialAnswerFound ?? oldPreview.officialAnswerFound,
        deeperChecksPending: next.preview.deeperChecksPending ?? oldPreview.deeperChecksPending,
        unreachable: next.preview.unreachable.length ? next.preview.unreachable : oldPreview.unreachable || [],
        officialAccessBlocked: next.preview.officialAccessBlocked ?? oldPreview.officialAccessBlocked,
      },
      summary: next.summary || old.summary || "",
      reviewResult: next.reviewResult || old.reviewResult || null,
      addendum: next.addendum || old.addendum || "",
      learned: next.learned.length ? next.learned : old.learned || [],
      unresolved: next.unresolved.length ? next.unresolved : old.unresolved || [],
      unreachable: next.unreachable.length ? next.unreachable : old.unreachable || [],
      sources: next.sources.length ? next.sources : old.sources || [],
      error: next.error || old.error || "",
      costUsd: next.costUsd ?? old.costUsd ?? null,
      durationMs: next.durationMs ?? old.durationMs ?? null,
      createdAt: next.createdAt || old.createdAt || "",
      finishedAt: next.finishedAt || old.finishedAt || "",
    };
    researchRecords.set(record.id, record);
    return record;
  }

  function researchOfficialFlags(record) {
    return {
      officialRequested: record.officialRequested ?? record.preview?.officialRequested,
      officialSourceFound: record.officialSourceFound ?? record.preview?.officialSourceFound,
      officialAnswerFound: record.officialAnswerFound ?? record.preview?.officialAnswerFound,
    };
  }

  function safeResearchSource(value) {
    const rawUrl = typeof value === "string" ? value : value && typeof value === "object" ? value.url : "";
    const href = safeExternalHref(rawUrl);
    if (!href || href.length > 2000) return null;
    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase();
      const privateHost = host === "localhost" || host === "::1" || host.endsWith(".local") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
      if (url.protocol !== "https:" || url.username || url.password || privateHost) return null;
      return {
        href: url.href,
        title: cleanText(typeof value === "object" ? value.title || value.publisher : "", 240) || host,
        primary: Boolean(typeof value === "object" && (value.primary || value.official)),
      };
    } catch { return null; }
  }

  function researchSources(record) {
    const candidates = [...(record.sources || []), ...(record.preview?.sources || [])];
    for (const finding of record.preview?.findings || []) {
      if (finding && typeof finding === "object" && Array.isArray(finding.sources)) candidates.push(...finding.sources);
    }
    for (const claim of record.learned || []) {
      if (claim && typeof claim === "object" && Array.isArray(claim.sources)) candidates.push(...claim.sources);
    }
    const safe = candidates.map(safeResearchSource).filter(Boolean);
    return [...new Map(safe.map((source) => [source.href, source])).values()].slice(0, 30);
  }

  function researchFindingText(value) {
    return cleanText(typeof value === "string" ? value : value?.claim || value?.text || value?.summary, 1200);
  }

  function researchStatusLabel(status) {
    return {
      queued: "queued", running: "researching", cancelling: "stopping", done: "complete",
      partial: "partly complete", empty: "nothing reliable found", failed: "failed", interrupted: "stopped",
    }[status] || "researching";
  }

  function researchProgressText(record) {
    const stage = record.progress?.stage || record.status;
    const count = record.progress?.count;
    const fixed = {
      queued: "Waiting for the research check to start…",
      started: "Research has started…",
      starting: "Preparing the source check…",
      research: "Checking official and primary Manx sources…",
      "research.done": `Initial source search complete${count == null ? "" : ` — ${count} candidate findings`}. Deeper checks continue…`,
      research_complete: "Initial source search complete. The first findings are shown below…",
      lateral: "Testing additional angles…",
      "lateral.done": "Additional angles prepared. Verifying them now…",
      lateral_complete: "Additional angles have been checked…",
      lateral_failed: "The additional-angle check could not be completed. Other checks continue…",
      adversarial: "Checking for counter-evidence…",
      "adversarial.done": "Counter-evidence check complete…",
      adversarial_complete: "Counter-evidence check complete…",
      adversarial_failed: "The counter-evidence check could not be completed. Other checks continue…",
      verify_hypotheses: "Verifying the additional findings…",
      "verify_hypotheses.done": "Additional findings checked…",
      cross_model: "Independent reviewers are checking the sourced claims…",
      "cross_model.done": "Independent review complete. Preparing the result…",
      cross_model_complete: "Independent review complete. Preparing the result…",
      complete: "Finalising the checked result…",
      cancelling: "Cancellation requested. Waiting for the active check to stop…",
    }[stage];
    const message = fixed || record.progress?.detail || (record.status === "queued" ? "Research queued…" : "Research is still working…");
    return record.progress?.percent == null ? message : `${message} ${Math.round(record.progress.percent)}% complete.`;
  }

  function ensureResearchTurn(record, { create = false, turn = null } = {}) {
    let target = turn || turns.get(`expedition:${record.id}`);
    let created = false;
    if (!target && create) {
      target = tpl.content.firstElementChild.cloneNode(true);
      target.classList.add("researchReturn");
      target.querySelector(".q").textContent = record.question || "Isle of Man research check";
      target.querySelector(".a").textContent = "Research requested in this conversation.";
      transcript.prepend(target);
      created = true;
    }
    if (!target) return { target: null, created: false };
    target.dataset.expedition = record.id;
    target.dataset.researchSession = record.sessionId || sessionId;
    turns.set(`expedition:${record.id}`, target);
    return { target, created };
  }

  function appendResearchSources(panel, record) {
    const sources = researchSources(record);
    if (!sources.length) return;
    appendTextElement(panel, "h4", "Sources checked");
    const list = document.createElement("ul"); list.className = "researchSources";
    for (const source of sources) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = source.title;
      item.appendChild(link);
      if (source.primary) item.append(" — official or primary");
      list.appendChild(item);
    }
    panel.appendChild(list);
  }

  function renderResearchProgress(panel, record) {
    appendTextElement(panel, "p", researchProgressText(record), "researchProgress");
    const previewSummary = record.preview?.summary;
    const previewFindings = (record.preview?.findings || []).map(researchFindingText).filter(Boolean).slice(0, 6);
    if (previewSummary || previewFindings.length) {
      const preview = document.createElement("div"); preview.className = "researchPreview";
      appendTextElement(preview, "h4", "Source preview");
      if (previewSummary) appendTextElement(preview, "p", previewSummary, "", 3000);
      if (previewFindings.length) {
        const list = document.createElement("ul"); list.className = "researchFindings";
        for (const finding of previewFindings) appendTextElement(list, "li", finding, "", 1200);
        preview.appendChild(list);
      }
      if (record.preview?.deeperChecksPending) appendTextElement(preview, "p", "This is an early sourced preview. Counter-checking and independent review are still running.", "muted");
      panel.appendChild(preview);
    }
    const { officialRequested, officialSourceFound } = researchOfficialFlags(record);
    if (officialRequested && officialSourceFound === false) {
      appendTextElement(panel, "p", "No official Manx source has been found yet. The check is continuing.", "researchWarning");
    }
    appendResearchSources(panel, record);
    const actions = document.createElement("div"); actions.className = "researchActions";
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "cancelResearch";
    cancel.textContent = record.status === "cancelling" ? "Stopping…" : "Cancel research";
    cancel.disabled = record.status === "cancelling";
    cancel.onclick = () => cancelResearch(record.id);
    actions.appendChild(cancel); panel.appendChild(actions);
  }

  function renderResearchResult(panel, record) {
    const result = document.createElement("div"); result.className = "researchResult";
    const summary = record.summary || record.preview?.summary || record.addendum;
    if (summary) appendTextElement(result, "p", summary, "", 6000);
    const actions = document.createElement("div"); actions.className = "researchActions";
    const read = document.createElement("button"); read.type = "button"; read.className = "readResearch"; read.textContent = "Read summary aloud";
    read.disabled = !summary;
    read.onclick = () => readAloud(summary || "No reliable result was found in this check.");
    const stop = document.createElement("button"); stop.type = "button"; stop.textContent = "Stop reading";
    stop.onclick = () => hush({ cancelAnswer: false });
    actions.append(read, stop); result.appendChild(actions);
    const learned = (record.learned || []).slice(0, 10);
    if (learned.length) {
      appendTextElement(result, "h4", "What the check established");
      const list = document.createElement("ul"); list.className = "researchLearned";
      for (const claim of learned) {
        const text = researchFindingText(claim);
        if (!text) continue;
        const item = document.createElement("li");
        const status = cleanText(claim.status, 40);
        if (STATUSES.includes(status)) item.appendChild(badge(status, status));
        item.append(text);
        list.appendChild(item);
      }
      if (list.childNodes.length) result.appendChild(list);
    }
    const unresolved = (record.unresolved.length ? record.unresolved : record.preview?.unresolved || []).slice(0, 10);
    if (unresolved.length) {
      appendTextElement(result, "h4", "Still unresolved");
      const list = document.createElement("ul"); list.className = "researchUnresolved";
      for (const item of unresolved) appendTextElement(list, "li", item, "", 800);
      result.appendChild(list);
    }
    // Pages the official sites refused to serve. Showing these is the
    // difference between "nothing official exists" and "the site blocked us".
    // The live finished event carries these; a reloaded row carries them on the
    // stored preview. Prefer whichever actually has rows.
    const unreachable = (record.unreachable?.length ? record.unreachable : record.preview?.unreachable || []).slice(0, 8);
    if (unreachable.length) {
      appendTextElement(result, "h4", "Official pages that could not be read");
      const list = document.createElement("ul"); list.className = "researchUnresolved";
      for (const item of unreachable) {
        if (!item || typeof item !== "object") continue;
        const li = document.createElement("li");
        const href = safeExternalHref(item.url);
        if (href) { const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = cleanText(href, 200); li.appendChild(link); }
        else appendTextElement(li, "span", cleanText(item.url, 200));
        const reason = cleanText(item.reason, 160);
        if (reason) li.append(` — ${reason}`);
        list.appendChild(li);
      }
      if (list.childNodes.length) result.appendChild(list);
    }
    const { officialRequested, officialSourceFound, officialAnswerFound } = researchOfficialFlags(record);
    const blocked = unreachable.some((item) => item && item.official);
    if (officialRequested && (officialSourceFound === false || officialAnswerFound === false)) {
      const warning = officialSourceFound === false
        ? blocked
          ? "The official Manx pages found in this pass refused automated access, so this is a blocked check rather than proof that nothing official exists."
          : "The requested official-source check was not fulfilled; the available result is labelled accordingly."
        : "Official Manx sources were found, but they did not directly answer the requested question; this result remains partly complete.";
      appendTextElement(result, "p", warning, "researchWarning");
    }
    if (record.error && ["failed", "empty", "interrupted"].includes(record.status)) appendTextElement(result, "p", record.error, "canvasError", 1200);
    const metrics = [
      record.durationMs == null ? "" : `${(record.durationMs / 1000).toFixed(1)}s`,
      record.costUsd == null ? "" : `$${record.costUsd.toFixed(3)}`,
    ].filter(Boolean).join(" · ");
    if (metrics) appendTextElement(result, "p", metrics, "researchMetrics");
    appendResearchSources(result, record);
    panel.appendChild(result);
  }

  function renderResearchStatus(turn, record) {
    const panel = turn.querySelector(".researchStatus");
    if (!panel) return;
    const progressLive = panel.querySelector(".researchProgressLive");
    const outcomeLive = panel.querySelector(".researchOutcomeLive");
    const body = panel.querySelector(".researchBody");
    if (!progressLive || !outcomeLive || !body) return;
    body.replaceChildren();
    panel.dataset.status = record.status;
    const header = document.createElement("div"); header.className = "researchHeader";
    appendTextElement(header, "h3", FINISHED_RESEARCH_STATUSES.has(record.status) ? "Research result" : "Research check");
    header.appendChild(badge(researchStatusLabel(record.status)));
    body.appendChild(header);

    if (ACTIVE_RESEARCH_STATUSES.has(record.status)) {
      const progressText = researchProgressText(record);
      progressLive.textContent = progressText;
      outcomeLive.textContent = "";
      renderResearchProgress(body, record);
      panel.setAttribute("aria-busy", "true");
      turn.setAttribute("aria-busy", "true");
    }
    else {
      progressLive.textContent = "";
      renderResearchResult(body, record);
      panel.setAttribute("aria-busy", "false");
      turn.setAttribute("aria-busy", "false");
      const note = turn.querySelector(".note");
      if (note) {
        note.textContent = record.status === "done"
          ? "Research complete — the checked answer and its sources are below."
          : record.status === "partial"
            ? "Research incomplete — the findings, sources and remaining gaps are below."
          : record.status === "interrupted"
            ? "Research stopped."
            : "Research finished without a reliable answer.";
        note.classList.toggle("learned", record.status === "done" || record.status === "partial");
        note.classList.remove("hidden");
      }
    }
    panel.classList.remove("hidden");
  }

  function renderResearchFailure(data, turn) {
    return updateResearch({ ...data, status: data.status === "interrupted" ? "interrupted" : "failed" }, { turn });
  }

  function announceResearchOutcome(record, turn) {
    if (completedResearchAnnouncements.has(record.id)) return;
    completedResearchAnnouncements.add(record.id);
    const failed = ["failed", "empty", "interrupted"].includes(record.status);
    const message = failed
      ? `Research ${record.status === "interrupted" ? "stopped" : "finished without a reliable result"} for ${record.question || "the requested Manx subject"}.`
      : `Research finished for ${record.question || "the requested Manx subject"}. The result and sources are now in the conversation.`;
    const outcomeLive = turn.querySelector(".researchOutcomeLive");
    if (outcomeLive) outcomeLive.textContent = message;
    showResearchNotice(record, turn);
    turn.querySelector(".researchStatus")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    deferResearchSpeech(record.id, failed ? message : `Research finished. ${record.summary || record.preview?.summary || record.addendum || message}`);
  }

  function showResearchNotice(record, turn) {
    let notice = document.querySelector("#researchNotice");
    if (!notice) { notice = document.createElement("button"); notice.id = "researchNotice"; notice.type = "button"; transcript.before(notice); }
    notice.textContent = record.status === "done" ? "Research ready — view result" : "Research finished with limits — view findings";
    notice.hidden = false;
    notice.onclick = () => { turn.scrollIntoView({block:"center",behavior:"smooth"}); turn.querySelector(".readResearch")?.focus(); notice.hidden = true; };
  }

  function addAnswerPlayback(turn) {
    const actions = turn.querySelector(".answerActions");
    if (!actions || !turn.querySelector(".a")?.textContent.trim()) return;
    let read = actions.querySelector(".readAnswer");
    if (!read) { read = document.createElement("button"); read.type = "button"; read.className = "readAnswer"; read.textContent = "Read aloud"; actions.prepend(read); }
    read.onclick = () => readAloud(turn.querySelector(".a").textContent);
    actions.classList.remove("hidden");
  }

  function paintResearchTurn(target, id, announce) {
    if (!target?.isConnected || target.dataset.researchSession !== sessionId) return;
    const latest = researchRecords.get(id);
    if (!latest || (latest.sessionId && latest.sessionId !== sessionId)) return;
    renderResearchStatus(target, latest);
    if (["done","partial"].includes(latest.status) && latest.learned?.length) {
      const key = "research:" + id;
      const button = target.querySelector(".deliberate");
      if (button) {
        button.classList.remove("hidden"); target.querySelector(".answerActions").classList.remove("hidden");
        const existing = deliberations.get(key);
        button.disabled = Boolean(existing && (!existing.result || existing.result.ok));
        button.textContent = existing?.result?.ok ? "MOMM review complete" : "Think harder about this result";
        button.onclick = () => deliberateAnswer(target,key);
      }
      if (latest.reviewResult) restoreReview(target,latest.reviewResult);
    }
    if (FINISHED_RESEARCH_STATUSES.has(latest.status) && announce) announceResearchOutcome(latest, target);
  }

  function updateResearch(raw, { fromSync = false, trusted = false, turn = null, announce = true } = {}) {
    const id = validResearchId(raw?.id || raw?.expeditionId || raw?.expedition_id);
    if (!id) return null;
    const existingTurn = turn || turns.get(`expedition:${id}`);
    const eventSession = cleanText(raw?.sessionId || raw?.session_id, 80);
    if (fromSync) {
      if (!eventSession || eventSession !== sessionId) return null;
    } else if (!trusted && (!eventSession || eventSession !== sessionId)) return null;
    if (trusted && eventSession && eventSession !== sessionId) return null;
    const scopedSession = eventSession || existingTurn?.dataset.researchSession || researchRecords.get(id)?.sessionId || sessionId;
    const record = mergeResearchRow(eventSession ? raw : { ...raw, sessionId: scopedSession });
    if (!record) return null;
    const progressId='research:'+id;
    if(['queued','running','cancelling'].includes(record.status)){if(!activity.snapshot().some(t=>t.id===progressId))activity.start(progressId,'research');noteActivity(progressId,{phase:'research',detail:record.status==='queued'?'Waiting in the research queue.':record.status==='cancelling'?'Cancellation requested.':'Research is running. Detailed results will appear below.'});}
    else finishActivity(progressId,['done','partial'].includes(record.status)?'complete':['cancelled','interrupted'].includes(record.status)?'stopped':'failed');
    refreshActivityState();
    const { target, created } = ensureResearchTurn(record, { create: fromSync || scopedSession === sessionId, turn: existingTurn });
    if (!target) return record;
    if (created) {
      // The empty live regions must be connected for a task before text is
      // inserted, otherwise some screen readers never announce recovered work.
      target.dataset.researchPending = "true";
      if (announce) target.dataset.researchAnnounce = "true";
      const paintSession = sessionId;
      setTimeout(() => {
        if (paintSession !== sessionId || !target.isConnected) return;
        const shouldAnnounce = target.dataset.researchAnnounce === "true";
        delete target.dataset.researchPending;
        delete target.dataset.researchAnnounce;
        paintResearchTurn(target, id, shouldAnnounce);
      }, 0);
    } else if (target.dataset.researchPending === "true") {
      if (announce) target.dataset.researchAnnounce = "true";
    } else paintResearchTurn(target, id, announce);
    return record;
  }

  async function cancelResearch(id) {
    const record = researchRecords.get(validResearchId(id));
    if (!record || !ACTIVE_RESEARCH_STATUSES.has(record.status)) return;
    updateResearch({ id: record.id, status: "cancelling", progress: { stage: "cancelling" } }, { trusted: true, announce: false });
    setLiveStatus("Cancelling the research check…");
    try {
      const result = await postJson("/api/expedition/cancel", { id: record.id, sessionId });
      if (!result.cancelled) {
        updateResearch({ id: record.id, status: "running", progress: { detail: cleanText(result.reason, 400) || "The research check could not be cancelled." } }, { trusted: true, announce: false });
        setLiveStatus("The research check could not be cancelled.");
      }
    } catch (error) {
      updateResearch({ id: record.id, status: "running", progress: { detail: `Cancellation failed: ${error.message}` } }, { trusted: true, announce: false });
      setLiveStatus("The research cancellation request failed.");
    }
  }

  let researchSyncPromise = null;
  let researchSyncSession = "";
  async function syncResearch() {
    const requestedSession = sessionId;
    if (researchSyncPromise && researchSyncSession === requestedSession) return researchSyncPromise;
    const trackedAtStart = new Set([...researchRecords]
      .filter(([, record]) => ACTIVE_RESEARCH_STATUSES.has(record.status) && (!record.sessionId || record.sessionId === requestedSession))
      .map(([id]) => id));
    const syncPromise = (async () => {
      try {
        const response = await fetch(`/api/research?sessionId=${encodeURIComponent(requestedSession)}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (response.status === 404) return;
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `request failed (${response.status})`);
        if (sessionId !== requestedSession) return;
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload.expeditions) ? payload.expeditions : Array.isArray(payload.research) ? payload.research : Array.isArray(payload.jobs) ? payload.jobs : [];
        const ordered = [...rows].sort((left, right) => String(left?.createdAt || left?.created_at || "").localeCompare(String(right?.createdAt || right?.created_at || "")));
        const restoredIds = new Set();
        let restored = false;
        for (const row of ordered) {
          if (sessionId !== requestedSession) return;
          const rowSession = cleanText(row?.sessionId || row?.session_id, 80);
          const rowId = validResearchId(row?.id || row?.expeditionId || row?.expedition_id);
          if (!rowId || rowSession !== requestedSession) continue;
          restoredIds.add(rowId);
          const before = researchRecords.has(rowId);
          const wasActive = ACTIVE_RESEARCH_STATUSES.has(researchRecords.get(rowId)?.status);
          const record = updateResearch(row, { fromSync: true, announce: wasActive });
          if (record && FINISHED_RESEARCH_STATUSES.has(record.status)) {
            const target = turns.get(`expedition:${rowId}`);
            if (target) showResearchNotice(record, target);
          }
          if (record && !before) restored = true;
        }
        if (sessionId !== requestedSession) return;
        for (const [id, record] of researchRecords) {
          if (!trackedAtStart.has(id) || !ACTIVE_RESEARCH_STATUSES.has(record.status) || restoredIds.has(id)) continue;
          if (record.sessionId && record.sessionId !== requestedSession) continue;
          updateResearch({
            id,
            sessionId: requestedSession,
            status: "interrupted",
            error: "This research check could not be restored for this conversation. It may belong to an older session or have been interrupted.",
            finishedAt: new Date().toISOString(),
          }, { trusted: true, turn: turns.get(`expedition:${id}`) });
        }
        if (restored) setLiveStatus("Research progress and completed results have been restored to this conversation.");
      } catch (error) {
        if (sessionId === requestedSession) feedLine("failed", `Could not restore research status: ${error.message}`);
      }
    })();
    researchSyncPromise = syncPromise;
    researchSyncSession = requestedSession;
    try { return await syncPromise; }
    finally {
      if (researchSyncPromise === syncPromise) {
        researchSyncPromise = null;
        researchSyncSession = "";
      }
    }
  }

  function safeFinite(value, min, max) {
    return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
  }

  const CANVAS_KINDS = Object.freeze(["bar", "line", "scatter", "node-edge"]);
  const CANVAS_COLORS = Object.freeze({
    "manx-green": "#1f5a3c",
    brass: "#c9a24b",
    "sea-blue": "#3a6ea5",
    slate: "#5b665f",
    coral: "#b85f4b",
    plum: "#76558f",
    grey: "#7a817d",
  });
  const CANVAS_COLOR_NAMES = Object.freeze(Object.keys(CANVAS_COLORS));
  const MAX_CANVAS_NUMBER = 1e15;

  function plainCanvasObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function canvasKeysAllowed(value, allowed) {
    return plainCanvasObject(value) && Object.keys(value).every((key) => allowed.includes(key));
  }

  function unsafeCanvasText(value) {
    return /[<>`{}]/.test(value)
      || /(?:https?:\/\/|www\.|javascript\s*:|data\s*:|vbscript\s*:|file\s*:)/i.test(value)
      || /(?:on[a-z]+\s*=|style\s*=|@import\b|url\s*\(|document\.|window\.|function\s*\(|=>)/i.test(value);
  }

  function canvasText(value, max, required = false) {
    if (value == null || value === "") return { text: "", valid: !required };
    if (typeof value !== "string") return { text: "", valid: false };
    const text = cleanText(value, max + 1);
    return { text: text.slice(0, max), valid: Boolean(text || !required) && text.length <= max && !unsafeCanvasText(value) && !unsafeCanvasText(text) };
  }

  function exactCanvasDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function canvasProvenance(value, factual) {
    let valid = true;
    if (value == null) return { rows: [], valid: !factual };
    if (!Array.isArray(value)) return { rows: [], valid: false };
    if ((factual && !value.length) || value.length > 8) valid = false;
    const rows = [];
    for (const raw of value.slice(0, 8)) {
      if (!canvasKeysAllowed(raw, ["publisher", "title", "reference"])) { valid = false; continue; }
      const publisher = canvasText(raw.publisher, 100, true);
      const title = canvasText(raw.title, 160, true);
      const reference = canvasText(raw.reference, 120);
      if (!publisher.valid || !title.valid || !reference.valid) { valid = false; continue; }
      rows.push({ publisher: publisher.text, title: title.text, ...(reference.text ? { reference: reference.text } : {}) });
    }
    return { rows, valid };
  }

  function canvasColour(value, fallbackIndex = 0) {
    if (value == null || value === "") return CANVAS_COLOR_NAMES[fallbackIndex % CANVAS_COLOR_NAMES.length];
    return Object.hasOwn(CANVAS_COLORS, value) ? value : null;
  }

  function canvasDescription(spec) {
    const noun = spec.kind === "node-edge" ? "relationship diagram" : `${spec.kind || "data"} chart`;
    return `${spec.factual ? "Factual" : "Illustrative"} ${noun} titled ${spec.title}.`;
  }

  function deriveCanvasTables(spec) {
    if (Array.isArray(spec.series)) {
      return [{
        caption: `${spec.title} data`,
        columns: ["Series", spec.xLabel || "X", spec.yLabel || "Y", "Note"],
        rows: spec.series.flatMap((series) => series.points.map((point) => [series.name, point.x, point.y, point.label || ""])),
      }];
    }
    const tables = [];
    if (Array.isArray(spec.nodes) && spec.nodes.length) {
      tables.push({ caption: `${spec.title} nodes`, columns: ["ID", "Label"], rows: spec.nodes.map((node) => [node.id, node.label]) });
    }
    if (Array.isArray(spec.edges) && spec.edges.length) {
      tables.push({ caption: `${spec.title} relationships`, columns: ["From", "To", "Relationship"], rows: spec.edges.map((edge) => [edge.from, edge.to, edge.label || ""] ) });
    }
    return tables;
  }

  function validateCanvasSpec(value) {
    const fallback = { title: "Visualisation", kind: "data", factual: true, description: "The visual could not be safely drawn.", provenance: [], tables: [], visualValid: false };
    if (!plainCanvasObject(value)) return fallback;
    let valid = true;
    const kind = value.kind;
    const chart = ["bar", "line", "scatter"].includes(kind);
    const allowed = ["version", "kind", "title", "width", "height", "factual", "asOf", "provenance", ...(chart ? ["xLabel", "yLabel", "series"] : ["nodes", "edges"])];
    if (!canvasKeysAllowed(value, allowed) || value.version !== 1 || !CANVAS_KINDS.includes(kind)) valid = false;

    const title = canvasText(value.title, 160, true);
    const factual = value.factual === false ? false : true;
    if (!title.valid || typeof value.factual !== "boolean") valid = false;
    const width = safeFinite(value.width, 320, 1200);
    const height = safeFinite(value.height, 240, 900);
    if (!Number.isInteger(width) || !Number.isInteger(height)) valid = false;
    const safeWidth = Number.isInteger(width) ? width : 720;
    const safeHeight = Number.isInteger(height) ? height : 420;
    const asOf = exactCanvasDate(value.asOf) ? value.asOf : "";
    if ((factual && !asOf) || (value.asOf != null && !asOf)) valid = false;
    const provenance = canvasProvenance(value.provenance, factual);
    if (!provenance.valid) valid = false;
    const spec = {
      version: 1,
      kind: CANVAS_KINDS.includes(kind) ? kind : "data",
      title: title.valid ? title.text : fallback.title,
      width: safeWidth,
      height: safeHeight,
      factual,
      ...(asOf ? { asOf } : {}),
      provenance: provenance.rows,
      visualValid: false,
    };

    if (chart) {
      const xLabel = canvasText(value.xLabel, 80);
      const yLabel = canvasText(value.yLabel, 80);
      if (!xLabel.valid || !yLabel.valid) valid = false;
      const series = [];
      let totalPoints = 0;
      if (!Array.isArray(value.series) || !value.series.length || value.series.length > 8) valid = false;
      for (const rawSeries of (Array.isArray(value.series) ? value.series : []).slice(0, 8)) {
        if (!canvasKeysAllowed(rawSeries, ["name", "color", "points"])) { valid = false; continue; }
        const name = canvasText(rawSeries.name, 80, true);
        const color = canvasColour(rawSeries.color, series.length);
        if (!name.valid || !color || !Array.isArray(rawSeries.points) || !rawSeries.points.length) valid = false;
        if ((rawSeries.points?.length || 0) > 200) valid = false;
        totalPoints += rawSeries.points?.length || 0;
        const points = [];
        for (const rawPoint of (Array.isArray(rawSeries.points) ? rawSeries.points : []).slice(0, 200)) {
          if (!canvasKeysAllowed(rawPoint, ["x", "y", "label"])) { valid = false; continue; }
          const y = safeFinite(rawPoint.y, -MAX_CANVAS_NUMBER, MAX_CANVAS_NUMBER);
          let x = null;
          if (kind === "scatter" || typeof rawPoint.x === "number") x = safeFinite(rawPoint.x, -MAX_CANVAS_NUMBER, MAX_CANVAS_NUMBER);
          else {
            const xText = canvasText(rawPoint.x, 80, true);
            if (xText.valid) x = xText.text;
          }
          const label = canvasText(rawPoint.label, 100);
          if (x == null || y == null || !label.valid) { valid = false; continue; }
          points.push({ x, y, ...(label.text ? { label: label.text } : {}) });
        }
        if (!points.length) valid = false;
        series.push({ name: name.valid ? name.text : `Series ${series.length + 1}`, color: color || CANVAS_COLOR_NAMES[series.length % CANVAS_COLOR_NAMES.length], points });
      }
      if (totalPoints > 200) valid = false;
      spec.xLabel = xLabel.text; spec.yLabel = yLabel.text; spec.series = series;
      spec.description = canvasDescription(spec); spec.tables = deriveCanvasTables(spec);
      spec.visualValid = valid && series.length > 0 && series.every((item) => item.points.length > 0);
      return spec;
    }

    if (kind === "node-edge") {
      const nodes = [], ids = new Set();
      if (!Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 60 || !Array.isArray(value.edges) || value.edges.length > 120) valid = false;
      for (const rawNode of (Array.isArray(value.nodes) ? value.nodes : []).slice(0, 60)) {
        if (!canvasKeysAllowed(rawNode, ["id", "label", "color", "x", "y"])) { valid = false; continue; }
        const id = canvasText(rawNode.id, 40, true), label = canvasText(rawNode.label, 100, true);
        const color = canvasColour(rawNode.color, nodes.length);
        const x = rawNode.x == null ? null : safeFinite(rawNode.x, 0, safeWidth);
        const y = rawNode.y == null ? null : safeFinite(rawNode.y, 0, safeHeight);
        if (!id.valid || !/^[a-zA-Z0-9_.-]+$/.test(id.text) || ids.has(id.text) || !label.valid || !color || (rawNode.x != null && x == null) || (rawNode.y != null && y == null)) { valid = false; continue; }
        ids.add(id.text); nodes.push({ id: id.text, label: label.text, color, ...(x == null ? {} : { x }), ...(y == null ? {} : { y }) });
      }
      const edges = [];
      for (const rawEdge of (Array.isArray(value.edges) ? value.edges : []).slice(0, 120)) {
        if (!canvasKeysAllowed(rawEdge, ["from", "to", "label", "color"])) { valid = false; continue; }
        const from = canvasText(rawEdge.from, 40, true), to = canvasText(rawEdge.to, 40, true), label = canvasText(rawEdge.label, 100);
        const color = canvasColour(rawEdge.color, 6);
        if (!from.valid || !to.valid || !ids.has(from.text) || !ids.has(to.text) || !label.valid || !color) { valid = false; continue; }
        edges.push({ from: from.text, to: to.text, color, ...(label.text ? { label: label.text } : {}) });
      }
      spec.nodes = nodes; spec.edges = edges;
      spec.description = canvasDescription(spec); spec.tables = deriveCanvasTables(spec);
      spec.visualValid = valid && nodes.length > 0;
      return spec;
    }

    return fallback;
  }

  function drawCanvasChart(context, spec) {
    const { width, height } = spec;
    const plot = { left: 64, top: 54, right: width - 24, bottom: height - 54 };
    const all = spec.series.flatMap((series) => series.points);
    let minY = Math.min(0, ...all.map((point) => point.y));
    let maxY = Math.max(0, ...all.map((point) => point.y));
    if (minY === maxY) maxY = minY + 1;
    const yAt = (value) => plot.bottom - ((value - minY) / (maxY - minY)) * (plot.bottom - plot.top);
    context.strokeStyle = "#5b665f"; context.lineWidth = 1;
    context.beginPath(); context.moveTo(plot.left, plot.top); context.lineTo(plot.left, plot.bottom); context.lineTo(plot.right, plot.bottom); context.stroke();
    context.fillStyle = "#1b211e"; context.font = "13px system-ui";
    context.fillText(spec.yLabel || "Value", 8, plot.top);
    context.fillText(spec.xLabel || "", plot.left, height - 16);

    if (spec.kind === "bar") {
      const bars = spec.series.flatMap((series) => series.points.map((point) => ({ ...point, color: series.color })));
      const slot = (plot.right - plot.left) / Math.max(1, bars.length);
      bars.forEach((point, index) => {
        const y = yAt(point.y), zero = yAt(0);
        context.fillStyle = CANVAS_COLORS[point.color]; context.fillRect(plot.left + index * slot + slot * .12, Math.min(y, zero), slot * .76, Math.max(1, Math.abs(zero - y)));
        const pointLabel = point.label || String(point.x);
        if (pointLabel && bars.length <= 16) { context.save(); context.translate(plot.left + (index + .5) * slot, plot.bottom + 8); context.rotate(-.45); context.fillStyle = "#1b211e"; context.fillText(pointLabel.slice(0, 18), 0, 0); context.restore(); }
      });
      return;
    }

    for (const series of spec.series) {
      const numericX = series.points.every((point) => typeof point.x === "number" && Number.isFinite(point.x));
      const xs = numericX ? series.points.map((point) => point.x) : series.points.map((_, index) => index);
      let minX = Math.min(...xs), maxX = Math.max(...xs); if (minX === maxX) maxX = minX + 1;
      const xAt = (value) => plot.left + ((value - minX) / (maxX - minX)) * (plot.right - plot.left);
      context.strokeStyle = CANVAS_COLORS[series.color]; context.fillStyle = CANVAS_COLORS[series.color]; context.lineWidth = 3; context.beginPath();
      series.points.forEach((point, index) => {
        const x = xAt(numericX ? point.x : index), y = yAt(point.y);
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      if (spec.kind === "line") context.stroke();
      series.points.forEach((point, index) => { const x = xAt(numericX ? point.x : index), y = yAt(point.y); context.beginPath(); context.arc(x, y, 4, 0, Math.PI * 2); context.fill(); });
    }
  }

  function positionedCanvasNodes(spec) {
    const count = spec.nodes.length;
    const columns = Math.min(3, Math.max(1, Math.floor(spec.width / 220)), Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / columns));
    const cellWidth = (spec.width - 48) / columns, cellHeight = (spec.height - 75) / rows;
    const boxWidth = Math.max(32, Math.min(260, cellWidth - 24));
    const nodes = spec.nodes.map((node, index) => {
      const gridX = 24 + cellWidth * ((index % columns) + 0.5);
      const gridY = 55 + cellHeight * (Math.floor(index / columns) + 0.5);
      return { ...node, gridX, gridY, x: node.x ?? gridX, y: node.y ?? gridY };
    });
    return { nodes, boxWidth };
  }

  function canvasLabelLines(context, text, width) {
    const lines = []; let line = "";
    for (const word of String(text).split(/\s+/)) {
      if (line && context.measureText(line + " " + word).width <= width) { line += " " + word; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of word) {
        if (line && context.measureText(line + character).width > width) { lines.push(line); line = ""; }
        line += character;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  function drawCanvasDiagram(context, spec) {
    const { nodes, boxWidth } = positionedCanvasNodes(spec);
    context.font = "12px system-ui";
    for (const node of nodes) {
      node.lines = canvasLabelLines(context, node.label, boxWidth - 16);
      node.boxHeight = Math.max(48, node.lines.length * 15 + 18);
    }
    const fits = () => nodes.every((node, index) =>
      node.x - boxWidth / 2 >= 12 && node.x + boxWidth / 2 <= spec.width - 12 &&
      node.y - node.boxHeight / 2 >= 50 && node.y + node.boxHeight / 2 <= spec.height - 12 &&
      nodes.slice(index + 1).every(other =>
        Math.abs(node.x - other.x) >= boxWidth + 12 ||
        Math.abs(node.y - other.y) >= (node.boxHeight + other.boxHeight) / 2 + 12));
    if (!fits()) {
      for (const node of nodes) { node.x = node.gridX; node.y = node.gridY; }
      if (!fits()) return false; // Keep the complete text/table alternative, not clipped artwork.
    }
    const byId = new Map(nodes.map((node) => [node.id, node]));
    context.strokeStyle = "#66736c"; context.fillStyle = "#1b211e"; context.lineWidth = 2;
    for (const edge of spec.edges) {
      const from = byId.get(edge.from), to = byId.get(edge.to);
      context.strokeStyle = CANVAS_COLORS[edge.color];
      context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y); context.stroke();
      if (edge.label) {
        context.textAlign = "center";
        const lines = canvasLabelLines(context, edge.label, boxWidth - 16);
        const x = Math.max(boxWidth / 2, Math.min(spec.width - boxWidth / 2, (from.x + to.x) / 2));
        const y = Math.max(65, Math.min(spec.height - 12 - (lines.length - 1) * 14, (from.y + to.y) / 2));
        lines.forEach((line,i)=>context.fillText(line,x,y + i*14));
      }
    }
    for (const node of nodes) {
      context.fillStyle = CANVAS_COLORS[node.color]; context.strokeStyle = "#27322c";
      context.beginPath(); context.rect(node.x-boxWidth/2,node.y-node.boxHeight/2,boxWidth,node.boxHeight);
      context.fill(); context.stroke();
      context.fillStyle = "#ffffff"; context.textAlign = "center";
      node.lines.forEach((line,i)=>context.fillText(line,node.x,node.y-(node.lines.length-1)*7.5+4+i*15));
    }
    context.textAlign = "start";
    return true;
  }

  function renderCanvasTable(parent, tableSpec) {
    if (!tableSpec) { appendTextElement(parent, "p", "No structured data table was supplied; use the description above as the text alternative.", "muted"); return; }
    const scroll = document.createElement("div"); scroll.className = "tableScroll";
    const table = document.createElement("table");
    const caption = document.createElement("caption"); caption.textContent = tableSpec.caption; table.appendChild(caption);
    const head = document.createElement("thead"), headRow = document.createElement("tr");
    for (const column of tableSpec.columns) { const th = document.createElement("th"); th.scope = "col"; th.textContent = column; headRow.appendChild(th); }
    head.appendChild(headRow); table.appendChild(head);
    const body = document.createElement("tbody");
    for (const row of tableSpec.rows) {
      const tr = document.createElement("tr");
      row.forEach((cell, index) => { const td = document.createElement(index === 0 ? "th" : "td"); if (index === 0) td.scope = "row"; td.textContent = String(cell); tr.appendChild(td); });
      body.appendChild(tr);
    }
    table.appendChild(body); scroll.appendChild(table); parent.appendChild(scroll);
  }

  function renderCanvasWorkspace(turn, rawSpec, narration = "") {
    const panel = turn.querySelector(".canvasWorkspace");
    panel.replaceChildren();
    let drawn = false;
    const spec = validateCanvasSpec(rawSpec);
    appendTextElement(panel, "h3", spec.title);
    appendTextElement(panel, "p", narration, "canvasNarration");
    appendTextElement(panel, "p", spec.description);
    if (spec.asOf) appendTextElement(panel, "p", `As of ${spec.asOf}.`, "muted");
    if (spec.provenance.length) appendTextElement(panel, "p", `Sources: ${spec.provenance.map((source) => `${source.publisher} — ${source.title}${source.reference ? ` (${source.reference})` : ""}`).join("; ")}`, "muted");

    if (spec.visualValid) {
      const canvas = document.createElement("canvas"); canvas.width = spec.width; canvas.height = spec.height;
      canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", spec.description); canvas.textContent = spec.description;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#ffffff"; context.fillRect(0, 0, spec.width, spec.height);
        context.fillStyle = "#1b211e"; context.font = "bold 18px system-ui"; context.fillText(spec.title, 20, 30);
        const readable = spec.kind === "node-edge" ? drawCanvasDiagram(context, spec) : (drawCanvasChart(context, spec), true);
        if (readable) {
        panel.appendChild(canvas); drawn = true;
        const toolbar = document.createElement("div"); toolbar.className = "canvasToolbar";
        const download = document.createElement("button"); download.type = "button"; download.textContent = "Download PNG";
        download.onclick = () => canvas.toBlob((blob) => {
          if (!blob) { setLiveStatus("PNG download is not available in this browser."); return; }
          const href = URL.createObjectURL(blob), link = document.createElement("a");
          link.href = href; link.download = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "oracle-visual"}-oracle.png`;
          link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
        }, "image/png");
        toolbar.appendChild(download); panel.appendChild(toolbar);
        } else appendTextElement(panel, "p", "This diagram is too dense to draw readably at this size. The complete text and data are below; ask for a smaller diagram to see a visual.", "canvasError");
      } else appendTextElement(panel, "p", "Your browser could not draw this visual. The accessible data remains below.", "canvasError");
    } else appendTextElement(panel, "p", "This visual did not pass the browser safety checks. Its safe text alternative is shown below.", "canvasError");

    const alternative = document.createElement("details"); alternative.className = "canvasAlternative"; alternative.open = true;
    const summary = document.createElement("summary"); summary.textContent = "Text and data alternative"; alternative.appendChild(summary);
    appendTextElement(alternative, "p", spec.description);
    if (spec.tables.length) for (const table of spec.tables) renderCanvasTable(alternative, table);
    else appendTextElement(alternative, "p", "No safe structured data was available. The description above remains available as the text alternative.", "muted");
    panel.appendChild(alternative); panel.classList.remove("hidden");
    return drawn;
  }

  function showAnswerToolError(turn, message) {
    const panel = turn.querySelector(".reviewSummary");
    panel.replaceChildren(); appendTextElement(panel, "h3", "Could not complete that"); appendTextElement(panel, "p", message);
    panel.classList.remove("hidden");
  }

  // ---------- MOMM conversation: one coloured lane and one British voice per model ----------
  // The dispatcher streams reviewer events (started, retry, completed) as they
  // happen and delivers each model's words in the final report. Lanes animate
  // live on the events and fill in, model by model, when the report lands.
  const deliberations = new Map(); // episodeId -> live entry
  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const PHASE_TEXT = { starting: "Preparing the brief…", convening: "Convening reviewers…", reviewing: "Reviewers are reading…", synthesising: "Mannin is weighing the verdicts…", finished: "Review complete", failed: "Review did not complete" };
  const LANE_TEXT = { waiting: "waiting", thinking: "reading and thinking…", retrying: "retrying…", done: "verdict in", unavailable: "unavailable" };

  function laneFor(entry, agent) {
    const style = agentStyle(agent);
    let lane = entry.laneEls.get(style.agent);
    if (lane) return lane;
    lane = document.createElement("article");
    lane.className = "lane waiting"; lane.dataset.agent = style.agent; lane.style.setProperty("--lane", style.colour);
    lane.setAttribute("aria-label", `${style.label} reviewer`);
    const header = document.createElement("header");
    const dot = document.createElement("span"); dot.className = "laneDot"; dot.setAttribute("aria-hidden", "true");
    const name = document.createElement("strong"); name.textContent = style.label;
    const stateEl = document.createElement("span"); stateEl.className = "laneState"; stateEl.textContent = LANE_TEXT.waiting;
    const timer = document.createElement("span"); timer.className = "laneTimer";
    const verdict = document.createElement("span"); verdict.className = "badge laneVerdict hidden";
    header.append(dot, name, stateEl, timer, verdict);
    const bubble = document.createElement("div"); bubble.className = "bubble";
    const text = document.createElement("p"); text.className = "laneText";
    const list = document.createElement("ul"); list.className = "laneFindings hidden";
    bubble.append(text, list);
    lane.append(header, bubble);
    entry.lanesEl.appendChild(lane);
    entry.laneEls.set(style.agent, lane);
    return lane;
  }

  function buildConversationPanel(turn, entry) {
    const panel = turn.querySelector(".reviewConversation");
    panel.replaceChildren();
    const header = document.createElement("div"); header.className = "convHeader";
    appendTextElement(header, "h3", "MOMM conversation");
    const phase = document.createElement("span"); phase.className = "convPhase"; phase.textContent = PHASE_TEXT.starting;
    const usage = document.createElement("span"); usage.className = "convUsage";
    header.append(phase, usage);
    const progress = document.createElement("div"); progress.className = "convProgress"; progress.setAttribute("role", "progressbar"); progress.setAttribute("aria-label", "Reviewers finished"); progress.setAttribute("aria-valuemin", "0"); progress.setAttribute("aria-valuemax", "100"); progress.setAttribute("aria-valuenow", "0");
    const bar = document.createElement("div"); bar.className = "convBar"; progress.appendChild(bar);
    const lanes = document.createElement("div"); lanes.className = "convLanes";
    const controls = document.createElement("div"); controls.className = "convControls hidden";
    const play = document.createElement("button"); play.type = "button"; play.className = "playConv"; play.textContent = "▶ Read the conversation";
    const pause = document.createElement("button"); pause.type = "button"; pause.className = "pauseConv"; pause.textContent = "⏸ Pause";
    const stop = document.createElement("button"); stop.type = "button"; stop.className = "stopConv"; stop.textContent = "⏹ Stop";
    const now = document.createElement("span"); now.className = "convNow"; now.setAttribute("aria-live", "polite");
    controls.append(play, pause, stop, now);
    panel.append(header, progress, lanes, controls);
    panel.classList.remove("hidden");
    Object.assign(entry, { panel, phaseEl: phase, usageEl: usage, barEl: bar, progressEl: progress, lanesEl: lanes, controlsEl: controls, playEl: play, pauseEl: pause, stopEl: stop, nowEl: now, laneEls: new Map() });
    play.onclick = () => playConversation(entry);
    pause.onclick = () => pauseConversation(entry);
    stop.onclick = () => { stopConversationPlayback(entry); hush({ cancelAnswer: false, preserveListening: true }); };
  }

  function renderConversationLive(entry) {
    const { state } = entry;
    if (!entry.panel?.isConnected) return;
    entry.phaseEl.textContent = PHASE_TEXT[state.phase] || state.phase;
    entry.panel.dataset.phase = state.phase;
    const progress = progressOf(state);
    entry.barEl.style.width = `${Math.round(progress.ratio * 100)}%`;
    entry.progressEl.setAttribute("aria-valuenow", String(Math.round(progress.ratio * 100)));
    for (const agent of state.reviewers) laneFor(entry, agent);
    for (const lane of Object.values(state.lanes)) {
      const el = laneFor(entry, lane.agent);
      if (!entry.revealed) el.className = `lane ${lane.phase}`;
      const stateEl = el.querySelector(".laneState");
      if (!entry.revealed) stateEl.textContent = lane.phase === "retrying" && lane.retry ? `retrying: ${lane.retry}` : lane.phase === "unavailable" ? humanReviewerStatus(lane.reviewerStatus) : LANE_TEXT[lane.phase] || lane.phase;
      const verdict = el.querySelector(".laneVerdict");
      if (lane.verdict && verdict.classList.contains("hidden")) {
        verdict.textContent = `${verdictWord(lane.verdict)}${lane.findings ? ` · ${lane.findings} point${lane.findings === 1 ? "" : "s"}` : ""}${lane.critical ? ` · ${lane.critical} critical` : ""}`;
        verdict.classList.remove("hidden"); verdict.classList.add("pop");
      }
      const timer = el.querySelector(".laneTimer");
      if (lane.durationMs != null) timer.textContent = formatDuration(lane.durationMs);
      else if (lane.startedAt) timer.textContent = formatDuration(Date.now() - lane.startedAt);
      if (lane.phase === "done" && !entry.revealed && !el.querySelector(".laneText").textContent) el.querySelector(".laneText").textContent = "Verdict in. The words arrive with the full report…";
    }
    entry.usageEl.textContent = usageLine({ state, allowance: entry.allowance, costUsd: entry.costUsd, durationMs: state.finishedAt && state.startedAt ? state.finishedAt - state.startedAt : null });
    if (state.phase === "finished" || state.phase === "failed") { clearInterval(entry.timer); entry.timer = null; }
  }

  // Content delivery must never depend on animation frames or tab visibility.
  function revealText(el, text) {
    el.textContent = cleanText(text, 6000);
    el.classList.remove("typing");
    return Promise.resolve();
  }

  async function revealConversation(entry, review, result) {
    entry.revealed = true;
    const reviewers = (Array.isArray(review?.reviewers) ? review.reviewers : []).filter((r) => r && typeof r === "object");
    const findings = Array.isArray(review?.findings) ? review.findings : [];
    const byAgent = new Map(reviewers.map((r) => [agentStyle(r.agent).agent, r]));
    const order = [...new Set([...completionOrder(entry.state), ...reviewers.map((r) => agentStyle(r.agent).agent)])].filter((agent) => byAgent.has(agent));
    for (const agent of order) {
      const r = byAgent.get(agent);
      const el = laneFor(entry, agent);
      const textEl = el.querySelector(".laneText");
      if (r.status !== "success") { el.className = "lane unavailable"; el.querySelector(".laneState").textContent = humanReviewerStatus(r.status); await revealText(textEl, `${agentStyle(agent).label} ${humanReviewerStatus(r.status)}.`); continue; }
      el.className = "lane done revealing"; el.querySelector(".laneState").textContent = "says";
      const verdict = el.querySelector(".laneVerdict");
      const confidence = r.confidence != null && r.confidence !== "" && Number.isFinite(Number(r.confidence)) ? ` · ${Math.round(Number(r.confidence) * 100)}%` : "";
      verdict.textContent = `${verdictWord(r.verdict)}${confidence}`; verdict.classList.remove("hidden"); verdict.classList.add("pop");
      await revealText(textEl, cleanText(r.summary, 800) || "No summary given.");
      const own = findings.filter((f) => (Array.isArray(f.reviewers) ? f.reviewers : []).map((x) => agentStyle(x).agent).includes(agent));
      const list = el.querySelector(".laneFindings"); list.replaceChildren();
      for (const f of own.slice(0, 12)) {
        const li = document.createElement("li"); li.className = "fadeIn";
        appendTextElement(li, "span", cleanText(f.severity, 20).toLowerCase() || "finding", "badge severity");
        appendTextElement(li, "span", cleanText(f.title, 400));
        list.appendChild(li);
      }
      list.classList.toggle("hidden", !own.length);
      el.classList.remove("revealing");
    }
    const oracle = laneFor(entry, "oracle");
    oracle.className = "lane oracle done";
    oracle.querySelector(".laneState").textContent = result?.ok ? "considered answer" : "no change";
    const corrections = (Array.isArray(result?.corrections) ? result.corrections : []).map((c) => cleanText(c, 240)).filter(Boolean);
    const list = oracle.querySelector(".laneFindings"); list.replaceChildren();
    for (const c of corrections) { const li = document.createElement("li"); li.className = "fadeIn"; appendTextElement(li, "span", "changed", "badge severity"); appendTextElement(li, "span", c); list.appendChild(li); }
    list.classList.toggle("hidden", !corrections.length);
    await revealText(oracle.querySelector(".laneText"), result?.ok ? cleanText(result.answer, 6000) : cleanText(result?.message || result?.reason, 500) || "The review could not be completed.");
    if (reviewers.length) entry.controlsEl.classList.remove("hidden");
    renderConversationLive(entry);
  }

  function stopConversationPlayback(entry) {
    if (!entry?.playing) return;
    entry.playing = false; entry.paused = false;
    for (const el of entry.laneEls.values()) el.classList.remove("speaking");
    entry.nowEl.textContent = ""; entry.playEl.textContent = "▶ Read the conversation"; entry.pauseEl.textContent = "⏸ Pause";
  }

  function playConversation(entry) {
    if (entry.playing) { stopConversationPlayback(entry); hush({ cancelAnswer: false }); return; }
    hush({ cancelAnswer: false });
    const script = buildConversationScript({ review: entry.review, result: entry.result, state: entry.state, allowance: entry.allowance });
    const voicesByAgent = assignVoices(voices, { mainVoiceName: voice?.name });
    entry.playing = true; entry.paused = false; entry.playEl.textContent = "⏹ Stop reading";
    const hook = () => stopConversationPlayback(entry);
    playbackHooks.add(hook);
    script.forEach((line, index) => {
      const assigned = voicesByAgent.get(line.agent) || voicesByAgent.get("oracle") || {};
      const style = agentStyle(line.agent);
      say(line.text, {
        voice: assigned.voice, pitch: assigned.pitch, rate: assigned.rate,
        onstart: () => {
          for (const el of entry.laneEls.values()) el.classList.toggle("speaking", el.dataset.agent === style.agent);
          entry.nowEl.textContent = `${style.label} speaking${assigned.voice ? ` · ${assigned.voice.name.replace(/\s*[-(].*$/, "")}` : ""}`;
          laneFor(entry, line.agent).scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
        },
        onend: () => { if (index === script.length - 1) { playbackHooks.delete(hook); stopConversationPlayback(entry); } },
      });
    });
  }

  function pauseConversation(entry) {
    if (!entry.playing) return;
    if (entry.paused) {
      speechSynthesis.resume(); entry.paused = false; entry.pauseEl.textContent = "⏸ Pause";
      if (activeUtterance && speechSynthesis.speaking && !speechSynthesis.paused) setState("speaking");
      entry.nowEl.textContent = "Reading the conversation";
    }
    else { speechSynthesis.pause(); setState("paused"); entry.paused = true; entry.pauseEl.textContent = "▶ Resume"; entry.nowEl.textContent = "Paused"; }
  }

  async function deliberateAnswer(turn, episodeId, {observe=false}={}) {
    if(deliberations.get(String(episodeId))?.observing)return;
    const button = turn.querySelector(".deliberate");
    button.disabled = true; button.textContent = "Reviewing with MOMM…"; turn.setAttribute("aria-busy", "true");
    setLiveStatus("MOMM review requested. Its progress will appear here.");
    const requestId = newRequestId();
    const controller = new AbortController(); activeToolControllers.add(controller); refreshActivityState();
    const key = String(episodeId);
    const activityId='review:'+key;activity.start(activityId,'reviewing');controller.signal.addEventListener('abort',()=>finishActivity(activityId,'paused'),{once:true});
    const previous = deliberations.get(key);
    if (previous) { clearInterval(previous.timer); stopConversationPlayback(previous); }
    const entry = { turn, episodeId: key, state: createConversationState(key), review: null, result: null, allowance: null, costUsd: null, revealed: false, playing: false, paused: false, timer: null };
    buildConversationPanel(turn, entry);
    entry.observing=true;deliberations.set(key, entry);
    entry.state = reduceDeliberationEvent(entry.state, { status: "started" });
    renderConversationLive(entry);
    entry.timer = setInterval(() => { if (!turn.isConnected) { clearInterval(entry.timer); return; } renderConversationLive(entry); }, 1000);
    // Show which review this is out of the shared hourly allowance from the
    // first second; the exact figure is confirmed again with the result.
    fetch("/api/health").then((r) => r.json()).then((h) => {
      if (entry.allowance || !h?.mommAllowance || !turn.isConnected) return;
      entry.allowance = { used: Math.min(Number(h.mommAllowance.limit) || 0, (Number(h.mommAllowance.used) || 0) + (observe?0:1)), limit: Number(h.mommAllowance.limit) || 0, remaining: Number(h.mommAllowance.remaining) || 0 };
      renderConversationLive(entry);
    }).catch(() => {});
    let completed = false,detached=false;
    try {
      const target = key.startsWith("research:") ? {expeditionId:key.slice(9)} : {episodeId};
      const result = observe
        ? await fetch('/api/deliberate/status?'+new URLSearchParams({sessionId,episodeId:key,wait:'1'}),{signal:controller.signal}).then(async r=>{const value=await r.json();if(!r.ok)throw new Error(value.error||'Review status unavailable');return value;})
        : await postJson("/api/deliberate", { ...target, sessionId, requestId }, { signal: controller.signal });
      if (String(result?.episodeId) !== String(episodeId)) throw new Error("The review response did not match this answer.");
      if (!turn.isConnected || controller.signal.aborted) return;
      finishActivity(activityId,result.ok?'complete':'failed');
      entry.review = result.review || null; entry.result = result;
      if (key.startsWith("research:") && researchRecords.has(key.slice(9))) researchRecords.get(key.slice(9)).reviewResult=result;
      if (result.allowance) entry.allowance = result.allowance;
      entry.costUsd = finiteNumber(result.costUsd, null);
      entry.state = reduceDeliberationEvent(entry.state, result.ok ? { status: "finished", runId: result.review?.runId } : { status: "failed", reason: result.reason });
      renderConversationLive(entry);
      if (!result.ok) {
        const message = cleanText(result.message || result.reason, 500) || "No reviewer result was available, so the answer has not been changed.";
        // Keep the explanation inside the conversation panel rather than
        // leaving an empty panel beside a separate error box.
        appendTextElement(entry.panel, "p", message, "canvasError");
        if (result.review) {
          renderReviewSummary(turn, result.review, result);
          await revealConversation(entry, result.review, result);
        }
        if (controller.signal.aborted || !turn.isConnected) return;
        say(`The MOMM review could not be completed. ${message}`);
        setLiveStatus("The MOMM review could not be completed. Available reviewer findings are shown below.");
        return;
      }
      renderReviewSummary(turn, result.review, result);
      if (result.canvas) renderCanvasWorkspace(turn, result.canvas);
      completed = true;
      setLiveStatus("MOMM review ready. Reviewer verdicts are appearing in the conversation.");
      await revealConversation(entry, result.review, result);
      if (controller.signal.aborted || !turn.isConnected) return;
      addReviewPlayback(entry);
      if (cleanText(result.answer, 6000)) say(`MOMM's considered answer. ${cleanText(result.answer, 6000)}`);
      setLiveStatus("MOMM review ready. Press Read the conversation to hear each reviewer in its own voice.");
    } catch (error) {
      finishActivity(activityId,error.name==='AbortError'?'paused':'failed');
      if(error.name==='AbortError'){detached=true;return;}
      entry.state = reduceDeliberationEvent(entry.state, { status: "failed", reason: error.message });
      renderConversationLive(entry);
      if (turn.isConnected) showAnswerToolError(turn, error.name === "AbortError" ? "Stopped displaying the review here. Its saved status remains available." : `The review could not be completed: ${error.message}`);
      setLiveStatus(error.name === "AbortError" ? "MOMM review stopped." : "The MOMM review could not be completed.");
    } finally {
      entry.observing=false;clearInterval(entry.timer); entry.timer = null;
      activeToolControllers.delete(controller); refreshActivityState();
      if (!controller.signal.aborted) flushDeferredResearchSpeech();
      if (turn.isConnected) {
        button.disabled = completed||detached; button.textContent = detached ? "MOMM status saved; review may still be running" : completed ? "MOMM review complete" : "Think harder with MOMM"; turn.setAttribute("aria-busy", "false");
        if (!completed&&!detached) setLiveStatus(controller.signal.aborted ? "Review observation paused." : "MOMM review did not complete. Read the available findings below or retry.");
      }
    }
  }

  function addReviewPlayback(entry) {
    if (!entry.result?.answer || entry.controlsEl.querySelector(".readReview")) return;
    const read = document.createElement("button"); read.type = "button"; read.className = "readReview"; read.textContent = "Read improved answer aloud";
    read.onclick = () => readAloud(entry.result.answer);
    entry.controlsEl.prepend(read);
  }

  function restoreReview(turn, result) {
    const key = validResearchId(result?.episodeId);
    if (!key || deliberations.has(key)) return;
    if(['accepted','dispatching','reviewing'].includes(result.operation?.phase)){void deliberateAnswer(turn,key,{observe:true});return;}
    const entry = {turn,episodeId:key,state:createConversationState(key),review:result.review,result,allowance:result.allowance,costUsd:result.costUsd,revealed:false,playing:false,paused:false,timer:null};
    buildConversationPanel(turn,entry); deliberations.set(key,entry);
    entry.state=reduceDeliberationEvent(entry.state,{status:result.ok ? "finished" : "failed"});
    renderConversationLive(entry); renderReviewSummary(turn,result.review,result);
    void revealConversation(entry,result.review,result).then(()=>addReviewPlayback(entry)).catch(()=>setLiveStatus("The saved review could not be displayed."));
    const button=turn.querySelector(".deliberate");
    if(button) { button.disabled=Boolean(result.ok);button.textContent=result.ok ? "MOMM review complete" : "Retry MOMM review";button.onclick=()=>deliberateAnswer(turn,key); }
  }

  async function generateCanvasFromAction(turn, actionId, generation) {
    if (typeof actionId !== "string" || !/^[a-z0-9_.:-]{8,200}$/i.test(actionId)) {
      showAnswerToolError(turn, "The visual request was missing its secure action reference.");
      return;
    }
    const key = actionIdentity({ kind: "generate_canvas", actionId });
    const existing = renderedActions.get(key);
    if (existing?.isConnected) { existing.scrollIntoView({ block: "nearest", behavior: "smooth" }); setLiveStatus("That visual is already open."); return; }
    const panel = turn.querySelector(".canvasWorkspace");
    panel.replaceChildren(); appendTextElement(panel, "p", "Building an accessible visual…", "muted"); panel.classList.remove("hidden");
    renderedActions.set(key, panel); turn.setAttribute("aria-busy", "true");
    let outcome = "";
    setLiveStatus("Building an accessible visual.");
    const visualActivity='visual:'+actionId;activity.start(visualActivity,'visual');
    const requestId = newRequestId();
    const controller = new AbortController(); activeToolControllers.add(controller); refreshActivityState();
    try {
      const result = await postJson("/api/canvas", { actionId, sessionId, requestId }, { signal: controller.signal });
      if (controller.signal.aborted || !turn.isConnected || generation !== responseGeneration) { renderedActions.delete(key); return; }
      if (!result?.ok) {
        const message = cleanText(result?.narration || result?.reason, 500) || "The visual could not be independently checked, so it has not been drawn.";
        panel.replaceChildren(); appendTextElement(panel, "h3", "Visual not shown"); appendTextElement(panel, "p", message, "canvasError"); panel.classList.remove("hidden");
        if (result?.review) renderReviewSummary(turn, result.review);
        renderedActions.delete(key);
        outcome = "The visual could not be safely completed. You can retry the request.";
        return;
      }
      if (generation !== responseGeneration) { renderedActions.delete(key); return; }
      const drawn = renderCanvasWorkspace(turn, result.spec, cleanText(result.narration, 1600));
      if (result.review) renderReviewSummary(turn, result.review);
      if (!drawn) renderedActions.delete(key);
      outcome = drawn ? "Visual and text alternative ready." : "The visual could not be drawn. Its safe text alternative is available.";
      say(outcome);
    } catch (error) {
      renderedActions.delete(key);
      if (turn.isConnected) {
        const message = error.name === "AbortError" ? "The visual request was stopped." : `The visual could not be completed: ${error.message}`;
        panel.replaceChildren(); appendTextElement(panel, "p", message, "canvasError");
        showAnswerToolError(turn, message);
      }
      outcome = error.name === "AbortError" ? "Visual request stopped." : "The visual could not be completed. Ask for the chart again to retry.";
    } finally {
      activeToolControllers.delete(controller); refreshActivityState();
      if (turn.isConnected) turn.setAttribute("aria-busy", "false");
      finishActivity(visualActivity,controller.signal.aborted?'paused':outcome?.includes('ready')?'complete':'failed');
      if (turn.isConnected && generation === responseGeneration && outcome) setLiveStatus(outcome);
      if (!controller.signal.aborted) flushDeferredResearchSpeech();
    }
  }

  async function ask(question, { source = "typed", recognitionConfidence = null, confirmed = false, researchTurnId = null, preserveSpeech = false, canDispatch = null } = {}) {
    if(canDispatch && !canDispatch())return;
    const problem = messageProblem(question);
    if (problem) {
      const input = $("#askText");
      if (typeof question === "string") input.value = question;
      input.dispatchEvent?.(new Event("change"));
      input.setAttribute("aria-invalid", "true");
      heard.textContent = problem; setLiveStatus(problem); input.focus(); return;
    }
    const intendedSession = sessionId, readiness = historyReady;
    if(!preserveSpeech)searchGeneration += 1;
    typedActivity.clear();stopListening({discard:true});
    const pending={activityId:'answer:'+newRequestId()};for(const previous of pendingAsks)finishActivity(previous.activityId,'stopped');pendingAsks.clear();pendingAsks.add(pending);activity.start(pending.activityId);refreshActivityState();
    try { await readiness; } catch {
      const current=pendingAsks.delete(pending) && sessionId===intendedSession && historyReady===readiness;
      finishActivity(pending.activityId,'failed');refreshActivityState();if(current) { const input = $("#askText"); if (input.value === "") { input.value = question; input.dispatchEvent?.(new Event("input")); } setLiveStatus("Could not prepare this conversation. Your question has not been sent; please try again."); } return;
    }
    const stillPending=pendingAsks.delete(pending);
    if (!stillPending || sessionId !== intendedSession || historyReady !== readiness || (canDispatch && !canDispatch())) { finishActivity(pending.activityId,'stopped');refreshActivityState();return; }
    const questionKey = String(question).trim().toLowerCase();
    if (activeController && activeQuestion === questionKey) { finishActivity(pending.activityId,'stopped');heard.textContent = "I’m already working on that."; return; }
    const resumeAfterAnswer = wantListening;
    closeSpeechConfirm();
    if(!preserveSpeech)hush({ preserveListening: true, clearDeferred: false });
    wantListening = resumeAfterAnswer;
    const controller = new AbortController(); activeController = controller;
    controller.activityId=pending.activityId;controller.signal.addEventListener('abort',()=>finishActivity(controller.activityId,'stopped'),{once:true});
    let settleAnswer;controller.settled=new Promise(resolve=>{settleAnswer=resolve;});
    refreshActivityState();
    try {
    const generation = ++responseGeneration;
    activeQuestion = questionKey;
    const requestId = newRequestId(); clientTurn += 1; rememberClientTurn();
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.requestId = requestId;
    activeTurnElement = el;
    el.dataset.question = String(question);
    el.setAttribute("aria-busy", "true");
    el.querySelector(".q").textContent = question;
    const a = el.querySelector(".a"); a.classList.add("streaming");
    transcript.prepend(el);
    if(!preserveSpeech)el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    let res;
    try {
      res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, sessionId, source, recognitionConfidence, confirmed, researchTurnId, replacePrevious: true, requestId, clientTurn }), signal: controller.signal });
      if (!res.ok || !String(res.headers.get("content-type") || "").includes("text/event-stream")) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `request failed (${res.status})`);
      }
    } catch (err) {
      a.classList.remove("streaming");
      finishActivity(controller.activityId,err.name==='AbortError'?'stopped':'failed');
      a.textContent = err.name === "AbortError" ? "Stopped." : err instanceof TypeError ? "I couldn’t connect to Mannin. Please try again." : err.message;
      el.setAttribute("aria-busy", "false");
      const input = $("#askText");
      const current = generation === responseGeneration && sessionId === intendedSession && activeController === controller;
      const restoreDraft = err.name !== "AbortError" && !controller.signal.aborted &&
        current && input.value === "";
      if (restoreDraft) { input.value = question; input.dispatchEvent?.(new Event("input")); }
      if (activeController === controller) { activeController = null; activeQuestion = ""; activeTurnElement = null; refreshActivityState(); }
      markIncomplete(el, err.name === "AbortError" ? "Stopped — this answer is incomplete." : restoreDraft ? "No answer was received. Your question is back in the input for editing or retrying." : "No answer was received. You can try again.", current);
      if(current && err.name!=="AbortError")resumeIfConversation();
      return;
    }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "", sawDone = false;
    let streamFailure = null;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          let event = "message", data = "";
          for (const line of chunk.split("\n")) { if (line.startsWith("event:")) event = line.slice(6).trim(); else if (line.startsWith("data:")) data += line.slice(5).trim(); }
          if (!data) continue;
          let payload; try { payload = JSON.parse(data); } catch { continue; }
          if (!isCurrentResponse(generation, controller)) { await reader.cancel().catch(() => {}); break; }
          if (event === "done") sawDone = true;
          // A server-reported failure is terminal and is the failure to show,
          // not "the connection ended".
          if (event === "error") { sawDone = true; streamFailure = `Mannin reported a failure: ${payload?.message || "unknown error"}`; }
          handle(event, payload, el, generation, controller);
        }
        if (!isCurrentResponse(generation, controller)) break;
      }
    } catch (err) { if (err.name !== "AbortError") streamFailure = `Connection ended before the answer finished: ${err.message}`; }
    finishActivity(controller.activityId,controller.signal.aborted?'stopped':sawDone&&!streamFailure&&!controller.activityIncomplete?'complete':'failed');
    if (!sawDone && isCurrentResponse(generation, controller)) markIncomplete(el, streamFailure || "The connection ended before this answer finished.");
    a.classList.remove("streaming");
    el.setAttribute("aria-busy", "false");
    if (activeController === controller) {
      activeController = null;
      activeQuestion = "";
      activeTurnElement = null;
      refreshActivityState();
      drainHook = resumeIfConversation;
      if (!speaking && !speechQueue.length) onSpeechDrained();
      refreshConversationList().catch(()=>{});
      $("#historyStatus").textContent="Saved on this computer";
      // Execute only after this command's complete stream. Restoration never
      // replays paid actions; the target came from the server's saved records.
      if(sawDone && el.dataset.voiceReview && generation===responseGeneration && !controller.signal.aborted && el.isConnected){
        const key=el.dataset.voiceReview;delete el.dataset.voiceReview;
        const target=turns.get(key.startsWith('research:')?'expedition:'+key.slice(9):'episode:'+key)||el;
        const button=target.querySelector('.deliberate');
        if(button?.disabled){setLiveStatus('That MOMM review is already running or complete.');}
        else if(button){
          button.classList.remove('hidden');target.querySelector('.answerActions')?.classList.remove('hidden');
          void deliberateAnswer(target,key,{observe:true});
        }
      }
    }
    } finally { settleAnswer(); }
  }

  function handle(event, d, el, generation, controller, replay = false) {
    if (!replay && !isCurrentResponse(generation, controller)) return;
    const a = el.querySelector(".a");
    if(!replay&&controller?.activityId){
      if(event==='progress')noteActivity(controller.activityId,{phase:d.phase});
      if(event==='heartbeat')activity.heartbeat(controller.activityId);
      if(event==='tool'){const stage=toolActivity(d);if(stage)noteActivity(controller.activityId,stage);}
      if(event==='token')noteActivity(controller.activityId,{phase:'writing'});
      if(event==='error')finishActivity(controller.activityId,'failed');
      if(event==='meta')controller.activityIncomplete=d.answered===false||d.mode==='clarify';
    }
    if(event==='action' && d.kind==='review_answer'){
      if(!replay && d.serverStarted===true && typeof d.target==='string' && /^(?:research:)?[a-z0-9_.:-]{1,100}$/i.test(d.target))el.dataset.voiceReview=d.target;
    }
    else if(event==='action' && d.kind==='open_page'){
      const page=approvedPage(d.target);if(!page)return;
      const panel=el.querySelector('.note');panel.replaceChildren();
      const link=document.createElement('a');link.href=page.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open official weather';panel.appendChild(link);panel.classList.remove('hidden');
      if(!replay){
        let opened=false;
        try {const tab=window.open('about:blank','_blank');if(tab){tab.opener=null;tab.location.replace(page.href);opened=true;}}
        catch { /* Popup denied: the usable link remains in the conversation. */ }
        appendTextElement(panel,'p',opened?'Opened a browser tab for the official weather page.':'Your browser blocked the new tab. Tap the weather link to open it.');
      }
    }
    else if(event==='tool') { /* The activity panel announces the closed operation label above. */ }
    else if (event === "scope") {
      if (d.persistent === false) {
        $("#scopeLabel").textContent = "Isle of Man";
        const notice = el.querySelector(".scopeNotice");
        notice.textContent = `This answer is about ${d.jurisdiction || "the named place"} only. Your next unqualified follow-up returns to the Isle of Man.`;
        notice.classList.remove("hidden");
        const announcement = cleanText(d.announcement, 240);
        if (announcement) { say(announcement); setLiveStatus(announcement); }
      } else {
        $("#scopeLabel").textContent = d.jurisdiction || "Isle of Man";
      }
    }
    else if (event === "interpretation") {
      const interpreted = el.querySelector(".interpretation");
      interpreted.textContent = `Understood as: ${d.text}`; interpreted.classList.remove("hidden");
    }
    else if (event === "action" && d.kind === "show_manx_map") {
      const card = claimActionCard(d, el);
      if (!card) return;
      renderManxMapCard(card, d);
      setLiveStatus("Isle of Man map ready.");
    }
    else if (event === "action" && d.kind === "describe_manx_map") {
      const card = claimActionCard(d, el);
      if (!card) return;
      renderManxMapCard(card, d, { capability: true });
      setLiveStatus("Map capabilities and trusted alternatives ready.");
    }
    else if (event === "action" && d.kind === "open_full_map") {
      const href = safeMapWorkspaceHref(d.href);
      if (!href) return;
      const identity = actionIdentity({ ...d, artifact: { id: "manx-map" } });
      const existing = renderedActions.get(identity);
      if (existing?.isConnected) {
        existing.scrollIntoView({ block: "nearest", behavior: "smooth" });
        const matchingLink = [...existing.querySelectorAll("a")].find((link) => link.href === href);
        matchingLink?.focus();
        const note = el.querySelector(".note"); note.textContent = "The MANX Earth link is ready in the map above."; note.classList.remove("hidden");
      } else {
        const card = claimActionCard({ ...d, artifact: { id: "manx-map" } }, el);
        if (!card) return;
        const body = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = "MANX Earth & Street View";
        const note = document.createElement("span"); note.textContent = "Choose the locality, then open the 3D globe, imagery or Street View.";
        const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Open MANX Earth";
        body.append(title, note, link); card.classList.add("external"); card.replaceChildren(body); card.classList.remove("hidden");
      }
      setLiveStatus("MANX Earth link ready.");
    }
    else if (event === "action" && d.kind === "show_external_map" && safeOsmMapHref(d.href)) {
      const card = claimActionCard(d, el);
      if (!card) return;
      card.classList.add("external");
      const body = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = d.title || "External map";
      const note = document.createElement("span"); note.textContent = "Opens OpenStreetMap in a new tab.";
      const link = document.createElement("a"); link.href = safeOsmMapHref(d.href); link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Open map";
      body.append(title, note, link); card.replaceChildren(body); card.classList.remove("hidden");
      setLiveStatus("External map link ready.");
    }
    else if (event === "action" && d.kind === "generate_canvas") {
      void generateCanvasFromAction(el, d.actionId, generation);
    }
    else if (event === "focus") renderFocusPanel(d);
    else if (event === "token" && typeof d.text === "string") a.textContent += d.text;
    else if (event === "sentence") {if(activeProgress)hush({cancelAnswer:false,preserveListening:true,clearDeferred:false});say(d.text);}
    else if (event === "meta") {
      const clarification=d.mode==='clarify'||d.answerOutcome==='clarification_required';
      if(clarification)d={...d,answered:false,answerOutcome:'clarification_required'};
      if (el === transcript.firstElementChild) {
        if (d.jurisdiction === "Isle of Man" && d.resolvedQuestion && !d.conversationMeta) lastResolvedQuestion = d.resolvedQuestion;
        else lastResolvedQuestion = "";
      }
      a.textContent = a.textContent.replace(/\[c_[a-z0-9]+\]/g, "").replace(/\s+([.,!?;:])/g,'$1').replace(/\s{2,}/g, " ").trim();
      const row = el.querySelector(".metaRow"); row.classList.remove("hidden");
      const st = row.querySelector(".status");
      const labels = { local: "ready", model_prior: "not source-verified", single_source: "one source", corroborated: "corroborated", verified: "verified", hypothesis: "hypothesis", contested: "contested" };
      const safeStatus = STATUSES.includes(d.status) ? d.status : "model_prior";
      st.textContent = clarification?'needs clarification':labels[safeStatus] || safeStatus.replace("_", " "); st.classList.add(safeStatus);
      const conf = row.querySelector(".conf");
      if (safeStatus === "local" || safeStatus === "model_prior" || d.confidence == null) conf.classList.add("hidden");
      else conf.textContent = `evidence confidence ${Math.round(d.confidence * 100)}%`;
      row.querySelector(".cost").textContent = safeStatus === "local" ? "instant · no model cost" : `${(finiteNumber(d.durationMs) / 1000).toFixed(1)}s · ${d.costComplete===false?'at least ':''}$${finiteNumber(d.costUsd).toFixed(3)}${d.costComplete===false?' (failed lookup usage unavailable)':''}`;
      // Product explanations are runtime facts, not unsourced island claims.
      st.classList.toggle("hidden", Boolean(d.conversationMeta)&&!clarification);
      if (d.conversationMeta) conf.classList.add("hidden");
      if (d.conversationMeta && safeStatus === "local" && !clarification) row.classList.add("hidden");
      const fb = row.querySelector(".fb");
      const answerActions = el.querySelector(".answerActions");
      const deliberate = answerActions.querySelector(".deliberate");
      const resolvedQuestion = cleanText(d.resolvedQuestion, 2000) || cleanText(el.dataset.question, 2000);
      if (resolvedQuestion) el.dataset.question = resolvedQuestion;
      // An answer that never arrived is not something to vote on or pay to
      // review. The server applies the same test before it will admit the work.
      if(clarification){
        const obsoleteMenu=/^We’re focused on the Isle of Man\. Do you want its infrastructure/.test(el.querySelector('.a').textContent);
        markIncomplete(el,obsoleteMenu?'This earlier request was not answered. Retry the original question using the updated flow.':replay?'This earlier message asked for clarification; it is not a new question.':'Please answer the clarification above.',false);
        if(obsoleteMenu&&!el.querySelector('.retryOriginal')){const retry=document.createElement('button');retry.type='button';retry.className='retryOriginal';retry.textContent='Retry original question';retry.onclick=()=>ask(el.querySelector('.q').textContent);el.appendChild(retry);}
      }
      else if (d.answered === false) markIncomplete(el, d.answerOutcome==='source_unavailable'?'The source check did not produce an answer. Retry Search, or open the available source link.':"That answer did not arrive. Ask again, or rephrase it.");
      if (d.episodeId && d.answered !== false) {
        el.dataset.episode = d.episodeId; turns.set(`episode:${d.episodeId}`, el);
        row.querySelector(".up").onclick = () => vote(el, d.episodeId, 1);
        row.querySelector(".down").onclick = () => vote(el, d.episodeId, -1);
        fb.classList.remove("hidden");
        if (d.reviewable !== false && !localConversation(resolvedQuestion.replace(/^Answer this specifically for the Isle of Man:\s*/i,""))) {
          deliberate.onclick = () => deliberateAnswer(el, d.episodeId);
          deliberate.classList.remove("hidden");
          answerActions.classList.remove("hidden");
        } else { deliberate.classList.add("hidden"); answerActions.classList.add("hidden"); }
      } else { fb.classList.add("hidden"); deliberate.classList.add("hidden"); answerActions.classList.add("hidden"); }
      const srcs = el.querySelector(".sources");
      const seen = new Set(),failedSeen=new Set();
      for(const attempt of d.tools||[]){
        const href=safeExternalHref(attempt.url);
        if(!href||attempt.status!=='unavailable'||failedSeen.has(href))continue;
        failedSeen.add(href);const li=document.createElement('li'),link=document.createElement('a');
        link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open unread source in browser';
        li.append(link, ' — live read failed; no new evidence');srcs.appendChild(li);
      }
      // A citation must point at the page carrying the claim. A bare origin is
      // a website, not a reference, so it is labelled rather than passed off.
      for (const c of d.used || []) for (const s of c.sources || []) {
        const href = safeExternalHref(s.url);
        if (!href || seen.has(href)) continue;
        seen.add(href);
        let deep = false;
        try { deep = new URL(href).pathname.replace(/\/+$/, "").length > 0; } catch { deep = false; }
        const li = document.createElement("li");
        li.className = [s.primary ? "primary" : "", deep ? "" : "shallow"].filter(Boolean).join(" ");
        const link = document.createElement("a");
        link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = cleanText(s.title, 200) || href;
        li.appendChild(link);
        if (!deep) li.append(" — site homepage, not a page that carries this claim");
        srcs.appendChild(li);
      }
      if (seen.size || failedSeen.size || d.grounding?.status==='uncited_retrieval') {
        const sourceDetails=el.querySelector(".sourceDetails");
        sourceDetails.classList.remove("hidden");
        sourceDetails.querySelector("summary").textContent=seen.size?`${seen.size} source${seen.size===1?"":"s"} · view evidence`:d.grounding?.status==='uncited_retrieval'?'Evidence use':'Source access attempts';
        const sourceLabel = el.querySelector(".sourceLabel");
        sourceLabel.textContent = !seen.size && !failedSeen.size && d.grounding?.status==='uncited_retrieval'?'Relevant records were retrieved, but this answer did not cite them. Retrieval alone does not verify the answer.':!seen.size?'These pages were not read; no source evidence was obtained.':d.answerOutcome==='indexed_fallback'?'Previously indexed evidence; the live recheck failed.':safeStatus === "model_prior" ? "Sources consulted; they do not fully support this answer." : "Sources used for this answer.";
        // Name the parts the cited evidence does not carry, rather than letting
        // a badge imply the whole answer was checked.
        const unbacked = cleanText(d.entailmentNotice, 400);
        if (unbacked) appendTextElement(sourceDetails, "p", unbacked, "researchWarning");
        sourceLabel.classList.remove("hidden"); srcs.classList.remove("hidden");
      }
      renderNextSteps(el, Array.isArray(d.nextSteps) ? d.nextSteps : []);
      renderSourceAccess(el,d.tools);
      renderKnowledgeWrite(el,d.knowledgeWrite);
      renderReasoningCheck(el,d.reasoningCheck,{readAloud});
      if (d.answered !== false || clarification) addAnswerPlayback(el);
      if (d.expedition?.needed && !Array.isArray(d.nextSteps)) { const n = el.querySelector(".note"); n.textContent = "A deeper source check is available for this answer."; n.classList.remove("hidden"); }
      if (!replay) { setLiveStatus(clarification?'Clarification needed. Reply to the question above.':d.answered===false?'Source check incomplete. Recovery options are below.':"Answer ready."); loadBrain(); }
    }
    else if (event === "expedition") {
      const n = el.querySelector(".note");
      if (d.id) {
        const recovered = turns.get(`expedition:${d.id}`);
        if (recovered && recovered !== el && recovered.classList.contains("researchReturn")) recovered.remove();
        el.dataset.expedition = d.id;
        turns.set(`expedition:${d.id}`, el);
        updateResearch({
          ...d,
          question: cleanText(el.dataset.question, 2000),
          status: d.queued ? "queued" : d.alreadyRunning ? "running" : "failed",
          error: d.queued || d.alreadyRunning ? "" : d.reason,
        }, { trusted: true, turn: el, announce: false });
      }
      n.textContent = d.queued
        ? `Gone to check (${d.reason}). Progress and the result will appear below.`
        : d.alreadyRunning
          ? "That research check is already under way. Its progress will appear below."
          : `Could not launch a check: ${d.reason}`;
      n.classList.remove("hidden");
    }
    else if (event === "error") { a.textContent += `\n[error] ${d.message}`; say("I am afraid something went wrong on my side."); }
  }

  async function vote(el, episodeId, v) {
    const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episodeId, vote: v }) });
    if (!r.ok) return;
    el.querySelectorAll(".fb button").forEach((b) => b.classList.remove("sel"));
    el.querySelector(v > 0 ? ".up" : ".down").classList.add("sel");
    loadBrain();
  }

  // ---------- brain panel ----------
  // Claim text and topics are written by models and by the open web. They are
  // never interpolated into HTML: every one goes in as a text node, and status
  // values are checked against a fixed list before they become a CSS class.
  function badge(label, cls) {
    const el = document.createElement("span");
    el.className = "badge" + (cls && STATUSES.includes(cls) ? " " + cls : "");
    el.textContent = String(label).replace("_", " ");
    return el;
  }
  function plainLi(text, cls) { const li = document.createElement("li"); if (cls) li.className = cls; li.textContent = text; return li; }

  // Says which retrieval actually ran, so a keyword-only answer is never
  // mistaken for one the semantic index took part in.
  function retrievalLabel(mode) {
    switch (mode) {
      case "hybrid": return "semantic + keyword retrieval";
      case "keyword_fallback_model_unavailable": return "keyword retrieval only (local model unavailable)";
      case "ledger_fallback_index_unavailable": return "keyword retrieval only (vector index unavailable)";
      case "ledger_only_index_empty": return "keyword retrieval only (vector index empty)";
      case "ledger_only_out_of_scope": return "keyword retrieval (outside the Manx index)";
      case "live_tools": return "live source tools";
      case "not_needed": return "no ledger lookup";
      default: return "keyword retrieval";
    }
  }
  function renderFocusPanel(d) {
    $("#coverage").textContent = d.local ? "No evidence lookup needed for this action." : `coverage: ${d.coverage} (${Math.round(d.coverageRatio * 100)}%), ${d.budgetUsed} tokens · ${retrievalLabel(d.retrievalMode)}`;
    const ol = $("#focus"); ol.replaceChildren();
    for (const c of d.claims) {
      const li = document.createElement("li");
      li.append(badge(c.status, c.status), " ");
      const topic = document.createElement("span"); topic.className = "muted"; topic.textContent = c.topic || "";
      li.append(topic, ` — ${c.text}`);
      ol.appendChild(li);
    }
    if (!d.claims.length) ol.replaceChildren(plainLi(d.local ? "Handled locally without a model call." : "Nothing relevant in the Manx evidence; answering cautiously.", "muted"));
  }
  // The header says which harness and models the user is talking to, from
  // the server's own report, never from an assumption in the page.
  async function loadRuntime() {
    const badge = $("#runtime"); if (!badge) return;
    let h; try { h = await fetch("/api/health").then((r) => r.json()); } catch { badge.textContent = "runtime unknown"; return; }
    const r = h.runtime || {};
    const harness = `${r.harness || "unknown harness"}${r.harnessVersion ? " " + r.harnessVersion : r.harnessProblem ? " (not found)" : ""}`;
    const momm = r.momm?.available ? `MOMM${r.momm.version ? " " + r.momm.version : ""}` : "MOMM not installed";
    badge.textContent = `${harness} · answers: ${r.answerModel || h.model || "?"} · research: ${r.researchModel || "?"} · ${momm}`;
    badge.title = `Answers and research run through ${r.harness || "the configured harness"} under ${r.auth || "the user's account"}; reviews go through ${momm}.`;
    badge.className = r.harnessProblem ? "pill bad" : "pill";
  }
  async function loadBrain() {
    let b; try { b = await fetch("/api/brain").then((r) => r.json()); } catch { return; }
    const s = b.stats;
    const statRows = [
      ["claims", s.claims], ["verified", s.byStatus.verified || 0], ["contested", s.byStatus.contested || 0],
      ["learned", (s.byKind.learned || 0) + (s.byKind.lateral || 0)], ["gaps open", s.gapsOpen], ["calibration", s.calibration.ece == null ? "—" : `ECE ${s.calibration.ece}`],
      ["answers", s.episodes.n], ["feedback", `${s.episodes.up}↑ ${s.episodes.down}↓`], ["spent", `$${(s.episodes.costUsd + s.expeditions.costUsd).toFixed(2)}`],
      // Growth of the Manx ledger and whether the semantic index has kept up
      // with it, so building it out is visible as it happens.
      ...(b.overview ? [["Manx claims", b.overview.live], ["topics", b.overview.topics], [`+${b.overview.recentDays} days`, b.overview.recent], ["primary sourced", b.overview.official]] : []),
      ...(b.retrieval?.ledger ? [["indexed", `${b.retrieval.ledger.indexed}/${b.retrieval.ledger.indexable}`]] : []),
    ];
    // Server JSON is rendered as text, never interpolated into markup.
    const stats = $("#stats"); stats.replaceChildren();
    for (const [k, v] of statRows) {
      const stat = document.createElement("div"); stat.className = "stat";
      const value = document.createElement("b"); value.textContent = String(v);
      const label = document.createElement("span"); label.textContent = String(k);
      stat.append(value, label); stats.appendChild(stat);
    }
    const ul = $("#learned"); ul.replaceChildren();
    for (const c of b.learned) {
      const li = document.createElement("li");
      li.append(badge(c.status, c.status));
      if (c.kind === "lateral") li.append(badge("lateral"));
      li.append(" " + c.text);
      ul.appendChild(li);
    }
    if (!b.learned.length) ul.replaceChildren(plainLi("Nothing learned yet. Ask something the ledger does not cover, or press Dream.", "muted"));
    const reviewAvailability = b.mommAllowance && Number.isFinite(Number(b.mommAllowance.remaining))
      ? `${b.mommAllowance.remaining} MOMM review slots left this hour`
      : "MOMM review availability unknown";
    health.textContent = `Isle of Man · ${b.expeditions.running ? "research running" : b.expeditions.queued.length ? b.expeditions.queued.length + " research checks queued" : "ready"} · ${b.expeditions.budgetLeft} research checks available · ${reviewAvailability}`;
    health.className = "pill ok";
  }

  // ---------- live event feed ----------
  const feed = $("#feed");
  function feedLine(cls, text) {
    const li = document.createElement("li"); li.className = cls;
    const t = document.createElement("time"); t.textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    li.append(t, String(text));
    feed.prepend(li); while (feed.children.length > 40) feed.lastChild.remove();
  }
  function researchEventData(event) {
    try { const value = JSON.parse(event.data); return value && typeof value === "object" ? value : null; }
    catch { return null; }
  }

  function currentResearchEventData(event, connectedSession) {
    const data = researchEventData(event);
    if (!data) return null;
    const eventSession = cleanText(data.sessionId || data.session_id, 80);
    if (!eventSession || eventSession !== connectedSession || connectedSession !== sessionId) return null;
    return data;
  }

  let researchEventSource = null;
  function connectResearchEvents() {
    researchEventSource?.close();
    const connectedSession = sessionId;
    const es = new EventSource(`/api/events?sessionId=${encodeURIComponent(connectedSession)}`);
    researchEventSource = es;
    es.onerror = () => {
      if (researchEventSource !== es || connectedSession !== sessionId) return;
      health.textContent = "server unreachable"; health.className = "pill bad";
    };
    // After a reconnect or a missed replay window, a review that was being
    // watched may have finished unseen. Re-attach to every unfinished one
    // rather than leaving "Live updates paused" on screen for ever.
    const reobserveReviews = () => {
      for (const [key, entry] of deliberations) {
        if (!entry?.turn?.isConnected || entry.observing || ["finished", "failed"].includes(entry.state?.phase)) continue;
        void deliberateAnswer(entry.turn, key, { observe: true });
      }
    };
    es.onopen = () => {
      if (researchEventSource !== es || connectedSession !== sessionId) return;
      loadBrain(); syncResearch(); reobserveReviews();
    };
    es.addEventListener("resync", () => { if (researchEventSource === es && connectedSession === sessionId) { syncResearch(); reobserveReviews(); } });
  es.addEventListener("expedition.queued", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    feedLine("queued", `Queued: ${d.question}`);
    updateResearch({ ...d, status: "queued", progress: { stage: "queued", detail: d.reason, updatedAt: d.at } }, { announce: false });
  });
  es.addEventListener("expedition.started", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    feedLine("started", `Started (${Array.isArray(d.strategies) ? d.strategies.join(", ") : "research"}): ${d.question}`);
    updateResearch({ ...d, status: "running", progress: { stage: "started", detail: d.reason, updatedAt: d.at } }, { announce: false });
  });
  es.addEventListener("expedition.progress", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    const progress = d.progress && typeof d.progress === "object" ? d.progress : { stage: d.stage, detail: d.detail, updatedAt: d.at, count: d.count };
    feedLine("step", `${progress.stage || "research"}${progress.detail ? " — " + progress.detail : ""}`);
    updateResearch({ ...d, status: canonicalResearchStatus(d.status, "running"), progress }, { announce: false });
  });
  es.addEventListener("expedition.preview", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    const preview = d.preview && typeof d.preview === "object" ? d.preview : {
      summary: d.summary, findings: d.findings, unresolved: d.unresolved, sources: d.sources,
      officialRequested: d.officialRequested, officialSourceFound: d.officialSourceFound, officialAnswerFound: d.officialAnswerFound, deeperChecksPending: d.deeperChecksPending,
    };
    feedLine("step", `Source preview ready: ${d.question || "Manx research"}`);
    updateResearch({ ...d, status: canonicalResearchStatus(d.status, "running"), preview }, { announce: false });
  });
  es.addEventListener("expedition.step", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    feedLine("step", `${d.step}${d.detail ? " — " + d.detail : ""}${d.count != null ? " (" + d.count + ")" : ""}${d.reviewers ? " " + d.reviewers.join(" ") : ""}${d.error ? " ✗ " + d.error : ""}`);
    if (d.hypotheses) for (const h of d.hypotheses) feedLine("step", `   ↳ [${h.operator}] ${h.hypothesis}`);
    updateResearch({ ...d, status: "running", progress: { stage: d.step, detail: d.detail || d.error, count: d.count, updatedAt: d.at } }, { announce: false });
  });
  es.addEventListener("expedition.momm", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    if (d.momm === "reviewer.completed") feedLine("step", `   momm ${d.agent}: ${d.verdict || d.status || "done"}`);
    const reviewer = d.agent ? `${d.agent}: ${d.verdict || d.status || d.momm || "working"}` : "Independent review is running";
    updateResearch({ ...d, status: "running", progress: { stage: "cross_model", detail: reviewer, updatedAt: d.at } }, { announce: false });
  });
  es.addEventListener('heartbeat',()=>{if(connectedSession===sessionId)activity.heartbeatBackground();});
  es.addEventListener("momm.deliberation", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    const key=cleanText(d.episodeId,100),entry=deliberations.get(key);
    if(!entry?.observing && ['started','finished','failed'].includes(d.status)){
      const target=turns.get('episode:'+key)||turns.get('expedition:'+key.replace(/^research:/,''))||entry?.turn;
      if(target?.isConnected)void deliberateAnswer(target,key,{observe:true});
    }
    if (!entry || !entry.turn.isConnected) return;
    entry.state = reduceDeliberationEvent(entry.state, d);
    const phase=entry.state.phase;
    if(['finished','failed'].includes(phase))finishActivity('review:'+key,phase==='finished'?'complete':'failed');
    else {const lanes=Object.values(entry.state.lanes),eligible=lanes.filter(l=>l.reviewerStatus!=='self_excluded'),successful=eligible.filter(l=>l.reviewerStatus==='success').length,ended=eligible.filter(l=>['done','unavailable'].includes(l.phase)).length;noteActivity('review:'+key,{phase:phase==='synthesising'?'synthesising':'reviewing',detail:eligible.length?successful+' successful, '+(ended-successful)+' unavailable; '+Math.max(0,eligible.length-ended)+' still waiting.':'Waiting for reviewer updates.'});}

    if (d.allowance && typeof d.allowance === "object") entry.allowance = d.allowance;
    if (d.status === "finished" && Number.isFinite(Number(d.costUsd))) entry.costUsd = Number(d.costUsd);
    renderConversationLive(entry);
    if (d.event === "reviewer.completed") feedLine("step", `momm ${cleanText(d.agent, 40)}: ${cleanText(d.verdict || d.reviewerStatus, 40) || "done"}`);
  });
  es.addEventListener("expedition.failed", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    feedLine("failed", `Failed: ${d.error}`);
    const el = turns.get(`expedition:${d.id}`);
    renderResearchFailure(d, el);
    loadBrain();
  });
  es.addEventListener("expedition.finished", (e) => {
    const d = currentResearchEventData(e, connectedSession); if (!d) return;
    feedLine("finished", `Finished: ${Array.isArray(d.learned) ? d.learned.length : 0} claims, $${finiteNumber(d.costUsd).toFixed(3)} — ${d.question}`);
    const el = turns.get(`expedition:${d.id}`);
    const canSpeakNow = canSpeakBackgroundUpdate();
    updateResearch({
      ...d,
      status: canonicalResearchStatus(d.status, d.answered ? "done" : d.productive ? "partial" : "empty"),
    }, { turn: el });
    if (!canSpeakNow && speakLearned.checked) setLiveStatus("Research finished. Its result is visible now; the spoken update will follow when Mannin is free.");
    loadBrain();
  });
  }

  historyReady=restoreConversation(sessionId).then(()=>connectResearchEvents());
  setInterval(() => { if (!document.hidden && [...researchRecords.values()].some(row => ACTIVE_RESEARCH_STATUSES.has(row.status))) void syncResearch(); },5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { void syncResearch(); refreshActivityState(); } });
  loadBrain();
  loadRuntime();
  fetch("/api/health").then((r) => r.json()).then((h) => { if (!h.momm) feedLine("failed", "momm dispatcher not found: cross-model corroboration disabled"); }).catch(() => {});
})();
