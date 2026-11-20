/* =====================================================================
   FEKRA (فكرة) — the GDRFA innovation assistant (browser side)
   The conversation lives only in this page (cleared on reset or inactivity);
   every AI step goes through the server (/api/fekra/*), which holds the key.
   Uses helpers from app.js: $, $$, esc, ic, toast, state, CONFIG, VIEWS,
   RENDER, ACTIONS, navigate, showOverlay, hideOverlay, confirmDialog, REDUCED.
   ===================================================================== */
(() => {
  const STAGES = ['discover', 'validate', 'design', 'evaluate', 'propose'];
  const SECTIONS = ['executiveSummary', 'challenge', 'innovation', 'assessment', 'alignment', 'technology', 'value', 'roadmap', 'resources', 'risks', 'metrics', 'recommendation'];
  const MAX_INPUT = 2000;

  const T = {
    en: {
      dir: 'ltr', brand: 'Fekra', tagline: 'Your Idea, Our Future', headline: 'Your Next Big Idea Starts Here.', sub: 'Explore it. Validate it. Bring it to life.',
      greeting: 'Welcome to Fekra! Every great innovation begins with an idea. Tell me what you have in mind, and let’s explore how we can turn it into something extraordinary for GDRFA.',
      startHint: 'Choose a starting point, or simply describe your idea below.',
      starts: [['Improve an Existing Service', 'I’d like to improve an existing service: '], ['Automate a Process', 'I want to automate a process that is currently done '], ['Enhance Customer Experience', 'I have an idea to improve the customer experience: '], ['Explore an AI-Powered Idea', 'I’d like to explore how AI could help with '], ['Solve an Operational Challenge', 'There’s an operational challenge I’d like to solve: '], ['I Have a Completely New Idea', 'I have a completely new idea: ']],
      stages: ['Discover', 'Validate', 'Design', 'Evaluate', 'Propose'],
      placeholder: 'Describe your idea, or answer Fekra…', send: 'Send', you: 'You', fekra: 'Fekra', aiLabel: 'AI guidance', edit: 'Edit',
      privacy: 'Fekra sends your conversation to Claude (Anthropic’s AI) to respond, and the innovation check searches the web. Nothing is stored on this kiosk or server: save a draft to keep your work. Please don’t share personal data or classified information.',
      notConfigured: 'Fekra’s AI service isn’t connected on this installation, so it can’t respond yet. An administrator needs to set ANTHROPIC_API_KEY on the server. Nothing you type is sent anywhere.',
      offline: 'Fekra needs the kiosk server. Open the app through its web address rather than as a local file.',
      thinking: 'Fekra is thinking…', checking: ['Searching UAE and international sources…', 'Reading and comparing similar solutions…', 'Writing the assessment…'], writing: 'Writing your proposal…', revising: 'Rewriting this section…', submitting: 'Sending…',
      retry: 'Try again',
      errors: { not_configured: 'Fekra’s AI service isn’t connected yet.', ai_disabled: 'Fekra’s AI service is switched off.', hourly_budget: 'Fekra has reached its usage limit for this hour. Please try again later.', circuit_open: 'The AI service is briefly unavailable. Please try again in a minute.', timeout: 'That took too long. Please try again.', refusal: 'Fekra can’t help with that request.', rate: 'Too many requests at once. Please wait a moment.', offline: 'Fekra needs the kiosk server.', default: 'Fekra couldn’t respond just now. Your conversation is safe; please try again.' },
      panel: 'Live proposal', hidePanel: 'Hide', showPanel: 'Live proposal', titlePh: 'Your idea’s title will appear here as it takes shape.',
      fields: { problem: 'Problem or opportunity', beneficiaries: 'Who benefits', currentProcess: 'How it works today', solution: 'Proposed solution', innovation: 'What’s innovative', technologies: 'Recommended technologies', value: 'Expected value', kpis: 'Success measures', risks: 'Risks to manage', assumptions: 'Assumptions to verify' },
      assessment: 'Innovation assessment', notChecked: 'Not checked yet. The innovation check searches for similar solutions in the UAE and internationally.', stillNeeded: 'Still needed',
      parts: (n, t) => `${n} of ${t} parts drafted`, partNames: ['Idea', 'Problem', 'Beneficiaries', 'Solution', 'Innovation check', 'Technology', 'Value and measures'],
      runCheck: 'Run innovation check', rerunCheck: 'Run the check again', generate: 'Generate My Innovation Proposal', openProposal: 'Open my proposal',
      checkNeedsIdea: 'Describe the idea and the problem first.', proposalNeeds: 'Fekra needs at least the problem and the proposed solution.',
      noSearch: 'Live web research isn’t connected, so the check can only report that no comparison was possible.',
      status: { already_implemented: 'Already implemented', partially_implemented: 'Partially implemented', not_found: 'No equivalent found', inconclusive: 'Inconclusive' },
      checkMeta: (n, d) => `Innovation check · live web search · ${n} source${n === 1 ? '' : 's'} · ${d}`, checkMetaNone: d => `Innovation check · no web research was possible · ${d}`,
      similar: 'Similar solutions', exists: 'What already exists', different: 'What could be different', opportunities: 'Opportunities', limitations: 'Research limitations', sources: 'Sources (from the live search)',
      closeness: { high: 'very similar', partial: 'partly similar', low: 'loosely related' },
      notProof: 'Not finding a match does not prove the idea has never been implemented anywhere.', aiWritten: 'Assessment written by AI from the sources listed. Check the sources before relying on it.',
      checkFollow: ['What do these findings mean for my idea?', 'How can my idea be different?'],
      lang: 'العربية', langTitle: 'Switch to Arabic', newIdea: 'New idea', openDraft: 'Open draft', saveDraft: 'Save draft',
      newIdeaTitle: 'Start a new idea?', newIdeaText: 'The current conversation and proposal will be cleared from this screen. Save a draft first if you want to keep them.', cancel: 'Cancel', clear: 'Clear',
      tabs: ['Conversation', 'Proposal'],
      doc: { kicker: 'Innovation Proposal', draftNote: 'Draft prepared with Fekra, the GDRFA innovation assistant. Review before submission.', back: 'Back to conversation', pdf: 'Export PDF', save: 'Save draft', submit: 'Submit for Management Review', regenerate: 'Regenerate', edit: 'Edit', improve: 'Improve with AI', saveEdit: 'Save', cancel: 'Cancel', undo: 'Undo', improvePh: 'How should Fekra improve this section?', improveGo: 'Rewrite', quick: ['More concise', 'More persuasive', 'More detail', 'Simpler language'], titleLabel: 'Proposal title', date: 'Date', status: 'Status: draft for management review', sourcesNote: 'Verified sources from the innovation check:' },
      sections: { executiveSummary: 'Executive Summary', challenge: 'Current Challenge / Opportunity', innovation: 'Proposed Innovation', assessment: 'Innovation Assessment', alignment: 'Strategic Alignment', technology: 'Recommended Technology', value: 'Expected Business Value', roadmap: 'Implementation Roadmap', resources: 'Resources & Dependencies', risks: 'Risks & Mitigation', metrics: 'Success Metrics', recommendation: 'Recommendation & Next Steps' },
      pendingTitle: 'Submission isn’t connected yet', pendingText: 'Your proposal has not been sent. The management review system hasn’t been connected to Fekra yet. Export it as a PDF or save the draft, and share it through your usual channel. Once GDRFA connects the review system, this button will send the proposal and show its reference number.',
      sentTitle: 'Proposal submitted', sentText: ref => ref ? `Your proposal was sent for management review. Reference: ${ref}` : 'Your proposal was sent for management review.', ok: 'OK',
      draftSaved: 'Draft saved to your device.', draftLoaded: 'Draft opened.', draftBad: 'That file isn’t a Fekra draft.', exportNote: 'In the print window, choose “Save as PDF”.'
    },
    ar: {
      dir: 'rtl', brand: 'فكرة', tagline: 'فكرتك، مستقبلنا', headline: 'فكرتك الكبيرة القادمة تبدأ هنا.', sub: 'استكشفها. تحقّق منها. اجعلها واقعاً.',
      greeting: 'أهلاً بك في فكرة! كل ابتكار عظيم يبدأ بفكرة. شاركني فكرتك، وخلّينا نستكشف معاً كيف نحولها إلى مشروع مبتكر يصنع فرقاً في إقامة دبي.',
      startHint: 'اختر نقطة بداية، أو صف فكرتك ببساطة في الأسفل.',
      starts: [['تحسين خدمة قائمة', 'أريد تحسين خدمة قائمة: '], ['أتمتة إجراء', 'أريد أتمتة إجراء يتم حالياً '], ['تعزيز تجربة المتعاملين', 'لدي فكرة لتحسين تجربة المتعاملين: '], ['استكشاف فكرة بالذكاء الاصطناعي', 'أود استكشاف كيف يمكن للذكاء الاصطناعي أن يساعد في '], ['حل تحدٍّ تشغيلي', 'هناك تحدٍّ تشغيلي أود حله: '], ['لدي فكرة جديدة كلياً', 'لدي فكرة جديدة كلياً: ']],
      stages: ['اكتشف', 'تحقّق', 'صمّم', 'قيّم', 'اقترح'],
      placeholder: 'صف فكرتك، أو أجب على فكرة…', send: 'إرسال', you: 'أنت', fekra: 'فكرة', aiLabel: 'إرشاد بالذكاء الاصطناعي', edit: 'تعديل',
      privacy: 'ترسل فكرة محادثتك إلى Claude (الذكاء الاصطناعي من Anthropic) للرد عليك، ويبحث فحص الابتكار في الإنترنت. لا يُحفظ شيء على هذا الجهاز أو الخادم: احفظ مسودة للاحتفاظ بعملك. يُرجى عدم مشاركة بيانات شخصية أو معلومات مصنّفة.',
      notConfigured: 'خدمة الذكاء الاصطناعي في فكرة غير متصلة في هذا التثبيت، لذا لا يمكنها الرد بعد. يحتاج المسؤول إلى ضبط ANTHROPIC_API_KEY على الخادم. لا يُرسل أي شيء تكتبه إلى أي مكان.',
      offline: 'تحتاج فكرة إلى خادم الكشك. افتح التطبيق من عنوانه على الويب وليس كملف محلي.',
      thinking: 'فكرة تفكّر…', checking: ['البحث في المصادر الإماراتية والدولية…', 'قراءة الحلول المشابهة ومقارنتها…', 'كتابة التقييم…'], writing: 'كتابة مقترحك…', revising: 'إعادة صياغة هذا القسم…', submitting: 'جارٍ الإرسال…',
      retry: 'حاول مرة أخرى',
      errors: { not_configured: 'خدمة الذكاء الاصطناعي في فكرة غير متصلة بعد.', ai_disabled: 'خدمة الذكاء الاصطناعي في فكرة متوقفة.', hourly_budget: 'بلغت فكرة حد الاستخدام لهذه الساعة. يُرجى المحاولة لاحقاً.', circuit_open: 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد دقيقة.', timeout: 'استغرق الأمر وقتاً طويلاً. يُرجى المحاولة مرة أخرى.', refusal: 'لا يمكن لفكرة المساعدة في هذا الطلب.', rate: 'طلبات كثيرة في وقت واحد. انتظر لحظة.', offline: 'تحتاج فكرة إلى خادم الكشك.', default: 'تعذّر على فكرة الرد الآن. محادثتك محفوظة؛ يُرجى المحاولة مرة أخرى.' },
      panel: 'المقترح المباشر', hidePanel: 'إخفاء', showPanel: 'المقترح المباشر', titlePh: 'سيظهر عنوان فكرتك هنا عندما تتضح.',
      fields: { problem: 'المشكلة أو الفرصة', beneficiaries: 'المستفيدون', currentProcess: 'كيف يتم العمل اليوم', solution: 'الحل المقترح', innovation: 'ما الجديد فيها', technologies: 'التقنيات الموصى بها', value: 'القيمة المتوقعة', kpis: 'مؤشرات النجاح', risks: 'مخاطر يجب إدارتها', assumptions: 'افتراضات يجب التحقق منها' },
      assessment: 'تقييم الابتكار', notChecked: 'لم يُفحص بعد. يبحث فحص الابتكار عن حلول مشابهة في الإمارات وحول العالم.', stillNeeded: 'ما زال مطلوباً',
      parts: (n, t) => `${n} من ${t} أجزاء مكتملة`, partNames: ['الفكرة', 'المشكلة', 'المستفيدون', 'الحل', 'فحص الابتكار', 'التقنية', 'القيمة والمؤشرات'],
      runCheck: 'إجراء فحص الابتكار', rerunCheck: 'إعادة الفحص', generate: 'أنشئ مقترحي الابتكاري', openProposal: 'افتح مقترحي',
      checkNeedsIdea: 'صف الفكرة والمشكلة أولاً.', proposalNeeds: 'تحتاج فكرة على الأقل إلى المشكلة والحل المقترح.',
      noSearch: 'البحث المباشر على الإنترنت غير متصل، لذا لا يمكن للفحص إلا أن يوضح أن المقارنة لم تكن ممكنة.',
      status: { already_implemented: 'مطبّقة مسبقاً', partially_implemented: 'مطبّقة جزئياً', not_found: 'لم يُعثر على مثيل', inconclusive: 'غير حاسم' },
      checkMeta: (n, d) => `فحص الابتكار · بحث مباشر على الإنترنت · ${n} مصادر · ${d}`, checkMetaNone: d => `فحص الابتكار · لم يكن البحث على الإنترنت ممكناً · ${d}`,
      similar: 'حلول مشابهة', exists: 'ما هو موجود بالفعل', different: 'ما يمكن أن يميّز فكرتك', opportunities: 'الفرص', limitations: 'حدود البحث', sources: 'المصادر (من البحث المباشر)',
      closeness: { high: 'مشابه جداً', partial: 'مشابه جزئياً', low: 'ذو صلة بعيدة' },
      notProof: 'عدم العثور على مثيل لا يثبت أن الفكرة لم تُطبّق في أي مكان.', aiWritten: 'كتب الذكاء الاصطناعي هذا التقييم استناداً إلى المصادر المذكورة. راجع المصادر قبل الاعتماد عليه.',
      checkFollow: ['ماذا تعني هذه النتائج لفكرتي؟', 'كيف يمكن أن تتميز فكرتي؟'],
      lang: 'English', langTitle: 'التبديل إلى الإنجليزية', newIdea: 'فكرة جديدة', openDraft: 'فتح مسودة', saveDraft: 'حفظ المسودة',
      newIdeaTitle: 'بدء فكرة جديدة؟', newIdeaText: 'سيتم مسح المحادثة والمقترح الحاليين من هذه الشاشة. احفظ مسودة أولاً إذا أردت الاحتفاظ بهما.', cancel: 'إلغاء', clear: 'مسح',
      tabs: ['المحادثة', 'المقترح'],
      doc: { kicker: 'مقترح ابتكاري', draftNote: 'مسودة أُعدّت بمساعدة فكرة، مساعد الابتكار في الإدارة العامة للإقامة وشؤون الأجانب. تُراجع قبل التقديم.', back: 'العودة إلى المحادثة', pdf: 'تصدير PDF', save: 'حفظ المسودة', submit: 'إرسال للمراجعة الإدارية', regenerate: 'إعادة الإنشاء', edit: 'تعديل', improve: 'تحسين بالذكاء الاصطناعي', saveEdit: 'حفظ', cancel: 'إلغاء', undo: 'تراجع', improvePh: 'كيف تريد أن تحسّن فكرة هذا القسم؟', improveGo: 'إعادة الصياغة', quick: ['أكثر إيجازاً', 'أكثر إقناعاً', 'تفاصيل أكثر', 'لغة أبسط'], titleLabel: 'عنوان المقترح', date: 'التاريخ', status: 'الحالة: مسودة للمراجعة الإدارية', sourcesNote: 'مصادر موثّقة من فحص الابتكار:' },
      sections: { executiveSummary: 'الملخص التنفيذي', challenge: 'التحدي أو الفرصة الحالية', innovation: 'الابتكار المقترح', assessment: 'تقييم الابتكار', alignment: 'التوافق الاستراتيجي', technology: 'التقنيات الموصى بها', value: 'القيمة المتوقعة للأعمال', roadmap: 'خارطة طريق التنفيذ', resources: 'الموارد والاعتماديات', risks: 'المخاطر وإجراءات الحد منها', metrics: 'مؤشرات النجاح', recommendation: 'التوصية والخطوات التالية' },
      pendingTitle: 'الإرسال غير متصل بعد', pendingText: 'لم يتم إرسال مقترحك. لم يُربط نظام المراجعة الإدارية بفكرة بعد. صدّره بصيغة PDF أو احفظ المسودة وشاركه عبر القناة المعتادة. عند ربط نظام المراجعة، سيرسل هذا الزر المقترح ويعرض رقمه المرجعي.',
      sentTitle: 'تم إرسال المقترح', sentText: ref => ref ? `تم إرسال مقترحك للمراجعة الإدارية. الرقم المرجعي: ${ref}` : 'تم إرسال مقترحك للمراجعة الإدارية.', ok: 'حسناً',
      draftSaved: 'تم حفظ المسودة على جهازك.', draftLoaded: 'تم فتح المسودة.', draftBad: 'هذا الملف ليس مسودة من فكرة.', exportNote: 'في نافذة الطباعة، اختر "حفظ بتنسيق PDF".'
    }
  };

  /* a check result from a draft file is untrusted: keep only the expected shape */
  const arr = v => Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 20) : [];
  function normCheck(c) {
    if (!c || typeof c !== 'object') return null;
    return {
      status: ['already_implemented', 'partially_implemented', 'not_found', 'inconclusive'].includes(c.status) ? c.status : 'inconclusive', summary: String(c.summary || ''), searched: !!c.searched, checkedAt: c.checkedAt,
      similar: (Array.isArray(c.similar) ? c.similar : []).slice(0, 10).filter(x => x && typeof x === 'object').map(x => ({ name: String(x.name || ''), where: String(x.where || ''), description: String(x.description || ''), closeness: String(x.closeness || ''), sources: arr(x.sources) })),
      alreadyExists: arr(c.alreadyExists), different: arr(c.different), opportunities: arr(c.opportunities), limitations: arr(c.limitations),
      sources: (Array.isArray(c.sources) ? c.sources : []).slice(0, 20).filter(x => x && typeof x === 'object' && /^S\d{1,2}$/.test(x.id)).map(x => ({ id: x.id, title: String(x.title || ''), url: String(x.url || '') }))
    };
  }
  const emptyDraft = () => ({ title: '', problem: '', beneficiaries: '', currentProcess: '', solution: '', innovation: '', technologies: [], value: [], kpis: [], risks: [], assumptions: [] });
  const fresh = (lang = 'en') => ({ lang, messages: [], draft: emptyDraft(), stage: 'discover', suggestions: [], missing: [], readyForCheck: false, readyForProposal: false, check: null, doc: null, prevDoc: null, busy: null, busyStep: 0, error: null, mode: 'chat', tab: 'chat', panel: true, edit: null, improve: null, epoch: 0 });
  let fk = fresh();
  let built = false, busyTimer = 0;
  const t = () => T[fk.lang];
  const available = () => CONFIG.served && CONFIG.fekra && CONFIG.fekra.enabled;

  /* ---------- small helpers ---------- */
  const dateStr = iso => { try { return new Date(iso || Date.now()).toLocaleDateString(fk.lang === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : null;
  /* Plain text with "- " lists, **bold** and [S1] source markers -> safe HTML. */
  function rich(text, sources) {
    const srcMap = new Map((sources || []).map(s => [s.id, s]));
    const inline = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[(S\d{1,2})\]/g, (m, id) => { const src = srcMap.get(id); const u = src && safeUrl(src.url); return u ? `<a class="fk-cite" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(src.title)}">${id.slice(1)}</a>` : ''; });
    let html = '', list = [];
    const flush = () => { if (list.length) { html += `<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`; list = []; } };
    String(text || '').split(/\n/).forEach(line => {
      const l = line.trim();
      if (/^[-•*]\s+/.test(l)) list.push(l.replace(/^[-•*]\s+/, ''));
      else { flush(); if (l) html += `<p>${inline(l)}</p>`; }
    });
    flush();
    return html;
  }
  function errText(e) {
    const E = t().errors, r = e && e.reason;
    if (r && E[r]) return E[r];
    if (e && e.status === 429) return E.rate;
    if (e && e.status === 422 && e.message) return e.message;
    return E.default;
  }
  async function api(op, body, timeoutMs) {
    if (!CONFIG.served) throw Object.assign(new Error('offline'), { reason: 'offline' });
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch('api/fekra/' + op, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'HTTP ' + res.status), { reason: data.reason, status: res.status });
      return data;
    } catch (e) {
      if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { reason: 'timeout' });
      throw e;
    } finally { clearTimeout(timer); }
  }
  const convo = () => fk.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, text: m.text }));
  const parts = () => { const d = fk.draft; return [!!d.title, !!d.problem, !!d.beneficiaries, !!d.solution, !!fk.check, d.technologies.length > 0, d.value.length > 0 || d.kpis.length > 0]; };
  const canCheck = () => !!(fk.draft.problem || fk.draft.solution || fk.draft.title);
  const canPropose = () => !!(fk.draft.problem && fk.draft.solution);
  const stageDone = () => { const d = fk.draft; return { discover: !!(d.problem && d.solution), validate: !!fk.check, design: d.technologies.length > 0, evaluate: d.value.length > 0 || d.kpis.length > 0, propose: !!fk.doc }; };

  /* ---------- rendering ---------- */
  function build() {
    $('#fekraRoot').innerHTML = `
      <header class="fk-head">
        <div class="fk-brand"><span class="fk-mark" lang="ar">فكرة</span><span class="fk-bar" aria-hidden="true"></span><div><b id="fkBrand"></b><small id="fkTag"></small></div></div>
        <ol class="fk-steps" id="fkSteps" aria-label="Innovation journey"></ol>
        <div class="fk-tools">
          <button class="fk-tool" data-action="fk-lang" id="fkLang"></button>
          <button class="fk-tool" data-action="fk-open" id="fkOpen">${ic('upload')}<span></span></button>
          <button class="fk-tool" data-action="fk-save" id="fkSave">${ic('download')}<span></span></button>
          <button class="fk-tool" data-action="fk-new" id="fkNew">${ic('reset')}<span></span></button>
        </div>
      </header>
      <div class="fk-tabs" id="fkTabs" role="tablist"></div>
      <div class="fk-body" id="fkBody">
        <section class="fk-chat" aria-label="Conversation">
          <div class="fk-log" id="fkLog" aria-live="polite"></div>
          <div class="fk-suggest" id="fkSuggest"></div>
          <form class="fk-compose" id="fkCompose" autocomplete="off">
            <label class="sr-only" for="fkInput">Your message</label>
            <textarea id="fkInput" rows="1" maxlength="${MAX_INPUT}" enterkeyhint="send"></textarea>
            <button type="submit" class="fk-send" id="fkSend">${ic('send')}<span class="sr-only"></span></button>
          </form>
          <p class="fk-privacy" id="fkPrivacy">${ic('shield')}<span></span></p>
        </section>
        <aside class="fk-panel" id="fkPanel" aria-label="Live proposal"></aside>
      </div>
      <div class="fk-docwrap" id="fkDoc" hidden></div>
      <input type="file" id="fkFile" accept="application/json,.json" hidden>`;
    $('#fkCompose').addEventListener('submit', e => { e.preventDefault(); send($('#fkInput').value); });
    const input = $('#fkInput');
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
    input.addEventListener('input', () => { grow(); updateSend(); });
    $('#fkFile').addEventListener('change', e => { openDraftFile(e.target.files && e.target.files[0]); e.target.value = ''; });
    built = true;
  }
  function grow() { const i = $('#fkInput'); if (!i) return; i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 180) + 'px'; }
  function updateSend() { const i = $('#fkInput'); $('#fkSend').disabled = !!fk.busy || !available() || !i.value.trim(); }

  function render() {
    if (!built) build();
    const L = t(), root = $('#fekraRoot');
    root.setAttribute('dir', L.dir); root.setAttribute('lang', fk.lang);
    root.classList.toggle('fk-ar', fk.lang === 'ar');
    root.classList.toggle('fk-nopanel', !fk.panel);
    root.dataset.tab = fk.tab; root.dataset.mode = fk.mode;
    $('#fkBrand').textContent = fk.lang === 'ar' ? 'Fekra' : L.brand; $('#fkTag').textContent = L.tagline;
    $('#fkLang').textContent = L.lang; $('#fkLang').title = L.langTitle; $('#fkLang').setAttribute('lang', fk.lang === 'ar' ? 'en' : 'ar');
    $('#fkOpen span').textContent = L.openDraft; $('#fkSave span').textContent = L.saveDraft; $('#fkNew span').textContent = L.newIdea;
    $('#fkSave').disabled = !fk.messages.length && !fk.doc;
    $('#fkInput').placeholder = L.placeholder; $('#fkSend .sr-only').textContent = L.send; $('#fkPrivacy span').textContent = L.privacy;
    $('#fkInput').disabled = !available();
    const done = stageDone(), cur = STAGES.indexOf(fk.stage);
    $('#fkSteps').innerHTML = STAGES.map((s, i) => `<li class="${done[s] ? 'done' : ''} ${i === cur ? 'current' : ''}"${i === cur ? ' aria-current="step"' : ''}><span class="fk-dot">${done[s] ? ic('check') : i + 1}</span><span class="fk-step-l">${L.stages[i]}</span></li>`).join('<li class="fk-link" aria-hidden="true"></li>');
    $('#fkTabs').innerHTML = L.tabs.map((x, i) => { const id = i ? 'proposal' : 'chat'; return `<button role="tab" aria-selected="${fk.tab === id}" class="fk-tab${fk.tab === id ? ' active' : ''}" data-action="fk-tab" data-id="${id}">${esc(x)}</button>`; }).join('');
    renderLog(); renderSuggest(); renderPanel(); renderDoc(); updateSend();
  }

  function msgHTML(m, i) {
    const L = t();
    if (m.role === 'user') return `<div class="fk-msg user"><div class="fk-bubble">${esc(m.text).replace(/\n/g, '<br>')}</div><div class="fk-meta">${esc(L.you)}${fk.busy ? '' : ` · <button class="fk-link-btn" data-action="fk-edit-msg" data-id="${i}">${esc(L.edit)}</button>`}</div></div>`;
    if (m.role === 'assistant') return `<div class="fk-msg bot"><span class="fk-ava" aria-hidden="true">${ic('bulb')}</span><div><div class="fk-bubble">${rich(m.text, fk.check && fk.check.sources)}</div><div class="fk-meta">${esc(L.fekra)} · ${esc(L.aiLabel)}</div></div></div>`;
    if (m.role === 'check') return `<div class="fk-msg bot wide"><span class="fk-ava" aria-hidden="true">${ic('search')}</span>${checkHTML(m.check)}</div>`;
    return '';
  }
  function checkHTML(c) {
    const L = t(), srcs = c.sources || [], cite = ids => (ids || []).map(id => { const s = srcs.find(x => x.id === id), u = s && safeUrl(s.url); return u ? `<a class="fk-cite" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(id.slice(1))}</a>` : ''; }).join('');
    const list = (title, items) => items && items.length ? `<div><h5>${esc(title)}</h5><ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return `<article class="fk-check st-${esc(c.status)}">
      <div class="fk-check-head"><span class="fk-badge">${esc(L.status[c.status] || c.status)}</span><span class="fk-check-meta">${esc(c.searched ? L.checkMeta(srcs.length, dateStr(c.checkedAt)) : L.checkMetaNone(dateStr(c.checkedAt)))}</span></div>
      ${c.summary ? `<p class="fk-check-sum">${esc(c.summary)}</p>` : ''}
      ${c.similar && c.similar.length ? `<h5>${esc(L.similar)}</h5><ul class="fk-similar">${c.similar.map(x => `<li><b>${esc(x.name)}</b>${x.where ? ` <span class="fk-where">${esc(x.where)}</span>` : ''}${L.closeness[x.closeness] ? ` <span class="fk-close c-${esc(x.closeness)}">${esc(L.closeness[x.closeness])}</span>` : ''}<br>${esc(x.description)} ${cite(x.sources)}</li>`).join('')}</ul>` : ''}
      <div class="fk-cols">${list(L.exists, c.alreadyExists)}${list(L.different, c.different)}</div>
      ${list(L.opportunities, c.opportunities)}
      <h5>${esc(L.limitations)}</h5><ul>${(c.limitations || []).map(x => `<li>${esc(x)}</li>`).join('')}<li>${esc(L.notProof)}</li></ul>
      ${srcs.length ? `<h5>${esc(L.sources)}</h5><ol class="fk-sources">${srcs.map(s => { const u = safeUrl(s.url); return u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s.title || host(u))}</a> <small>${esc(host(u))}</small></li>` : ''; }).join('')}</ol>` : ''}
      <p class="fk-ai-note">${ic('info')}${esc(L.aiWritten)}</p>
    </article>`;
  }
  function welcomeHTML() {
    const L = t();
    return `<div class="fk-welcome">
      <p class="fk-kicker"><span lang="ar">فكرة</span><i></i>Fekra<b aria-hidden="true"></b></p>
      <h2>${esc(L.headline)}</h2><p class="fk-sub">${esc(L.sub)}</p>
      <div class="fk-msg bot"><span class="fk-ava" aria-hidden="true">${ic('bulb')}</span><div><div class="fk-bubble"><p>${esc(L.greeting)}</p></div><div class="fk-meta">${esc(L.fekra)}</div></div></div>
      ${available() ? `<p class="fk-hint">${esc(L.startHint)}</p><div class="fk-starts">${L.starts.map(([title], i) => `<button class="fk-start" data-action="fk-start" data-id="${i}"><span class="fk-start-ic">${ic(['reset', 'automation', 'cx', 'spark', 'briefcase', 'bulb'][i])}</span><span>${esc(title)}</span>${ic('arrow')}</button>`).join('')}</div>`
        : `<div class="fk-notice">${ic('alert')}<p>${esc(CONFIG.served ? L.notConfigured : L.offline)}</p></div>`}
    </div>`;
  }
  function busyHTML() {
    const L = t(), text = fk.busy === 'check' ? L.checking[Math.min(fk.busyStep, L.checking.length - 1)] : fk.busy === 'proposal' ? L.writing : L.thinking;
    return `<div class="fk-msg bot busy"><span class="fk-ava" aria-hidden="true">${ic(fk.busy === 'check' ? 'search' : 'bulb')}</span><div class="fk-bubble"><span class="fk-dots"><i></i><i></i><i></i></span><span class="fk-busy-t">${esc(text)}</span></div></div>`;
  }
  function renderLog() {
    const log = $('#fkLog'), L = t();
    let html = fk.messages.length ? '' : welcomeHTML();
    html += fk.messages.map(msgHTML).join('');
    if (fk.busy && fk.busy !== 'revise' && fk.busy !== 'submit') html += busyHTML();
    if (fk.error) html += `<div class="fk-msg bot error"><span class="fk-ava" aria-hidden="true">${ic('alert')}</span><div class="fk-bubble"><p>${esc(fk.error.message)}</p>${fk.error.retry ? `<button class="btn btn-ghost btn-sm" data-action="fk-retry">${ic('reset')} ${esc(L.retry)}</button>` : ''}</div></div>`;
    log.innerHTML = html;
    log.scrollTop = fk.messages.length || fk.busy || fk.error ? log.scrollHeight : 0; // the welcome reads from the top
  }
  function renderSuggest() {
    const box = $('#fkSuggest');
    const items = fk.busy || !available() ? [] : fk.suggestions;
    box.innerHTML = items.map(s => `<button class="fk-chip" data-action="fk-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join('');
  }
  function renderPanel() {
    const L = t(), d = fk.draft, p = parts(), n = p.filter(Boolean).length;
    if (!fk.panel) { $('#fkPanel').innerHTML = `<button class="fk-panel-tab" data-action="fk-panel">${ic('file')}<span>${esc(L.showPanel)}</span></button>`; return; }
    const field = (k, v) => v ? `<div class="fk-field"><h6>${esc(L.fields[k])}</h6><p>${esc(v)}</p></div>` : '';
    const listField = (k, arr) => arr && arr.length ? `<div class="fk-field"><h6>${esc(L.fields[k])}</h6><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const c = fk.check, busy = !!fk.busy;
    $('#fkPanel').innerHTML = `
      <div class="fk-panel-head"><h3>${ic('file')}${esc(L.panel)}</h3><button class="fk-link-btn" data-action="fk-panel">${esc(L.hidePanel)}</button></div>
      <div class="fk-panel-body">
        <h4 class="fk-title${d.title ? '' : ' ph'}">${esc(d.title || L.titlePh)}</h4>
        <div class="fk-parts"><div class="fk-parts-row">${p.map((ok, i) => `<span class="${ok ? 'ok' : ''}" title="${esc(L.partNames[i])}"></span>`).join('')}</div><small>${esc(L.parts(n, p.length))}</small>
          <ul class="fk-partlist">${p.map((ok, i) => `<li class="${ok ? 'ok' : ''}">${ok ? ic('check') : '<i></i>'}${esc(L.partNames[i])}</li>`).join('')}</ul></div>
        ${field('problem', d.problem)}${field('beneficiaries', d.beneficiaries)}${field('currentProcess', d.currentProcess)}${field('solution', d.solution)}${field('innovation', d.innovation)}
        <div class="fk-field fk-assess"><h6>${esc(L.assessment)}</h6>${c ? `<p><span class="fk-badge sm st-${esc(c.status)}">${esc(L.status[c.status])}</span> ${esc(c.summary || '')}</p>` : `<p class="muted">${esc(L.notChecked)}</p>`}
          ${CONFIG.fekra && CONFIG.fekra.enabled && !CONFIG.fekra.webSearch ? `<p class="muted small">${esc(L.noSearch)}</p>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="fk-check" ${busy || !available() || !canCheck() ? 'disabled' : ''} title="${canCheck() ? '' : esc(L.checkNeedsIdea)}">${ic('search')} ${esc(c ? L.rerunCheck : L.runCheck)}</button></div>
        ${d.technologies.length ? `<div class="fk-field"><h6>${esc(L.fields.technologies)}</h6><ul class="fk-tech">${d.technologies.map(x => `<li><b>${esc(x.name)}</b>${x.why ? `<span>${esc(x.why)}</span>` : ''}</li>`).join('')}</ul></div>` : ''}
        ${listField('value', d.value)}${listField('kpis', d.kpis)}${listField('risks', d.risks)}${listField('assumptions', d.assumptions)}
        ${fk.missing.length ? `<div class="fk-field fk-missing"><h6>${esc(L.stillNeeded)}</h6><ul>${fk.missing.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </div>
      <div class="fk-panel-foot">
        ${fk.doc ? `<button class="btn btn-ghost" data-action="fk-doc">${ic('file')} ${esc(L.openProposal)}</button>` : ''}
        <button class="btn btn-gold fk-generate${fk.readyForProposal && !fk.doc ? ' ready' : ''}" data-action="fk-generate" ${busy || !available() || !canPropose() ? 'disabled' : ''} title="${canPropose() ? '' : esc(L.proposalNeeds)}">${ic('spark')} ${esc(fk.doc ? L.doc.regenerate : L.generate)}</button>
        ${canPropose() ? '' : `<small class="muted">${esc(L.proposalNeeds)}</small>`}
      </div>`;
  }

  function renderDoc() {
    const box = $('#fkDoc'), doc = fk.doc, L = t(), D = L.doc;
    box.hidden = fk.mode !== 'doc' || !doc;
    if (box.hidden) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="fk-docbar">
        <button class="btn btn-ghost btn-sm" data-action="fk-chat">${ic('arrow')}<span>${esc(D.back)}</span></button>
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-sm" data-action="fk-pdf">${ic('download')} ${esc(D.pdf)}</button>
        <button class="btn btn-ghost btn-sm" data-action="fk-save">${ic('file')} ${esc(D.save)}</button>
        <button class="btn btn-gold btn-sm" data-action="fk-submit" ${fk.busy ? 'disabled' : ''}>${ic('send')} ${esc(fk.busy === 'submit' ? L.submitting : D.submit)}</button>
      </div>
      <div class="fk-paper-scroll"><article class="fk-paper" id="fkPaper">${paperHTML(true)}</article></div>`;
  }
  function paperHTML(interactive) {
    const L = t(), D = L.doc, doc = fk.doc, srcs = fk.check && fk.check.sources || [];
    const sec = k => {
      const editing = interactive && fk.edit && fk.edit.key === k, improving = interactive && fk.improve && fk.improve.key === k, busyHere = interactive && fk.busy === 'revise' && fk.improve && fk.improve.key === k;
      const tools = interactive && !editing ? `<div class="fk-sec-tools">${fk.prevDoc && fk.prevDoc.key === k ? `<button class="fk-link-btn" data-action="fk-undo">${esc(D.undo)}</button>` : ''}<button class="fk-link-btn" data-action="fk-sec-edit" data-id="${k}" ${fk.busy ? 'disabled' : ''}>${esc(D.edit)}</button><button class="fk-link-btn" data-action="fk-sec-improve" data-id="${k}" ${fk.busy ? 'disabled' : ''}>${ic('spark')}${esc(D.improve)}</button></div>` : '';
      const body = editing ? `<textarea class="fk-sec-edit" id="fkSecEdit" rows="8">${esc(doc.sections[k] || '')}</textarea><div class="fk-sec-actions"><button class="btn btn-gold btn-sm" data-action="fk-sec-save">${esc(D.saveEdit)}</button><button class="btn btn-ghost btn-sm" data-action="fk-sec-cancel">${esc(D.cancel)}</button></div>`
        : `<div class="fk-sec-body${busyHere ? ' busy' : ''}">${rich(doc.sections[k], srcs) || '<p class="muted">—</p>'}</div>`;
      const improve = improving && !editing ? `<div class="fk-improve"><div class="fk-quick">${D.quick.map(q => `<button class="fk-chip" data-action="fk-sec-quick" data-q="${esc(q)}" ${fk.busy ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div><form class="fk-improve-form" data-action-form="fk-improve"><input id="fkImprove" maxlength="1000" placeholder="${esc(D.improvePh)}"><button type="submit" class="btn btn-gold btn-sm" ${fk.busy ? 'disabled' : ''}>${esc(fk.busy === 'revise' ? L.revising : D.improveGo)}</button><button type="button" class="btn btn-ghost btn-sm" data-action="fk-sec-cancel">${esc(D.cancel)}</button></form></div>` : '';
      const refs = k === 'assessment' && srcs.length ? `<div class="fk-refs"><h6>${esc(D.sourcesNote)}</h6><ol>${srcs.map(s => { const u = safeUrl(s.url); return u ? `<li>${esc(s.title || host(u))} <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a></li>` : ''; }).join('')}</ol></div>` : '';
      return `<section class="fk-sec" id="fk-sec-${k}"><div class="fk-sec-head"><h3><span>${SECTIONS.indexOf(k) + 2}</span>${esc(L.sections[k])}</h3>${tools}</div>${body}${improve}${refs}</section>`;
    };
    return `<header class="fk-paper-head"><img src="assets/gdrfa-logo.png" alt="GDRFA"><div><p class="fk-paper-kicker">${esc(D.kicker)} · <span lang="ar">فكرة</span> Fekra</p><p class="fk-paper-meta">${esc(D.date)}: ${esc(dateStr(doc.generatedAt))} · ${esc(D.status)}</p></div></header>
      <section class="fk-sec fk-sec-title"><h6>1 · ${esc(D.titleLabel)}</h6><h1>${esc(doc.title)}</h1></section>
      ${SECTIONS.map(sec).join('')}
      <footer class="fk-paper-foot">${esc(D.draftNote)}</footer>`;
  }

  /* ---------- actions ---------- */
  function startBusy(kind) {
    fk.busy = kind; fk.busyStep = 0; fk.error = null; clearInterval(busyTimer);
    if (kind === 'check') busyTimer = setInterval(() => { fk.busyStep += 1; const el = $('#fkLog .busy .fk-busy-t'); if (el) el.textContent = t().checking[Math.min(fk.busyStep, t().checking.length - 1)]; }, 9000);
  }
  function endBusy() { fk.busy = null; clearInterval(busyTimer); }

  async function chatTurn() {
    const epoch = fk.epoch;
    startBusy('chat'); fk.suggestions = []; render();
    try {
      const r = await api('chat', { lang: fk.lang, messages: convo(), draft: fk.draft, check: fk.check }, 120000);
      if (epoch !== fk.epoch) return;
      fk.messages.push({ role: 'assistant', text: r.reply });
      Object.assign(fk, { stage: r.stage, suggestions: r.suggestions || [], draft: { ...emptyDraft(), ...r.draft }, missing: r.missing || [], readyForCheck: !!r.readyForCheck, readyForProposal: !!r.readyForProposal });
    } catch (e) {
      if (epoch !== fk.epoch) return;
      fk.error = { message: errText(e), retry: 'chat' };
    } finally { if (epoch === fk.epoch) { endBusy(); render(); const i = $('#fkInput'); if (i && !fk.error && matchMedia('(pointer:fine)').matches) i.focus(); } }
  }
  function send(text) {
    text = String(text || '').replace(/\s+$/, '').slice(0, MAX_INPUT).trim();
    if (!text || fk.busy || !available()) return;
    fk.messages.push({ role: 'user', text, snapshot: { draft: fk.draft, stage: fk.stage, missing: fk.missing, suggestions: fk.suggestions, readyForCheck: fk.readyForCheck, readyForProposal: fk.readyForProposal } });
    const i = $('#fkInput'); i.value = ''; grow();
    fk.tab = 'chat';
    chatTurn();
  }
  async function runCheck() {
    if (fk.busy || !available() || !canCheck()) return;
    const epoch = fk.epoch; fk.tab = 'chat'; startBusy('check'); render();
    try {
      const r = await api('check', { lang: fk.lang, draft: fk.draft }, 330000);
      if (epoch !== fk.epoch) return;
      fk.check = r; fk.messages.push({ role: 'check', check: r }); fk.suggestions = t().checkFollow.slice();
      if (STAGES.indexOf(fk.stage) < 1) fk.stage = 'validate';
    } catch (e) { if (epoch === fk.epoch) fk.error = { message: errText(e), retry: 'check' }; }
    finally { if (epoch === fk.epoch) { endBusy(); render(); } }
  }
  async function generate() {
    if (fk.busy || !available() || !canPropose()) return;
    const epoch = fk.epoch; fk.tab = 'chat'; startBusy('proposal'); render();
    try {
      const r = await api('proposal', { lang: fk.lang, draft: fk.draft, messages: convo(), check: fk.check }, 200000);
      if (epoch !== fk.epoch) return;
      fk.doc = { title: r.title, sections: r.sections, generatedAt: r.generatedAt, lang: fk.lang }; fk.prevDoc = null; fk.edit = fk.improve = null;
      fk.stage = 'propose'; fk.mode = 'doc';
    } catch (e) { if (epoch === fk.epoch) fk.error = { message: errText(e), retry: 'proposal' }; }
    finally { if (epoch === fk.epoch) { endBusy(); render(); } }
  }
  async function improve(instruction) {
    instruction = String(instruction || '').trim().slice(0, 1000);
    const k = fk.improve && fk.improve.key;
    if (!k || !instruction || fk.busy) return;
    const epoch = fk.epoch; startBusy('revise'); renderDoc();
    try {
      const r = await api('revise', { lang: fk.lang, key: k, text: fk.doc.sections[k], instruction, title: fk.doc.title, check: fk.check }, 120000);
      if (epoch !== fk.epoch) return;
      fk.prevDoc = { key: k, text: fk.doc.sections[k] }; fk.doc.sections[k] = r.text; fk.improve = null;
    } catch (e) { if (epoch === fk.epoch) toast(errText(e)); }
    finally { if (epoch === fk.epoch) { endBusy(); renderDoc(); } }
  }
  async function submit() {
    if (!fk.doc || fk.busy) return;
    const L = t(), epoch = fk.epoch; startBusy('submit'); renderDoc();
    try {
      const r = await api('submit', { lang: fk.lang, proposal: fk.doc, check: fk.check }, 30000);
      if (epoch !== fk.epoch) return;
      if (r.submitted) fkDialog({ icon: 'check', title: L.sentTitle, text: L.sentText(r.reference) });
      else fkDialog({ icon: 'info', title: L.pendingTitle, text: L.pendingText });
    } catch (e) {
      if (epoch !== fk.epoch) return;
      if (e.reason === 'offline') fkDialog({ icon: 'info', title: L.pendingTitle, text: L.pendingText }); else toast(errText(e));
    } finally { if (epoch === fk.epoch) { endBusy(); renderDoc(); } }
  }
  function fkDialog({ icon, title, text }) {
    $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic(icon)}</div><h3 id="confirmTitle">${esc(title)}</h3><p>${esc(text)}</p><div class="modal-actions"><button class="btn btn-primary" data-action="confirm-cancel">${esc(t().ok)}</button></div>`;
    $('#confirmBox').setAttribute('dir', t().dir); showOverlay('confirm');
  }

  /* drafts: kept only in the page; saved to and opened from a file on the employee's device */
  function saveDraft() {
    if (!fk.messages.length && !fk.doc) return;
    const data = { app: 'fekra', version: 1, savedAt: new Date().toISOString(), lang: fk.lang, stage: fk.stage, draft: fk.draft, check: fk.check, doc: fk.doc, missing: fk.missing, messages: fk.messages.map(m => m.role === 'check' ? { role: 'check', check: m.check } : { role: m.role, text: m.text }) };
    const slug = (fk.draft.title || 'idea').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'idea';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `fekra-draft-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(t().draftSaved);
  }
  function openDraftFile(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast(t().draftBad); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || d.app !== 'fekra' || !Array.isArray(d.messages)) throw new Error('bad');
        const n = fresh(d.lang === 'ar' ? 'ar' : 'en');
        n.epoch = fk.epoch + 1;
        n.messages = d.messages.filter(m => m && (((m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string') || (m.role === 'check' && m.check))).slice(-80).map(m => m.role === 'check' ? { role: 'check', check: normCheck(m.check) } : { role: m.role, text: m.text.slice(0, 8000) });
        const dd = d.draft && typeof d.draft === 'object' ? d.draft : {};
        n.draft = emptyDraft(); ['title', 'problem', 'beneficiaries', 'currentProcess', 'solution', 'innovation'].forEach(k => { n.draft[k] = typeof dd[k] === 'string' ? dd[k] : ''; });
        ['value', 'kpis', 'risks', 'assumptions'].forEach(k => { n.draft[k] = arr(dd[k]); });
        n.draft.technologies = (Array.isArray(dd.technologies) ? dd.technologies : []).filter(x => x && typeof x === 'object').slice(0, 12).map(x => ({ name: String(x.name || ''), why: String(x.why || '') }));
        n.check = normCheck(d.check);
        n.doc = d.doc && typeof d.doc === 'object' && d.doc.sections && typeof d.doc.sections === 'object' ? { title: String(d.doc.title || ''), generatedAt: d.doc.generatedAt, lang: n.lang, sections: Object.fromEntries(SECTIONS.map(k => [k, String(d.doc.sections[k] || '')])) } : null;
        n.missing = arr(d.missing).slice(0, 4);
        n.stage = STAGES.includes(d.stage) ? d.stage : 'discover';
        endBusy(); fk = n; render(); toast(t().draftLoaded);
      } catch { toast(t().draftBad); }
    };
    reader.readAsText(file);
  }
  function exportPdf() {
    if (!fk.doc) return;
    const host = $('#fkPrint');
    host.innerHTML = `<article class="fk-paper print" dir="${t().dir}" lang="${fk.lang}">${paperHTML(false)}</article>`;
    const prevTitle = document.title;
    document.title = (fk.doc.title || 'Fekra proposal').slice(0, 120);
    document.body.classList.add('fk-printing');
    const done = () => { document.body.classList.remove('fk-printing'); document.title = prevTitle; host.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    toast(t().exportNote);
    setTimeout(() => { try { window.print(); } catch { done(); } }, 60);
  }

  /* ---------- wiring into the app ---------- */
  VIEWS.push('fekra');
  RENDER.fekra = () => { render(); grow(); };
  Object.assign(ACTIONS, {
    'fk-start': d => { const i = $('#fkInput'); i.value = t().starts[+d.id][1]; grow(); updateSend(); i.focus(); i.setSelectionRange(i.value.length, i.value.length); },
    'fk-suggest': d => send(d.q),
    'fk-retry': () => { const r = fk.error && fk.error.retry; fk.error = null; if (r === 'check') runCheck(); else if (r === 'proposal') generate(); else chatTurn(); },
    'fk-edit-msg': d => {
      if (fk.busy) return;
      const i = +d.id, m = fk.messages[i]; if (!m || m.role !== 'user') return;
      if (m.snapshot) Object.assign(fk, m.snapshot);
      fk.messages = fk.messages.slice(0, i); fk.error = null; fk.epoch += 1;
      if (fk.check && !fk.messages.some(x => x.role === 'check')) fk.check = null;
      render(); const inp = $('#fkInput'); inp.value = m.text; grow(); updateSend(); inp.focus();
    },
    'fk-check': () => runCheck(),
    'fk-generate': () => generate(),
    'fk-doc': () => { fk.mode = 'doc'; render(); },
    'fk-chat': () => { fk.mode = 'chat'; fk.edit = fk.improve = null; render(); },
    'fk-panel': () => { fk.panel = !fk.panel; render(); },
    'fk-tab': d => { fk.tab = d.id; render(); },
    'fk-lang': () => { fk.lang = fk.lang === 'ar' ? 'en' : 'ar'; render(); },
    'fk-save': () => saveDraft(),
    'fk-open': () => $('#fkFile').click(),
    'fk-new': () => {
      if (!fk.messages.length && !fk.doc) return;
      const L = t();
      $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic('reset')}</div><h3 id="confirmTitle">${esc(L.newIdeaTitle)}</h3><p>${esc(L.newIdeaText)}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="confirm-cancel">${esc(L.cancel)}</button><button class="btn btn-primary" data-action="confirm-ok">${esc(L.clear)}</button></div>`;
      $('#confirmBox').setAttribute('dir', L.dir);
      confirmDialog.onOk = () => { const lang = fk.lang, e = fk.epoch + 1; endBusy(); fk = fresh(lang); fk.epoch = e; render(); };
      showOverlay('confirm');
    },
    'fk-pdf': () => exportPdf(),
    'fk-submit': () => submit(),
    'fk-sec-edit': d => { fk.edit = { key: d.id }; fk.improve = null; renderDoc(); const ta = $('#fkSecEdit'); if (ta) ta.focus(); },
    'fk-sec-save': () => { const ta = $('#fkSecEdit'); if (fk.edit && ta) { fk.prevDoc = { key: fk.edit.key, text: fk.doc.sections[fk.edit.key] }; fk.doc.sections[fk.edit.key] = ta.value.slice(0, 12000); } fk.edit = null; renderDoc(); },
    'fk-sec-cancel': () => { fk.edit = fk.improve = null; renderDoc(); },
    'fk-sec-improve': d => { fk.improve = { key: d.id }; fk.edit = null; renderDoc(); const inp = $('#fkImprove'); if (inp) inp.focus(); },
    'fk-sec-quick': d => improve(d.q),
    'fk-undo': () => { if (fk.prevDoc && fk.doc) { fk.doc.sections[fk.prevDoc.key] = fk.prevDoc.text; fk.prevDoc = null; renderDoc(); } }
  });
  document.addEventListener('submit', e => { if (e.target.matches('[data-action-form="fk-improve"]')) { e.preventDefault(); improve($('#fkImprove').value); } });

  /* reset + inactivity hooks used by app.js */
  window.fekraHasWork = () => fk.messages.length > 0 || !!fk.doc || !!($('#fkInput') && $('#fkInput').value.trim());
  window.fekraReset = () => { const e = fk.epoch + 1; endBusy(); fk = fresh('en'); fk.epoch = e; if (built) { $('#fkInput').value = ''; render(); } };
})();
