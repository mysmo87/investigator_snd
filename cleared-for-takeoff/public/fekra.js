/* =====================================================================
   FEKRA (فكرة) — the GDRFA innovation consultant (browser side)

   The employee explains an idea; Fekra does the heavy lifting:
   - chat:     a natural conversation that asks only high-value questions (POST /api/fekra/chat)
   - update:   after every exchange the structured proposal is rebuilt in the background
               (POST /api/fekra/update) and shown live in the panel, section by section
   - research: once the idea is clear, similar implementations are researched automatically
               (POST /api/fekra/check); the assessment is evidence-based or marked provisional
   - review:   the employee reviews the full proposal, approves sections (approved sections never
               change silently), edits, asks Fekra to improve a section, confirms or corrects
               assumptions, requests more research, regenerates, and approves the proposal
   - save:     proposals are saved on the server (POST/PUT /api/fekra/proposals) under a reference
               and a private access code; a QR link resumes them on another device
   - PDF:      a formatted A4 PDF is built in the browser (fekra-pdf.js) and downloaded
   Uses helpers from app.js: $, $$, esc, ic, toast, state, CONFIG, VIEWS, RENDER, ACTIONS,
   navigate, showOverlay, hideOverlay, confirmDialog, QR, ORG_LOGO.
   ===================================================================== */
(() => {
  const MAX_INPUT = 2000;

  const T = {
    en: {
      dir: 'ltr', brand: 'Fekra', tagline: 'Your Idea, Our Future', headline: 'Your Next Big Idea Starts Here.', sub: 'Explore it. Validate it. Bring it to life.',
      greeting: 'Welcome to Fekra! Every great innovation begins with an idea. Tell me what you have in mind, and let’s explore how we can turn it into something extraordinary for GDRFA.',
      howItWorks: 'Just describe your idea in your own words. Fekra researches it, builds the proposal for you as you talk, and asks only the questions that matter. You review and approve.',
      startHint: 'Choose a starting point, or simply describe your idea below.',
      starts: [['Improve an Existing Service', 'I’d like to improve an existing service: '], ['Automate a Process', 'I want to automate a process that is currently done '], ['Enhance Customer Experience', 'I have an idea to improve the customer experience: '], ['Explore an AI-Powered Idea', 'I’d like to explore how AI could help with '], ['Solve an Operational Challenge', 'There’s an operational challenge I’d like to solve: '], ['I Have a Completely New Idea', 'I have a completely new idea: ']],
      stages: ['Discover', 'Validate', 'Design', 'Evaluate', 'Propose'],
      placeholder: 'Describe your idea, or answer Fekra…', send: 'Send', you: 'You', fekra: 'Fekra', aiLabel: 'AI guidance', edit: 'Edit',
      privacy: 'Fekra sends your conversation to an AI service and researches the public web. Your work stays on this screen until you save it; saved proposals are stored on the GDRFA server under a private access code. Please don’t share personal data or classified information.',
      notConfigured: 'Fekra’s AI service isn’t connected on this installation, so it can’t respond yet. Please ask the booth team for help. Nothing you type is sent anywhere.',
      offline: 'Fekra needs the kiosk server. Open the app through its web address rather than as a local file.',
      thinking: 'Fekra is thinking…', updating: 'Updating your proposal…', researching: 'Researching similar implementations…', researchSteps: ['Searching GDRFA and UAE government sources…', 'Reviewing other governments and industries…', 'Writing the assessment…'],
      updated: n => `Proposal updated · ${n} section${n === 1 ? '' : 's'}`, updateFailed: 'The proposal couldn’t be updated just now.', researchFailed: 'Research couldn’t be completed just now.', retry: 'Try again', saving: 'Saving…', submitting: 'Sending…', writingPdf: 'Preparing the PDF…',
      errors: { not_configured: 'Fekra’s AI service isn’t connected yet.', ai_disabled: 'Fekra’s AI service is switched off.', hourly_budget: 'Fekra has reached its usage limit for this hour. Please try again later.', circuit_open: 'The AI service is briefly unavailable. Please try again in a minute.', timeout: 'That took too long. Please try again.', refusal: 'Fekra can’t help with that request.', rate: 'Too many requests at once. Please wait a moment.', offline: 'Fekra needs the kiosk server.', forbidden: 'That access code doesn’t match this proposal.', not_found: 'No saved proposal has that reference.', version_conflict: 'This proposal was saved from another screen. Reopen it to continue.', no_store: 'Saving isn’t available on this installation.', default: 'Fekra couldn’t respond just now. Your work is safe; please try again.' },
      panel: 'Live proposal', hidePanel: 'Hide', showPanel: 'Live proposal', titlePh: 'Your proposal’s title will appear here as Fekra develops it.', emptyPanel: 'Describe your idea in the conversation. Fekra fills in every section for you.',
      parts: (n, total) => `${n} of ${total} sections drafted`,
      statusName: { draft: 'Draft', under_review: 'Under review', finalized: 'Finalized' },
      sections: { overview: 'Idea overview', problem: 'Problem statement', assessment: 'Existing implementation assessment', customerBenefits: 'Benefits to customers', orgBenefits: 'Benefits to GDRFA', technology: 'Recommended technology stack', roadmap: 'Implementation approach', assumptions: 'Assumptions and validation', references: 'Research references' },
      fields: { executiveSummary: 'Executive summary', solution: 'Proposed solution', scope: 'Scope and target users', current: 'Current situation', issue: 'The problem', whyItMatters: 'Why it matters', affected: 'Who is affected', ifUnresolved: 'If it stays unresolved', reasoning: 'Reasoning', kpi: 'Suggested KPI', measurement: 'How to measure', role: 'Role in the solution', why: 'Why it is needed', dependencies: 'Data and system dependencies', considerations: 'Implementation considerations', architecture: 'Illustrative architecture', activities: 'What to do', validation: 'Validate before moving on', depsList: 'Dependencies', risks: 'Risks and mitigation', mitigation: 'Mitigation', openQuestions: 'Open questions', confirmed: 'Confirmed by you', title: 'Title', benefit: 'Benefit', name: 'Technology or capability', phase: 'Phase', risk: 'Risk', text: 'Assumption', area: 'Area' },
      phases: { discovery: 'Discovery and feasibility', poc: 'Proof of concept', pilot: 'Pilot', evaluation: 'Evaluation', rollout: 'Production rollout' },
      areas: { problem: 'Problem', solution: 'Solution', scope: 'Scope', benefits: 'Benefits', technology: 'Technology', data: 'Data', roadmap: 'Roadmap' },
      basis: { user: 'From you', inferred: 'Assumption', research: 'Verified research', recommendation: 'Fekra’s recommendation', mixed: 'From you + inferred' }, needsValidation: 'Needs validation',
      tags: { updated: 'Updated', approved: 'Approved', suggestion: 'Suggested change', empty: 'Not yet' },
      status: { already_implemented: 'Already Implemented', partially_implemented: 'Partially Implemented', not_found: 'Not Identified as Implemented', inconclusive: 'Unable to Verify' },
      provisional: 'Provisional: research has not run yet', provisionalNote: 'Fekra researches similar implementations automatically once the idea is clear. Until then, nothing is claimed about whether the idea is new.',
      scopeNames: { gdrfa: 'Within GDRFA', uae_government: 'UAE government', international_government: 'Other governments', other_industry: 'Other industries' },
      withinGdrfa: 'Within GDRFA (public sources)', otherOrgs: 'Other organisations', noneInGdrfa: 'No GDRFA initiative of this kind turned up in public sources.',
      similarities: 'Similar', differences: 'Different', closeness: { high: 'very similar', partial: 'partly similar', low: 'loosely related' },
      exists: 'What already exists', different: 'What could be different', opportunities: 'Opportunities', limitations: 'Research limitations',
      internalNote: 'GDRFA internal systems and documents were not searched: only public sources. An internal check is still needed.', notProof: 'Not finding a match does not prove the idea has never been implemented anywhere.',
      checkMeta: (n, d) => `Live public web research · ${n} source${n === 1 ? '' : 's'} · ${d}`, checkMetaNone: d => `No web research was possible · ${d}`, aiWritten: 'Assessment written by AI from the sources listed. Check the sources before relying on it.',
      researchNow: 'Research now', researchAgain: 'Request additional research', researchFocusPh: 'Optional: what should Fekra look into? (e.g. how Singapore handles this)', researchGo: 'Research',
      checkFollow: ['What do these findings mean for my idea?', 'How can my idea be different?'],
      offerReview: 'I’ve prepared an initial proposal based on our discussion and research. Would you like to review it?', reviewNow: 'Review the proposal', keepRefining: 'Keep refining',
      review: 'Review full proposal', pdf: 'Generate Proposal PDF', save: 'Save', saved: 'Saved', unsaved: 'Not saved',
      lang: 'العربية', langTitle: 'Switch to Arabic', newIdea: 'New idea', open: 'Open', translating: 'Rewriting the proposal in English…',
      newIdeaTitle: 'Start a new idea?', newIdeaText: 'The current conversation and proposal will be cleared from this screen. Save first if you want to keep them.', cancel: 'Cancel', clear: 'Clear',
      tabs: ['Conversation', 'Proposal'],
      doc: { kicker: 'Innovation Proposal', back: 'Back to conversation', approve: 'Approve', approved: 'Approved', unapprove: 'Unlock', edit: 'Edit', improve: 'Improve with AI', saveEdit: 'Save changes', cancel: 'Cancel', improvePh: 'How should Fekra improve this section?', improveGo: 'Improve', quick: ['More concise', 'More specific to GDRFA', 'More detail', 'Simpler language'], add: 'Add', remove: 'Remove',
        approveAll: 'Approve proposal', reopen: 'Reopen for editing', regenerate: 'Regenerate', submit: 'Submit for Management Review', reference: 'Reference', date: 'Date', status: 'Status', preparedWith: 'Prepared with', unsavedRef: 'Not saved yet',
        reviewHint: 'Fekra drafted every section from your conversation and research. Check the highlighted assumptions, correct anything that’s wrong, and approve the sections you agree with.',
        pendingTitle: 'Fekra suggests an update to this approved section', acceptPending: 'Use the update', keepMine: 'Keep approved version',
        confirm: 'Confirm', correct: 'Correct', correctPrefix: a => `Correction to “${a}”: `, finalizedNote: 'Finalized: approved by you. Reopen it to make changes.', regenerateTitle: 'Regenerate the proposal?', regenerateText: 'Fekra rebuilds every unlocked section from the whole conversation and research. Approved sections stay as they are.', go: 'Regenerate' },
      pdfLabels: { kicker: 'Innovation Proposal · Fekra', reference: 'Reference', unsaved: 'Unsaved draft', footer: 'Prepared with Fekra, the GDRFA innovation consultant · For management consideration · Assumptions require validation', page: (i, n) => `Page ${i} of ${n}`, untitled: 'Untitled proposal', language: 'Language', langName: 'English', assumptionsIntro: 'These points were inferred by Fekra and need confirmation before a decision:', unverified: 'Items marked “Needs validation” are expected outcomes that still require evidence.', noSources: 'No research references: the existing-implementation assessment is provisional.', none: 'None recorded.', org: 'Organisation', initiative: 'Initiative', simDiff: 'Similar / different', source: 'Source', tech: 'Technology', phase: 'Phase', basisCol: 'Basis', desc: 'Description' },
      saveTitle: 'Proposal saved', saveIntro: 'Keep this reference and access code to reopen the proposal later, on any device:', accessCode: 'Access code', scanToResume: 'Scan to continue on your phone', notPersistent: 'Note: this installation has no persistent storage configured yet, so saved proposals may be lost when the service is updated. An administrator needs to set DATA_DIR to a persistent volume.', savedVersion: v => `Saved · version ${v}`,
      openTitle: 'Open a saved proposal', openIntro: 'Enter the reference and access code you received when the proposal was saved.', refPh: 'FK-261123-ABCD', codePh: 'XXXX-XXXX-XXXX', openGo: 'Open', opened: 'Proposal opened.',
      pendingSubmitTitle: 'Submission isn’t connected yet', pendingSubmitText: 'Your proposal has not been sent. The management review system hasn’t been connected to Fekra yet. Save it or generate the PDF, and share it through your usual channel. Once GDRFA connects the review system, this button will send the proposal and show its reference number.',
      sentTitle: 'Proposal submitted', sentText: ref => ref ? `Your proposal was sent for management review. Reference: ${ref}` : 'Your proposal was sent for management review.', ok: 'OK',
      pdfDone: 'PDF downloaded.', pdfFailed: 'The PDF couldn’t be created in this browser.', needIdea: 'Describe your idea first.'
    },
    ar: {
      dir: 'rtl', brand: 'فكرة', tagline: 'فكرتك، مستقبلنا', headline: 'فكرتك الكبيرة القادمة تبدأ هنا.', sub: 'استكشفها. تحقّق منها. اجعلها واقعاً.',
      greeting: 'أهلاً بك في فكرة! كل ابتكار عظيم يبدأ بفكرة. شاركني فكرتك، وخلّينا نستكشف معاً كيف نحولها إلى مشروع مبتكر يصنع فرقاً في إقامة دبي.',
      howItWorks: 'صف فكرتك بكلماتك فقط. تبحث فكرة فيها وتبني المقترح نيابةً عنك أثناء الحديث، ولا تسأل إلا ما يهم. أنت تراجع وتعتمد.',
      startHint: 'اختر نقطة بداية، أو صف فكرتك ببساطة في الأسفل.',
      starts: [['تحسين خدمة قائمة', 'أريد تحسين خدمة قائمة: '], ['أتمتة إجراء', 'أريد أتمتة إجراء يتم حالياً '], ['تعزيز تجربة المتعاملين', 'لدي فكرة لتحسين تجربة المتعاملين: '], ['استكشاف فكرة بالذكاء الاصطناعي', 'أود استكشاف كيف يمكن للذكاء الاصطناعي أن يساعد في '], ['حل تحدٍّ تشغيلي', 'هناك تحدٍّ تشغيلي أود حله: '], ['لدي فكرة جديدة كلياً', 'لدي فكرة جديدة كلياً: ']],
      stages: ['اكتشف', 'تحقّق', 'صمّم', 'قيّم', 'اقترح'],
      placeholder: 'صف فكرتك، أو أجب على فكرة…', send: 'إرسال', you: 'أنت', fekra: 'فكرة', aiLabel: 'إرشاد بالذكاء الاصطناعي', edit: 'تعديل',
      privacy: 'ترسل فكرة محادثتك إلى خدمة ذكاء اصطناعي وتبحث في المصادر العامة على الإنترنت. يبقى عملك على هذه الشاشة حتى تحفظه؛ وتُحفظ المقترحات على خادم إقامة دبي برمز وصول خاص. يُرجى عدم مشاركة بيانات شخصية أو معلومات مصنّفة.',
      notConfigured: 'خدمة الذكاء الاصطناعي في فكرة غير متصلة في هذا التثبيت، لذا لا يمكنها الرد بعد. يُرجى طلب المساعدة من فريق الجناح. لا يُرسل أي شيء تكتبه إلى أي مكان.',
      offline: 'تحتاج فكرة إلى خادم الكشك. افتح التطبيق من عنوانه على الويب وليس كملف محلي.',
      thinking: 'فكرة تفكّر…', updating: 'تحديث مقترحك…', researching: 'البحث عن تطبيقات مشابهة…', researchSteps: ['البحث في مصادر إقامة دبي والجهات الحكومية الإماراتية…', 'مراجعة الحكومات والقطاعات الأخرى…', 'كتابة التقييم…'],
      updated: n => `تم تحديث المقترح · ${n} أقسام`, updateFailed: 'تعذّر تحديث المقترح الآن.', researchFailed: 'تعذّر إكمال البحث الآن.', retry: 'حاول مرة أخرى', saving: 'جارٍ الحفظ…', submitting: 'جارٍ الإرسال…', writingPdf: 'جارٍ إعداد ملف PDF…',
      errors: { not_configured: 'خدمة الذكاء الاصطناعي في فكرة غير متصلة بعد.', ai_disabled: 'خدمة الذكاء الاصطناعي في فكرة متوقفة.', hourly_budget: 'بلغت فكرة حد الاستخدام لهذه الساعة. يُرجى المحاولة لاحقاً.', circuit_open: 'خدمة الذكاء الاصطناعي غير متاحة مؤقتاً. حاول بعد دقيقة.', timeout: 'استغرق الأمر وقتاً طويلاً. يُرجى المحاولة مرة أخرى.', refusal: 'لا يمكن لفكرة المساعدة في هذا الطلب.', rate: 'طلبات كثيرة في وقت واحد. انتظر لحظة.', offline: 'تحتاج فكرة إلى خادم الكشك.', forbidden: 'رمز الوصول لا يطابق هذا المقترح.', not_found: 'لا يوجد مقترح محفوظ بهذا المرجع.', version_conflict: 'حُفظ هذا المقترح من شاشة أخرى. أعد فتحه للمتابعة.', no_store: 'الحفظ غير متاح في هذا التثبيت.', default: 'تعذّر على فكرة الرد الآن. عملك محفوظ؛ يُرجى المحاولة مرة أخرى.' },
      panel: 'المقترح المباشر', hidePanel: 'إخفاء', showPanel: 'المقترح المباشر', titlePh: 'سيظهر عنوان مقترحك هنا عندما تطوّره فكرة.', emptyPanel: 'صف فكرتك في المحادثة، وستملأ فكرة كل الأقسام نيابةً عنك.',
      parts: (n, total) => `${n} من ${total} أقسام مكتملة`,
      statusName: { draft: 'مسودة', under_review: 'قيد المراجعة', finalized: 'معتمد' },
      sections: { overview: 'نظرة عامة على الفكرة', problem: 'بيان المشكلة', assessment: 'تقييم التطبيقات القائمة', customerBenefits: 'الفوائد للمتعاملين', orgBenefits: 'الفوائد لإقامة دبي', technology: 'التقنيات الموصى بها', roadmap: 'نهج التنفيذ', assumptions: 'الافتراضات والتحقق', references: 'مراجع البحث' },
      fields: { executiveSummary: 'الملخص التنفيذي', solution: 'الحل المقترح', scope: 'النطاق والفئات المستهدفة', current: 'الوضع الحالي', issue: 'المشكلة', whyItMatters: 'لماذا تهم', affected: 'المتأثرون', ifUnresolved: 'إذا بقيت دون حل', reasoning: 'المبرر', kpi: 'مؤشر الأداء المقترح', measurement: 'طريقة القياس', role: 'دورها في الحل', why: 'سبب الحاجة إليها', dependencies: 'اعتماديات البيانات والأنظمة', considerations: 'اعتبارات التنفيذ', architecture: 'بنية توضيحية', activities: 'ما يجب عمله', validation: 'ما يجب التحقق منه قبل الانتقال', depsList: 'الاعتماديات', risks: 'المخاطر وإجراءات الحد منها', mitigation: 'إجراء الحد', openQuestions: 'أسئلة مفتوحة', confirmed: 'أكّدتها أنت', title: 'العنوان', benefit: 'الفائدة', name: 'التقنية أو القدرة', phase: 'المرحلة', risk: 'الخطر', text: 'الافتراض', area: 'المجال' },
      phases: { discovery: 'الاستكشاف ودراسة الجدوى', poc: 'إثبات المفهوم', pilot: 'التجربة', evaluation: 'التقييم', rollout: 'الإطلاق الفعلي' },
      areas: { problem: 'المشكلة', solution: 'الحل', scope: 'النطاق', benefits: 'الفوائد', technology: 'التقنية', data: 'البيانات', roadmap: 'خطة التنفيذ' },
      basis: { user: 'منك', inferred: 'افتراض', research: 'بحث موثّق', recommendation: 'توصية فكرة', mixed: 'منك ومستنتج' }, needsValidation: 'يحتاج تحقق',
      tags: { updated: 'محدّث', approved: 'معتمد', suggestion: 'تعديل مقترح', empty: 'لم يبدأ' },
      status: { already_implemented: 'مطبّقة مسبقاً', partially_implemented: 'مطبّقة جزئياً', not_found: 'لم يُعثر على تطبيق مماثل', inconclusive: 'تعذّر التحقق' },
      provisional: 'مبدئي: لم يُجرَ البحث بعد', provisionalNote: 'تبحث فكرة تلقائياً عن تطبيقات مشابهة عندما تتضح الفكرة. حتى ذلك الحين لا يُدّعى شيء بشأن جِدّة الفكرة.',
      scopeNames: { gdrfa: 'داخل إقامة دبي', uae_government: 'الحكومة الإماراتية', international_government: 'حكومات أخرى', other_industry: 'قطاعات أخرى' },
      withinGdrfa: 'داخل إقامة دبي (مصادر عامة)', otherOrgs: 'جهات أخرى', noneInGdrfa: 'لم تظهر في المصادر العامة مبادرة مماثلة لإقامة دبي.',
      similarities: 'أوجه التشابه', differences: 'أوجه الاختلاف', closeness: { high: 'مشابه جداً', partial: 'مشابه جزئياً', low: 'ذو صلة بعيدة' },
      exists: 'ما هو موجود بالفعل', different: 'ما يمكن أن يميّز الفكرة', opportunities: 'الفرص', limitations: 'حدود البحث',
      internalNote: 'لم يُبحث في الأنظمة والوثائق الداخلية لإقامة دبي، بل في المصادر العامة فقط. ما زال التحقق الداخلي مطلوباً.', notProof: 'عدم العثور على مثيل لا يثبت أن الفكرة لم تُطبّق في أي مكان.',
      checkMeta: (n, d) => `بحث مباشر في المصادر العامة · ${n} مصادر · ${d}`, checkMetaNone: d => `لم يكن البحث على الإنترنت ممكناً · ${d}`, aiWritten: 'كتب الذكاء الاصطناعي هذا التقييم استناداً إلى المصادر المذكورة. راجع المصادر قبل الاعتماد عليه.',
      researchNow: 'ابحث الآن', researchAgain: 'طلب بحث إضافي', researchFocusPh: 'اختياري: ما الذي تريد أن تبحث فيه فكرة؟ (مثلاً: كيف تتعامل سنغافورة مع ذلك)', researchGo: 'ابحث',
      checkFollow: ['ماذا تعني هذه النتائج لفكرتي؟', 'كيف يمكن أن تتميز فكرتي؟'],
      offerReview: 'أعددت مقترحاً أولياً استناداً إلى نقاشنا والبحث. هل تود مراجعته؟', reviewNow: 'مراجعة المقترح', keepRefining: 'مواصلة التطوير',
      review: 'مراجعة المقترح كاملاً', pdf: 'إنشاء ملف PDF للمقترح', save: 'حفظ', saved: 'محفوظ', unsaved: 'غير محفوظ',
      lang: 'English', langTitle: 'التبديل إلى الإنجليزية', newIdea: 'فكرة جديدة', open: 'فتح', translating: 'إعادة كتابة المقترح بالعربية…',
      newIdeaTitle: 'بدء فكرة جديدة؟', newIdeaText: 'سيتم مسح المحادثة والمقترح الحاليين من هذه الشاشة. احفظهما أولاً إذا أردت الاحتفاظ بهما.', cancel: 'إلغاء', clear: 'مسح',
      tabs: ['المحادثة', 'المقترح'],
      doc: { kicker: 'مقترح ابتكاري', back: 'العودة إلى المحادثة', approve: 'اعتماد', approved: 'معتمد', unapprove: 'إلغاء القفل', edit: 'تعديل', improve: 'تحسين بالذكاء الاصطناعي', saveEdit: 'حفظ التعديلات', cancel: 'إلغاء', improvePh: 'كيف تريد أن تحسّن فكرة هذا القسم؟', improveGo: 'تحسين', quick: ['أكثر إيجازاً', 'أكثر تحديداً لإقامة دبي', 'تفاصيل أكثر', 'لغة أبسط'], add: 'إضافة', remove: 'حذف',
        approveAll: 'اعتماد المقترح', reopen: 'إعادة الفتح للتعديل', regenerate: 'إعادة الإنشاء', submit: 'إرسال للمراجعة الإدارية', reference: 'المرجع', date: 'التاريخ', status: 'الحالة', preparedWith: 'أُعدّ بواسطة', unsavedRef: 'لم يُحفظ بعد',
        reviewHint: 'صاغت فكرة كل الأقسام من محادثتك والبحث. راجع الافتراضات المميزة، وصحّح ما هو غير دقيق، واعتمد الأقسام التي توافق عليها.',
        pendingTitle: 'تقترح فكرة تحديثاً لهذا القسم المعتمد', acceptPending: 'استخدام التحديث', keepMine: 'الإبقاء على النسخة المعتمدة',
        confirm: 'تأكيد', correct: 'تصحيح', correctPrefix: a => `تصحيح على «${a}»: `, finalizedNote: 'معتمد: اعتمدته أنت. أعد فتحه لإجراء تغييرات.', regenerateTitle: 'إعادة إنشاء المقترح؟', regenerateText: 'تعيد فكرة بناء كل الأقسام غير المعتمدة من المحادثة كاملة والبحث. تبقى الأقسام المعتمدة كما هي.', go: 'إعادة الإنشاء' },
      pdfLabels: { kicker: 'مقترح ابتكاري · فكرة', reference: 'المرجع', unsaved: 'مسودة غير محفوظة', footer: 'أُعدّ بمساعدة فكرة، مستشار الابتكار في إقامة دبي · لعرضه على الإدارة · الافتراضات تتطلب تحققاً', page: (i, n) => `صفحة ${i} من ${n}`, untitled: 'مقترح بلا عنوان', language: 'اللغة', langName: 'العربية', assumptionsIntro: 'استنتجت فكرة هذه النقاط، وتحتاج إلى تأكيد قبل اتخاذ القرار:', unverified: 'البنود المعلّمة «يحتاج تحقق» نتائج متوقعة ما زالت تحتاج إلى أدلة.', noSources: 'لا توجد مراجع بحث: تقييم التطبيقات القائمة مبدئي.', none: 'لا يوجد.', org: 'الجهة', initiative: 'المبادرة', simDiff: 'التشابه / الاختلاف', source: 'المصدر', tech: 'التقنية', phase: 'المرحلة', basisCol: 'الأساس', desc: 'الوصف' },
      saveTitle: 'تم حفظ المقترح', saveIntro: 'احتفظ بالمرجع ورمز الوصول لإعادة فتح المقترح لاحقاً من أي جهاز:', accessCode: 'رمز الوصول', scanToResume: 'امسح للمتابعة على هاتفك', notPersistent: 'ملاحظة: لم تُضبط بعد مساحة تخزين دائمة في هذا التثبيت، لذا قد تُفقد المقترحات المحفوظة عند تحديث الخدمة. يحتاج المسؤول إلى ضبط DATA_DIR على وحدة تخزين دائمة.', savedVersion: v => `محفوظ · الإصدار ${v}`,
      openTitle: 'فتح مقترح محفوظ', openIntro: 'أدخل المرجع ورمز الوصول اللذين حصلت عليهما عند حفظ المقترح.', refPh: 'FK-261123-ABCD', codePh: 'XXXX-XXXX-XXXX', openGo: 'فتح', opened: 'تم فتح المقترح.',
      pendingSubmitTitle: 'الإرسال غير متصل بعد', pendingSubmitText: 'لم يتم إرسال مقترحك. لم يُربط نظام المراجعة الإدارية بفكرة بعد. احفظه أو أنشئ ملف PDF وشاركه عبر القناة المعتادة. عند ربط نظام المراجعة، سيرسل هذا الزر المقترح ويعرض رقمه المرجعي.',
      sentTitle: 'تم إرسال المقترح', sentText: ref => ref ? `تم إرسال مقترحك للمراجعة الإدارية. الرقم المرجعي: ${ref}` : 'تم إرسال مقترحك للمراجعة الإدارية.', ok: 'حسناً',
      pdfDone: 'تم تنزيل ملف PDF.', pdfFailed: 'تعذّر إنشاء ملف PDF في هذا المتصفح.', needIdea: 'صف فكرتك أولاً.'
    }
  };

  const SECTION_ORDER = ['overview', 'problem', 'assessment', 'customerBenefits', 'orgBenefits', 'technology', 'roadmap', 'assumptions'];
  const LOCKABLE = ['overview', 'problem', 'customerBenefits', 'orgBenefits', 'technology', 'roadmap', 'assumptions'];
  const SECTION_FIELDS = { overview: ['title', 'executiveSummary', 'solution', 'scope'], problem: ['problem'], customerBenefits: ['customerBenefits'], orgBenefits: ['orgBenefits'], technology: ['technologies', 'architecture'], roadmap: ['roadmap', 'dependencies', 'risks'], assumptions: ['assumptions', 'openQuestions'] };
  const PHASES = ['discovery', 'poc', 'pilot', 'evaluation', 'rollout'];
  const AREAS = ['problem', 'solution', 'scope', 'benefits', 'technology', 'data', 'roadmap'];
  const STATUS_COLORS = { already_implemented: ['#FFF1DC', '#8A5300'], partially_implemented: ['#E7F1FC', '#1F5FA8'], not_found: ['#E7F6EF', '#17694A'], inconclusive: ['#EEF0F4', '#4A5568'] };

  const emptyProposal = () => ({ title: '', executiveSummary: '', solution: '', scope: '', problem: { current: '', issue: '', whyItMatters: '', affected: '', ifUnresolved: '', basis: 'inferred' }, customerBenefits: [], orgBenefits: [], technologies: [], architecture: '', roadmap: [], dependencies: [], risks: [], assumptions: [], openQuestions: [] });
  const fresh = (lang = 'en') => ({
    lang, messages: [], proposal: emptyProposal(), check: null, locked: [], confirmed: [], pending: {}, status: 'draft', changes: {}, lastChanged: 0,
    suggestions: [], readyForResearch: false, readyForReview: false, reviewOffered: false,
    busy: null, error: null, updating: null, updateQueued: null, updateError: null, researching: false, researchStep: 0, researchError: null,
    mode: 'chat', tab: 'chat', panel: true, open: { overview: true, problem: true, assessment: true }, edit: null, improve: null, researchForm: false,
    saved: null, saving: false, savedAt: null, epoch: 0
  });
  let fk = fresh();
  let built = false, researchTimer = 0, autosaveTimer = 0;
  const t = () => T[fk.lang];
  const available = () => CONFIG.served && CONFIG.fekra && CONFIG.fekra.enabled;
  const storage = () => (CONFIG.fekra && CONFIG.fekra.storage) || { available: false, persistent: false };

  /* ---------- small helpers ---------- */
  const dateStr = iso => { try { return new Date(iso || Date.now()).toLocaleDateString(fk.lang === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const safeUrl = u => /^https?:\/\//i.test(String(u || '')) ? String(u) : null;
  const sources = () => (fk.check && fk.check.sources) || [];
  function inlineHTML(text, srcs) {
    const srcMap = new Map((srcs || sources()).map(s => [s.id, s]));
    return esc(text).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[(S\d{1,2})\]/g, (m, id) => { const src = srcMap.get(id); const u = src && safeUrl(src.url); return u ? `<a class="fk-cite" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(src.title)}">${id.slice(1)}</a>` : ''; });
  }
  function rich(text, srcs) {
    let html = '', list = [];
    const flush = () => { if (list.length) { html += `<ul>${list.map(li => `<li>${inlineHTML(li, srcs)}</li>`).join('')}</ul>`; list = []; } };
    String(text || '').split(/\n/).forEach(line => { const l = line.trim(); if (/^[-•*]\s+/.test(l)) list.push(l.replace(/^[-•*]\s+/, '')); else { flush(); if (l) html += `<p>${inlineHTML(l, srcs)}</p>`; } });
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
  async function http(method, url, body, timeoutMs, headers = {}) {
    if (!CONFIG.served) throw Object.assign(new Error('offline'), { reason: 'offline' });
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'HTTP ' + res.status), { reason: data.reason, status: res.status });
      return data;
    } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { reason: 'timeout' }); throw e; }
    finally { clearTimeout(timer); }
  }
  const api = (op, body, ms) => http('POST', 'api/fekra/' + op, body, ms);
  const convo = () => fk.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, text: m.text }));
  const P = () => fk.proposal;
  const filled = {
    overview: p => !!(p.title && (p.executiveSummary || p.solution)), problem: p => !!(p.problem.issue || p.problem.current), assessment: () => !!fk.check,
    customerBenefits: p => p.customerBenefits.length > 0, orgBenefits: p => p.orgBenefits.length > 0, technology: p => p.technologies.length > 0, roadmap: p => p.roadmap.length > 0, assumptions: p => p.assumptions.length > 0 || p.openQuestions.length > 0
  };
  const hasIdea = () => !!(P().title || P().solution || P().problem.issue || fk.messages.some(m => m.role === 'user'));
  const stageDone = () => ({ discover: !!(P().problem.issue && P().solution), validate: !!fk.check, design: P().technologies.length > 0, evaluate: P().customerBenefits.length > 0 && P().orgBenefits.length > 0, propose: fk.status !== 'draft' });
  const snapshot = () => JSON.parse(JSON.stringify({ proposal: fk.proposal, check: fk.check, locked: fk.locked, confirmed: fk.confirmed, pending: fk.pending, status: fk.status, readyForResearch: fk.readyForResearch, readyForReview: fk.readyForReview, reviewOffered: fk.reviewOffered }));
  const isLocked = k => fk.locked.includes(k);
  function markDirty() { fk.dirty = true; scheduleAutosave(); }

  /* ---------- rendering: shell ---------- */
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
          <div class="fk-activity" id="fkActivity" aria-live="polite"></div>
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
      <div class="fk-docwrap" id="fkDoc" hidden></div>`;
    $('#fkCompose').addEventListener('submit', e => { e.preventDefault(); send($('#fkInput').value); });
    const input = $('#fkInput');
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
    input.addEventListener('input', () => { grow(); updateSend(); });
    $('#fkPanel').addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details[data-sec]'); if (d) fk.open[d.dataset.sec] = d.open; }, true);
    $('#fkDoc').addEventListener('input', e => { const el = e.target.closest('[data-path]'); if (el && fk.edit) setPath(fk.edit.draft, el.dataset.path, el.value); });
    $('#fkDoc').addEventListener('change', e => { const el = e.target.closest('select[data-path]'); if (el && fk.edit) setPath(fk.edit.draft, el.dataset.path, el.value); });
    built = true;
  }
  function grow() { const i = $('#fkInput'); if (!i) return; i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 180) + 'px'; }
  function updateSend() { const i = $('#fkInput'); if (i) $('#fkSend').disabled = !!fk.busy || !available() || !i.value.trim(); }

  function render() {
    if (!built) build();
    const L = t(), root = $('#fekraRoot');
    root.setAttribute('dir', L.dir); root.setAttribute('lang', fk.lang);
    root.classList.toggle('fk-ar', fk.lang === 'ar');
    root.classList.toggle('fk-nopanel', !fk.panel);
    root.dataset.tab = fk.tab; root.dataset.mode = fk.mode;
    $('#fkBrand').textContent = fk.lang === 'ar' ? 'Fekra' : L.brand; $('#fkTag').textContent = L.tagline;
    $('#fkLang').textContent = L.lang; $('#fkLang').title = L.langTitle; $('#fkLang').setAttribute('lang', fk.lang === 'ar' ? 'en' : 'ar');
    $('#fkOpen span').textContent = L.open; $('#fkSave span').textContent = fk.saving ? L.saving : L.save; $('#fkNew span').textContent = L.newIdea;
    $('#fkSave').disabled = !hasIdea() || fk.saving || !storage().available || !CONFIG.served; $('#fkOpen').disabled = !storage().available || !CONFIG.served;
    $('#fkInput').placeholder = L.placeholder; $('#fkSend .sr-only').textContent = L.send; $('#fkPrivacy span').textContent = L.privacy;
    $('#fkInput').disabled = !available();
    const done = stageDone(), stages = ['discover', 'validate', 'design', 'evaluate', 'propose'], cur = Math.max(0, stages.findIndex(s => !done[s]));
    $('#fkSteps').innerHTML = stages.map((s, i) => `<li class="${done[s] ? 'done' : ''} ${i === cur && !done[s] ? 'current' : ''}"${i === cur ? ' aria-current="step"' : ''}><span class="fk-dot">${done[s] ? ic('check') : i + 1}</span><span class="fk-step-l">${L.stages[i]}</span></li>`).join('<li class="fk-link" aria-hidden="true"></li>');
    $('#fkTabs').innerHTML = L.tabs.map((x, i) => { const id = i ? 'proposal' : 'chat'; return `<button role="tab" aria-selected="${fk.tab === id}" class="fk-tab${fk.tab === id ? ' active' : ''}" data-action="fk-tab" data-id="${id}">${esc(x)}</button>`; }).join('');
    renderLog(); renderActivity(); renderSuggest(); renderPanel(); renderDoc(); updateSend();
  }

  /* ---------- conversation ---------- */
  function msgHTML(m, i) {
    const L = t();
    if (m.role === 'user') return `<div class="fk-msg user"><div class="fk-bubble">${esc(m.text).replace(/\n/g, '<br>')}</div><div class="fk-meta">${esc(L.you)}${fk.busy ? '' : ` · <button class="fk-link-btn" data-action="fk-edit-msg" data-id="${i}">${esc(L.edit)}</button>`}</div></div>`;
    if (m.role === 'assistant') return `<div class="fk-msg bot"><span class="fk-ava" aria-hidden="true">${ic('bulb')}</span><div><div class="fk-bubble">${rich(m.text)}</div><div class="fk-meta">${esc(L.fekra)} · ${esc(L.aiLabel)}</div></div></div>`;
    if (m.role === 'check') return `<div class="fk-msg bot wide"><span class="fk-ava" aria-hidden="true">${ic('search')}</span>${checkHTML(m.check, false)}</div>`;
    if (m.role === 'notice' && m.kind === 'offer-review') return `<div class="fk-msg bot"><span class="fk-ava" aria-hidden="true">${ic('file')}</span><div><div class="fk-bubble fk-offer"><p>${esc(L.offerReview)}</p><div class="fk-offer-actions"><button class="btn btn-gold btn-sm" data-action="fk-review">${ic('file')} ${esc(L.reviewNow)}</button><button class="btn btn-ghost btn-sm" data-action="fk-keep-refining">${esc(L.keepRefining)}</button></div></div><div class="fk-meta">${esc(L.fekra)}</div></div></div>`;
    return '';
  }
  function welcomeHTML() {
    const L = t();
    return `<div class="fk-welcome">
      <p class="fk-kicker"><span lang="ar">فكرة</span><i></i>Fekra<b aria-hidden="true"></b></p>
      <h2>${esc(L.headline)}</h2><p class="fk-sub">${esc(L.sub)}</p>
      <div class="fk-msg bot"><span class="fk-ava" aria-hidden="true">${ic('bulb')}</span><div><div class="fk-bubble"><p>${esc(L.greeting)}</p><p class="fk-how">${esc(L.howItWorks)}</p></div><div class="fk-meta">${esc(L.fekra)}</div></div></div>
      ${available() ? `<p class="fk-hint">${esc(L.startHint)}</p><div class="fk-starts">${L.starts.map(([title], i) => `<button class="fk-start" data-action="fk-start" data-id="${i}"><span class="fk-start-ic">${ic(['reset', 'automation', 'cx', 'spark', 'briefcase', 'bulb'][i])}</span><span>${esc(title)}</span>${ic('arrow')}</button>`).join('')}</div>`
        : `<div class="fk-notice">${ic('alert')}<p>${esc(CONFIG.served ? L.notConfigured : L.offline)}</p></div>`}
    </div>`;
  }
  function renderLog() {
    const log = $('#fkLog'), L = t();
    let html = fk.messages.length ? '' : welcomeHTML();
    html += fk.messages.map(msgHTML).join('');
    if (fk.busy === 'chat') html += `<div class="fk-msg bot busy"><span class="fk-ava" aria-hidden="true">${ic('bulb')}</span><div class="fk-bubble"><span class="fk-dots"><i></i><i></i><i></i></span><span class="fk-busy-t">${esc(L.thinking)}</span></div></div>`;
    if (fk.error) html += `<div class="fk-msg bot error"><span class="fk-ava" aria-hidden="true">${ic('alert')}</span><div class="fk-bubble"><p>${esc(fk.error.message)}</p>${fk.error.retry ? `<button class="btn btn-ghost btn-sm" data-action="fk-retry">${ic('reset')} ${esc(L.retry)}</button>` : ''}</div></div>`;
    log.innerHTML = html;
    log.scrollTop = fk.messages.length || fk.busy || fk.error ? log.scrollHeight : 0;
  }
  /* background work, shown under the conversation (and in the panel) so the employee always knows what Fekra is doing */
  function activityHTML(compact) {
    const L = t(), items = [];
    if (fk.updating) items.push(`<span class="fk-act on">${spinner()}${esc(fk.updating === 'translate' ? L.translating : L.updating)}</span>`);
    if (fk.researching) items.push(`<span class="fk-act on">${spinner()}${esc(L.researchSteps[Math.min(fk.researchStep, L.researchSteps.length - 1)])}</span>`);
    if (!fk.updating && fk.updateError) items.push(`<span class="fk-act err">${ic('alert')}${esc(L.updateFailed)} <button class="fk-link-btn" data-action="fk-retry-update">${esc(L.retry)}</button></span>`);
    if (!fk.researching && fk.researchError) items.push(`<span class="fk-act err">${ic('alert')}${esc(L.researchFailed)} <button class="fk-link-btn" data-action="fk-research">${esc(L.retry)}</button></span>`);
    if (!compact && !items.length && fk.lastChanged && Date.now() - fk.lastChanged < 15000) items.push(`<span class="fk-act ok">${ic('check')}${esc(L.updated(Object.values(fk.changes).filter(x => x === fk.lastChanged).length || 1))}</span>`);
    return items.join('');
  }
  const spinner = () => '<i class="fk-spin" aria-hidden="true"></i>';
  function renderActivity() { const a = $('#fkActivity'); if (a) a.innerHTML = activityHTML(false); }
  function renderSuggest() {
    const box = $('#fkSuggest');
    const items = fk.busy || !available() ? [] : fk.suggestions;
    box.innerHTML = items.map(s => `<button class="fk-chip" data-action="fk-suggest" data-q="${esc(s)}">${esc(s)}</button>`).join('');
  }

  /* ---------- the existing-implementation assessment (chat card, panel and document) ---------- */
  function checkHTML(c, inDoc) {
    const L = t(), srcs = c.sources || [];
    const cite = ids => (ids || []).map(id => { const s = srcs.find(x => x.id === id), u = s && safeUrl(s.url); return u ? `<a class="fk-cite" href="${esc(u)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title)}">${esc(id.slice(1))}</a>` : ''; }).join('');
    const inl = x => inlineHTML(x, srcs);
    const list = (title, items) => items && items.length ? `<div><h5>${esc(title)}</h5><ul>${items.map(x => `<li>${inl(x)}</li>`).join('')}</ul></div>` : '';
    const extraCites = x => cite((x.sources || []).filter(id => ![x.description, x.similarities, x.differences].some(f => String(f || '').includes(`[${id}]`)))); // no source number twice
    const item = x => `<li><b>${esc(x.initiative || x.entity)}</b>${x.entity && x.initiative ? ` <span class="fk-where">${esc(x.entity)}</span>` : ''} <span class="fk-scope s-${esc(x.scope)}">${esc(L.scopeNames[x.scope] || '')}</span>${L.closeness[x.closeness] ? ` <span class="fk-close c-${esc(x.closeness)}">${esc(L.closeness[x.closeness])}</span>` : ''}<br>${inl(x.description)} ${extraCites(x)}
      ${x.similarities ? `<div class="fk-sd"><span>${esc(L.similarities)}:</span> ${inl(x.similarities)}</div>` : ''}${x.differences ? `<div class="fk-sd"><span>${esc(L.differences)}:</span> ${inl(x.differences)}</div>` : ''}</li>`;
    const g = (c.similar || []).filter(x => x.scope === 'gdrfa'), o = (c.similar || []).filter(x => x.scope !== 'gdrfa');
    return `<article class="fk-check st-${esc(c.status)}${inDoc ? ' in-doc' : ''}">
      <div class="fk-check-head"><span class="fk-badge">${esc(L.status[c.status] || c.status)}</span><span class="fk-check-meta">${esc(c.searched ? L.checkMeta(srcs.length, dateStr(c.checkedAt)) : L.checkMetaNone(dateStr(c.checkedAt)))}</span></div>
      ${c.summary ? `<p class="fk-check-sum">${inl(c.summary)}</p>` : ''}
      ${c.searched ? `<h5>${esc(L.withinGdrfa)}</h5>${g.length ? `<ul class="fk-similar">${g.map(item).join('')}</ul>` : `<p class="fk-muted">${esc(L.noneInGdrfa)}</p>`}` : ''}
      ${o.length ? `<h5>${esc(L.otherOrgs)}</h5><ul class="fk-similar">${o.map(item).join('')}</ul>` : ''}
      <div class="fk-cols">${list(L.exists, c.alreadyExists)}${list(L.different, c.different)}</div>
      ${list(L.opportunities, c.opportunities)}
      <h5>${esc(L.limitations)}</h5><ul>${(c.limitations || []).map(x => `<li>${inl(x)}</li>`).join('')}<li>${esc(L.internalNote)}</li><li>${esc(L.notProof)}</li></ul>
      ${!inDoc && srcs.length ? `<h5>${esc(L.sections.references)}</h5><ol class="fk-sources">${srcs.map(s => { const u = safeUrl(s.url); return u ? `<li><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s.title || host(u))}</a> <small>${esc(host(u))}</small></li>` : ''; }).join('')}</ol>` : ''}
      <p class="fk-ai-note">${ic('info')}${esc(L.aiWritten)}</p>
    </article>`;
  }

  /* ---------- section content (shared by the live panel and the review document) ---------- */
  const tag = (label, kind) => `<span class="fk-tagb k-${kind}">${esc(label)}</span>`;
  function basisTags(b) { const L = t(); return `${b.basis ? tag(L.basis[b.basis] || b.basis, b.basis) : ''}${b.needsValidation ? tag(L.needsValidation, 'validate') : ''}`; }
  function sectionBody(k, full) {
    const L = t(), F = L.fields, p = P();
    const fld = (label, v) => v ? `<div class="fk-f"><h6>${esc(label)}</h6>${rich(v)}</div>` : '';
    switch (k) {
      case 'overview': return `${p.executiveSummary ? `<div class="fk-f fk-summary"><h6>${esc(F.executiveSummary)}</h6>${rich(p.executiveSummary)}</div>` : ''}${fld(F.solution, p.solution)}${fld(F.scope, p.scope)}`;
      case 'problem': { const pr = p.problem; return `${pr.issue || pr.current ? `<div class="fk-prov">${tag(L.basis[pr.basis] || '', pr.basis === 'user' ? 'user' : 'inferred')}</div>` : ''}${['current', 'issue', 'whyItMatters', 'affected', 'ifUnresolved'].map(f => fld(F[f], pr[f])).join('')}`; }
      case 'assessment':
        if (!fk.check) return `<div class="fk-provisional"><span class="fk-badge sm">${esc(L.provisional)}</span><p class="fk-muted">${esc(L.provisionalNote)}</p>${fk.researching ? '' : `<button class="btn btn-ghost btn-sm" data-action="fk-research" ${!available() || !hasIdea() ? 'disabled' : ''}>${ic('search')} ${esc(L.researchNow)}</button>`}</div>`;
        return full ? checkHTML(fk.check, true) : `<p><span class="fk-badge sm st-${esc(fk.check.status)}">${esc(L.status[fk.check.status])}</span></p>${rich(fk.check.summary)}<p class="fk-muted small">${esc(L.internalNote)}</p>`;
      case 'customerBenefits': case 'orgBenefits': {
        const list = p[k]; if (!list.length) return '';
        return `<ul class="fk-items">${list.map(b => `<li><div class="fk-item-h"><b>${inlineHTML(b.benefit)}</b>${basisTags(b)}</div>${full ? `${b.reasoning ? `<p>${inlineHTML(b.reasoning)}</p>` : ''}<dl class="fk-dl">${b.kpi ? `<dt>${esc(F.kpi)}</dt><dd>${inlineHTML(b.kpi)}</dd>` : ''}${b.measurement ? `<dt>${esc(F.measurement)}</dt><dd>${inlineHTML(b.measurement)}</dd>` : ''}</dl>` : (b.kpi ? `<p class="fk-muted small">${esc(F.kpi)}: ${inlineHTML(b.kpi)}</p>` : '')}</li>`).join('')}</ul>`;
      }
      case 'technology': {
        if (!p.technologies.length && !p.architecture) return '';
        return `<ul class="fk-items">${p.technologies.map(x => `<li><div class="fk-item-h"><b>${esc(x.name)}</b>${tag(L.basis.recommendation, 'recommendation')}</div><p>${inlineHTML(x.role)}</p>${full ? `<dl class="fk-dl">${x.why ? `<dt>${esc(F.why)}</dt><dd>${inlineHTML(x.why)}</dd>` : ''}${x.dependencies ? `<dt>${esc(F.dependencies)}</dt><dd>${inlineHTML(x.dependencies)}</dd>` : ''}${x.considerations ? `<dt>${esc(F.considerations)}</dt><dd>${inlineHTML(x.considerations)}</dd>` : ''}</dl>` : ''}</li>`).join('')}</ul>${p.architecture ? `<div class="fk-f fk-arch"><h6>${esc(F.architecture)}</h6>${rich(p.architecture)}</div>` : ''}`;
      }
      case 'roadmap': {
        if (!p.roadmap.length) return '';
        return `<ol class="fk-phases">${p.roadmap.map(r => `<li><b>${esc(L.phases[r.phase] || r.phase)}</b><p>${inlineHTML(r.activities)}</p>${full && r.validation ? `<p class="fk-val"><span>${esc(F.validation)}:</span> ${inlineHTML(r.validation)}</p>` : ''}</li>`).join('')}</ol>
          ${full && p.dependencies.length ? `<div class="fk-f"><h6>${esc(F.depsList)}</h6><ul>${p.dependencies.map(d => `<li>${inlineHTML(d)}</li>`).join('')}</ul></div>` : ''}
          ${full && p.risks.length ? `<div class="fk-f"><h6>${esc(F.risks)}</h6><ul class="fk-risks">${p.risks.map(r => `<li><b>${inlineHTML(r.risk)}</b>${r.mitigation ? ` — ${inlineHTML(r.mitigation)}` : ''}</li>`).join('')}</ul></div>` : ''}`;
      }
      case 'assumptions': {
        const final = fk.status === 'finalized';
        return `${p.assumptions.length ? `<ul class="fk-assume">${p.assumptions.map((a, i) => `<li><span class="fk-area">${esc(L.areas[a.area] || a.area)}</span> ${inlineHTML(a.text)}${final ? '' : `<span class="fk-assume-act"><button class="fk-link-btn" data-action="fk-confirm" data-id="${i}">${ic('check')}${esc(L.doc.confirm)}</button><button class="fk-link-btn" data-action="fk-correct" data-id="${i}">${esc(L.doc.correct)}</button></span>`}</li>`).join('')}</ul>` : ''}
          ${fk.confirmed.length ? `<div class="fk-f"><h6>${esc(F.confirmed)}</h6><ul class="fk-confirmed">${fk.confirmed.map(c => `<li>${ic('check')}${esc(c)}</li>`).join('')}</ul></div>` : ''}
          ${p.openQuestions.length ? `<div class="fk-f"><h6>${esc(F.openQuestions)}</h6><ul>${p.openQuestions.map(q => `<li>${inlineHTML(q)}</li>`).join('')}</ul></div>` : ''}`;
      }
    }
    return '';
  }
  function sectionTags(k) {
    const L = t(), out = [];
    if (fk.pending[k]) out.push(tag(L.tags.suggestion, 'pending'));
    if (isLocked(k)) out.push(`<span class="fk-tagb k-locked">${ic('check')}${esc(L.tags.approved)}</span>`);
    else if (fk.changes[k] && fk.changes[k] === fk.lastChanged) out.push(tag(L.tags.updated, 'updated'));
    if (!filled[k](P())) out.push(tag(L.tags.empty, 'empty'));
    return out.join('');
  }

  /* ---------- live proposal panel ---------- */
  function renderPanel() {
    const L = t(), p = P(), panel = $('#fkPanel');
    if (!fk.panel) { panel.innerHTML = `<button class="fk-panel-tab" data-action="fk-panel">${ic('file')}<span>${esc(L.showPanel)}</span></button>`; return; }
    const n = SECTION_ORDER.filter(k => filled[k](p)).length, started = hasIdea();
    panel.innerHTML = `
      <div class="fk-panel-head"><h3>${ic('file')}${esc(L.panel)}</h3><span class="fk-status st-${fk.status}">${esc(L.statusName[fk.status])}</span><span class="fk-savedref">${fk.saved ? esc(fk.saved.ref) : ''}</span><button class="fk-link-btn" data-action="fk-panel">${esc(L.hidePanel)}</button></div>
      <div class="fk-panel-activity">${activityHTML(true)}</div>
      <div class="fk-panel-body">
        <h4 class="fk-title${p.title ? '' : ' ph'}">${esc(p.title || L.titlePh)}</h4>
        <div class="fk-parts"><div class="fk-parts-row">${SECTION_ORDER.map(k => `<span class="${filled[k](p) ? 'ok' : ''}" title="${esc(L.sections[k])}"></span>`).join('')}</div><small>${esc(L.parts(n, SECTION_ORDER.length))}</small></div>
        ${started ? SECTION_ORDER.map(k => `<details class="fk-sec-p${filled[k](p) ? '' : ' empty'}" data-sec="${k}"${fk.open[k] ? ' open' : ''}><summary><span class="fk-sec-name">${esc(L.sections[k])}</span><span class="fk-sec-tags">${sectionTags(k)}</span></summary><div class="fk-sec-c">${sectionBody(k, false) || `<p class="fk-muted small">${esc(L.emptyPanel)}</p>`}</div></details>`).join('') : `<p class="fk-muted">${esc(L.emptyPanel)}</p>`}
      </div>
      <div class="fk-panel-foot">
        <button class="btn btn-gold fk-generate${fk.readyForReview && fk.mode !== 'doc' && fk.status === 'draft' ? ' ready' : ''}" data-action="fk-review" ${started ? '' : 'disabled'}>${ic('file')} ${esc(L.review)}</button>
        <div class="fk-foot-row"><button class="btn btn-ghost btn-sm" data-action="fk-pdf" ${filled.overview(p) ? '' : 'disabled'}>${ic('download')} ${esc(L.pdf)}</button><button class="btn btn-ghost btn-sm" data-action="fk-save" ${!started || fk.saving || !storage().available ? 'disabled' : ''}>${ic('upload')} ${esc(fk.saving ? L.saving : fk.saved ? L.savedVersion(fk.saved.version) : L.save)}</button></div>
      </div>`;
  }

  /* ---------- review document ---------- */
  const EDITORS = {
    overview: [['title', 'text'], ['executiveSummary', 'area'], ['solution', 'area'], ['scope', 'area']],
    problem: [['problem.current', 'area'], ['problem.issue', 'area'], ['problem.whyItMatters', 'area'], ['problem.affected', 'area'], ['problem.ifUnresolved', 'area']],
    customerBenefits: { list: 'customerBenefits', item: [['benefit', 'text'], ['reasoning', 'area'], ['kpi', 'text'], ['measurement', 'area']], blank: () => ({ benefit: '', reasoning: '', kpi: '', measurement: '', basis: 'user', needsValidation: true }) },
    orgBenefits: { list: 'orgBenefits', item: [['benefit', 'text'], ['reasoning', 'area'], ['kpi', 'text'], ['measurement', 'area']], blank: () => ({ benefit: '', reasoning: '', kpi: '', measurement: '', basis: 'user', needsValidation: true }) },
    technology: { list: 'technologies', item: [['name', 'text'], ['role', 'area'], ['why', 'area'], ['dependencies', 'area'], ['considerations', 'area']], blank: () => ({ name: '', role: '', why: '', dependencies: '', considerations: '' }), after: [['architecture', 'area']] },
    roadmap: { list: 'roadmap', item: [['phase', 'phase'], ['activities', 'area'], ['validation', 'area']], blank: () => ({ phase: 'discovery', activities: '', validation: '' }), after: [['dependencies', 'lines']], list2: { list: 'risks', item: [['risk', 'text'], ['mitigation', 'area']], blank: () => ({ risk: '', mitigation: '' }) } },
    assumptions: { list: 'assumptions', item: [['text', 'area'], ['area', 'area-select']], blank: () => ({ text: '', area: 'scope' }), after: [['openQuestions', 'lines']] }
  };
  function getPath(o, path) { return path.split('.').reduce((v, k) => (v == null ? v : v[k]), o); }
  function setPath(o, path, val) { const ks = path.split('.'); let cur = o; ks.slice(0, -1).forEach(k => { cur = cur[k]; }); const last = ks[ks.length - 1]; cur[last] = Array.isArray(cur[last]) && typeof val === 'string' ? val.split('\n').map(s => s.trim()).filter(Boolean) : val; }
  function fieldInput(path, kind, value) {
    const L = t(), label = path === 'dependencies' ? L.fields.depsList : (L.fields[path.split('.').pop()] || path);
    if (kind === 'phase') return `<label class="fk-ed"><span>${esc(L.fields.phase)}</span><select data-path="${path}">${PHASES.map(ph => `<option value="${ph}"${value === ph ? ' selected' : ''}>${esc(L.phases[ph])}</option>`).join('')}</select></label>`;
    if (kind === 'area-select') return `<label class="fk-ed"><span>${esc(L.fields.area)}</span><select data-path="${path}">${AREAS.map(a => `<option value="${a}"${value === a ? ' selected' : ''}>${esc(L.areas[a])}</option>`).join('')}</select></label>`;
    if (kind === 'text') return `<label class="fk-ed"><span>${esc(label)}</span><input data-path="${path}" value="${esc(value || '')}" maxlength="400"></label>`;
    const v = kind === 'lines' ? (value || []).join('\n') : (value || '');
    return `<label class="fk-ed"><span>${esc(label)}</span><textarea data-path="${path}" rows="${kind === 'lines' ? 3 : 3}">${esc(v)}</textarea></label>`;
  }
  function editorHTML(k) {
    const L = t(), D = L.doc, d = fk.edit.draft, e = EDITORS[k];
    const listEd = spec => `<div class="fk-ed-list">${d[spec.list].map((it, i) => `<div class="fk-ed-item">${spec.item.map(([f, kind]) => fieldInput(`${spec.list}.${i}.${f}`, kind, it[f])).join('')}<button class="fk-link-btn fk-ed-remove" data-action="fk-ed-remove" data-list="${spec.list}" data-id="${i}">${esc(D.remove)}</button></div>`).join('')}<button class="btn btn-ghost btn-sm" data-action="fk-ed-add" data-list="${spec.list}">+ ${esc(D.add)}</button></div>`;
    let html = '';
    if (Array.isArray(e)) html = e.map(([path, kind]) => fieldInput(path, kind, getPath(d, path))).join('');
    else { html = listEd(e); if (e.after) html += e.after.map(([path, kind]) => fieldInput(path, kind, getPath(d, path))).join(''); if (e.list2) html += `<h6 class="fk-ed-h">${esc(L.fields.risks)}</h6>` + listEd(e.list2); }
    return `<div class="fk-editor">${html}<div class="fk-sec-actions"><button class="btn btn-gold btn-sm" data-action="fk-sec-save">${esc(D.saveEdit)}</button><button class="btn btn-ghost btn-sm" data-action="fk-sec-cancel">${esc(D.cancel)}</button></div></div>`;
  }
  function docSection(k, num) {
    const L = t(), D = L.doc, final = fk.status === 'finalized', lockable = LOCKABLE.includes(k);
    const editing = fk.edit && fk.edit.key === k, improving = fk.improve === k, busyHere = fk.updating === 'section' && fk.improve === k;
    const tools = final || editing ? '' : `<div class="fk-sec-tools">
      ${lockable ? (isLocked(k) ? `<button class="fk-link-btn is-on" data-action="fk-lock" data-id="${k}" title="${esc(D.unapprove)}">${ic('check')}${esc(D.approved)}</button>` : `<button class="fk-link-btn" data-action="fk-lock" data-id="${k}">${ic('check')}${esc(D.approve)}</button>`) : ''}
      ${lockable ? `<button class="fk-link-btn" data-action="fk-sec-edit" data-id="${k}" ${fk.updating ? 'disabled' : ''}>${esc(D.edit)}</button><button class="fk-link-btn" data-action="fk-sec-improve" data-id="${k}" ${fk.updating ? 'disabled' : ''}>${ic('spark')}${esc(D.improve)}</button>` : ''}
      ${k === 'assessment' ? `<button class="fk-link-btn" data-action="fk-research-form" ${fk.researching || !available() ? 'disabled' : ''}>${ic('search')}${esc(fk.check ? L.researchAgain : L.researchNow)}</button>` : ''}
    </div>`;
    const pend = fk.pending[k] ? `<div class="fk-pending"><p>${ic('info')}<b>${esc(D.pendingTitle)}</b></p><div class="fk-pending-body">${pendingPreview(k)}</div><div class="fk-sec-actions"><button class="btn btn-gold btn-sm" data-action="fk-pending-accept" data-id="${k}">${esc(D.acceptPending)}</button><button class="btn btn-ghost btn-sm" data-action="fk-pending-dismiss" data-id="${k}">${esc(D.keepMine)}</button></div></div>` : '';
    const improve = improving && !editing ? `<div class="fk-improve"><div class="fk-quick">${D.quick.map(q => `<button class="fk-chip" data-action="fk-sec-quick" data-q="${esc(q)}" ${fk.updating ? 'disabled' : ''}>${esc(q)}</button>`).join('')}</div><form class="fk-improve-form" data-action-form="fk-improve"><input id="fkImprove" maxlength="1000" placeholder="${esc(D.improvePh)}"><button type="submit" class="btn btn-gold btn-sm" ${fk.updating ? 'disabled' : ''}>${esc(busyHere ? L.updating : D.improveGo)}</button><button type="button" class="btn btn-ghost btn-sm" data-action="fk-sec-cancel">${esc(D.cancel)}</button></form></div>` : '';
    const research = k === 'assessment' && fk.researchForm ? `<form class="fk-improve fk-improve-form" data-action-form="fk-research"><input id="fkResearchFocus" maxlength="400" placeholder="${esc(L.researchFocusPh)}"><button type="submit" class="btn btn-gold btn-sm">${esc(L.researchGo)}</button><button type="button" class="btn btn-ghost btn-sm" data-action="fk-research-cancel">${esc(D.cancel)}</button></form>` : '';
    const body = editing ? editorHTML(k) : `<div class="fk-sec-body${busyHere ? ' busy' : ''}">${sectionBody(k, true) || '<p class="fk-muted">—</p>'}</div>`;
    return `<section class="fk-sec${isLocked(k) ? ' locked' : ''}" id="fk-sec-${k}"><div class="fk-sec-head"><h3><span>${num}</span>${esc(L.sections[k])}</h3>${tools}</div>${pend}${research}${body}${improve}</section>`;
  }
  function pendingPreview(k) {
    const saved = fk.proposal; fk.proposal = { ...fk.proposal, ...fk.pending[k] };
    const html = sectionBody(k, true); fk.proposal = saved; return html;
  }
  function renderDoc() {
    const box = $('#fkDoc'), L = t(), D = L.doc;
    box.hidden = fk.mode !== 'doc';
    if (box.hidden) { box.innerHTML = ''; return; }
    const final = fk.status === 'finalized', p = P(), srcs = sources();
    box.innerHTML = `
      <div class="fk-docbar">
        <button class="btn btn-ghost btn-sm" data-action="fk-chat">${ic('arrow')}<span>${esc(D.back)}</span></button>
        <span class="fk-status st-${fk.status}">${esc(L.statusName[fk.status])}</span>
        <span class="fk-doc-act">${activityHTML(true)}</span>
        <span class="spacer"></span>
        ${final ? `<button class="btn btn-ghost btn-sm" data-action="fk-reopen">${esc(D.reopen)}</button>` : `<button class="btn btn-ghost btn-sm" data-action="fk-regenerate" ${fk.updating || !available() ? 'disabled' : ''}>${ic('reset')} ${esc(D.regenerate)}</button><button class="btn btn-ghost btn-sm" data-action="fk-approve-all">${ic('check')} ${esc(D.approveAll)}</button>`}
        <button class="btn btn-ghost btn-sm" data-action="fk-save" ${fk.saving || !storage().available ? 'disabled' : ''}>${ic('upload')} ${esc(fk.saving ? L.saving : fk.saved ? L.savedVersion(fk.saved.version) : L.save)}</button>
        <button class="btn btn-ghost btn-sm" data-action="fk-pdf">${ic('download')} ${esc(L.pdf)}</button>
        <button class="btn btn-gold btn-sm" data-action="fk-submit" ${fk.busy ? 'disabled' : ''}>${ic('send')} ${esc(fk.busy === 'submit' ? L.submitting : D.submit)}</button>
      </div>
      <div class="fk-paper-scroll"><article class="fk-paper" id="fkPaper">
        <header class="fk-paper-head"><img src="assets/gdrfa-logo.png" alt="GDRFA"><div><p class="fk-paper-kicker">${esc(D.kicker)} · <span lang="ar">فكرة</span> Fekra</p><p class="fk-paper-meta">${esc(D.reference)}: ${esc(fk.saved ? fk.saved.ref : D.unsavedRef)} · ${esc(D.date)}: ${esc(dateStr())} · ${esc(D.status)}: ${esc(L.statusName[fk.status])}</p></div></header>
        <p class="fk-review-hint">${ic('info')}${esc(final ? D.finalizedNote : D.reviewHint)}</p>
        <section class="fk-sec fk-sec-title"><h1>${esc(p.title || L.pdfLabels.untitled)}</h1></section>
        ${SECTION_ORDER.map((k, i) => docSection(k, i + 1)).join('')}
        <section class="fk-sec" id="fk-sec-references"><div class="fk-sec-head"><h3><span>${SECTION_ORDER.length + 1}</span>${esc(L.sections.references)}</h3></div>
          ${srcs.length ? `<ol class="fk-refs-list">${srcs.map(s => { const u = safeUrl(s.url); return u ? `<li>${esc(s.title || host(u))} <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u)}</a></li>` : ''; }).join('')}</ol>` : `<p class="fk-muted">${esc(L.pdfLabels.noSources)}</p>`}</section>
        <footer class="fk-paper-foot">${esc(L.pdfLabels.footer)}</footer>
      </article></div>`;
  }

  /* ---------- AI: conversation, background proposal updates, research ---------- */
  async function chatTurn() {
    const epoch = fk.epoch;
    fk.busy = 'chat'; fk.error = null; fk.suggestions = []; render();
    try {
      const offerable = canOffer(); // only offer the review once the research is in
      const r = await api('chat', { lang: fk.lang, messages: convo(), proposal: fk.proposal, check: fk.check, locked: fk.locked, confirmed: fk.confirmed, researching: fk.researching, readyForReview: offerable, reviewOffered: fk.reviewOffered }, 120000);
      if (epoch !== fk.epoch) return;
      fk.messages.push({ role: 'assistant', text: r.reply }); fk.suggestions = r.suggestions || [];
      fk.busy = null;
      if (offerable && !fk.reviewOffered) fk.reviewOffered = true; // the reply itself offered the review
      else maybeOffer();
      render(); focusInput();
      requestUpdate({ mode: 'update' });
    } catch (e) {
      if (epoch !== fk.epoch) return;
      fk.busy = null; fk.error = { message: errText(e), retry: 'chat' }; render();
    }
  }
  function focusInput() { const i = $('#fkInput'); if (i && !fk.error && matchMedia('(pointer:fine)').matches) i.focus(); }
  function send(text) {
    text = String(text || '').replace(/\s+$/, '').slice(0, MAX_INPUT).trim();
    if (!text || fk.busy || !available()) return;
    fk.messages.push({ role: 'user', text, snapshot: snapshot() });
    const i = $('#fkInput'); i.value = ''; grow();
    fk.tab = 'chat'; fk.mode = 'chat';
    chatTurn();
  }
  /* one proposal update at a time; a request made meanwhile runs right after (a regenerate or a section edit is never dropped) */
  function requestUpdate(opts) {
    if (!available() || !convo().length) return;
    if (fk.updating) { const rank = o => ({ update: 0, translate: 1, regenerate: 2, section: 3 }[o.mode]); if (!fk.updateQueued || rank(opts) >= rank(fk.updateQueued)) fk.updateQueued = opts; return; }
    runUpdate(opts);
  }
  async function runUpdate(opts) {
    const epoch = fk.epoch;
    fk.updating = opts.mode; fk.updateError = null; fk.lastOpts = opts; render();
    try {
      const r = await api('update', { lang: fk.lang, messages: convo(), proposal: fk.proposal, check: fk.check, locked: fk.locked, confirmed: fk.confirmed, mode: opts.mode, section: opts.section, instruction: opts.instruction }, 200000);
      if (epoch !== fk.epoch) return;
      fk.proposal = r.proposal;
      if (fk.confirmed.length) fk.proposal.assumptions = fk.proposal.assumptions.filter(a => !fk.confirmed.includes(a.text)); // confirmed facts are no longer assumptions
      Object.entries(r.pending || {}).forEach(([k, v]) => { fk.pending[k] = v; });
      const now = Date.now(); if ((r.changes || []).length) { fk.lastChanged = now; r.changes.forEach(c => { fk.changes[c.section] = now; }); }
      fk.readyForResearch = fk.readyForResearch || r.readyForResearch;
      if (opts.mode === 'section') fk.improve = null;
      fk.readyForReview = !!r.readyForReview || fk.readyForReview;
      if ((r.readyForResearch || fk.readyForReview) && !fk.check && !fk.researching && !fk.researchError) runResearch({});
      else if (r.researchStale && fk.check && !fk.researching) runResearch({});
      maybeOffer();
      markDirty();
    } catch (e) {
      if (epoch !== fk.epoch) return;
      fk.updateError = errText(e);
    } finally {
      if (epoch === fk.epoch) {
        fk.updating = null;
        const q = fk.updateQueued; fk.updateQueued = null;
        render();
        if (q) runUpdate(q);
        setTimeout(() => { if (fk.lastChanged && Date.now() - fk.lastChanged >= 15000) renderActivity(); }, 15500);
      }
    }
  }
  async function runResearch({ focus }) {
    if (fk.researching || !available() || !hasIdea()) return;
    const epoch = fk.epoch;
    fk.researching = true; fk.researchError = null; fk.researchStep = 0; fk.researchForm = false; render();
    clearInterval(researchTimer); researchTimer = setInterval(() => { fk.researchStep += 1; renderActivity(); const pa = $('#fkPanel .fk-panel-activity'); if (pa) pa.innerHTML = activityHTML(true); }, 14000);
    try {
      const r = await api('check', { lang: fk.lang, proposal: fk.proposal, focus: focus || '' }, 330000);
      if (epoch !== fk.epoch) return;
      fk.check = r; fk.messages.push({ role: 'check', check: r }); fk.suggestions = t().checkFollow.slice();
      fk.changes.assessment = Date.now(); fk.lastChanged = fk.changes.assessment;
      markDirty();
      requestUpdate({ mode: 'update' }); // fold the findings into the summary, benefits and plan
    } catch (e) { if (epoch === fk.epoch) fk.researchError = errText(e); }
    finally { if (epoch === fk.epoch) { fk.researching = false; clearInterval(researchTimer); if (fk.researchError) maybeOffer(); render(); } }
  }
  /* the review is offered once the draft is complete AND the existing-implementation research has finished (or failed) */
  function canOffer() { return !!(fk.readyForReview && !fk.researching && (fk.check || fk.researchError)); }
  function maybeOffer() {
    if (!canOffer() || fk.reviewOffered || fk.busy || fk.mode !== 'chat' || fk.status !== 'draft') return;
    fk.reviewOffered = true; fk.messages.push({ role: 'notice', kind: 'offer-review' });
  }

  /* ---------- saving (server), reopening, resuming ---------- */
  const savePayload = () => ({
    status: fk.status, lang: fk.lang,
    payload: { proposal: fk.proposal, check: fk.check, messages: fk.messages.map(m => m.role === 'check' ? { role: 'check', check: m.check } : { role: m.role, text: m.text || '', ...(m.kind ? { kind: m.kind } : {}) }), locked: fk.locked, confirmed: fk.confirmed, pending: fk.pending, reviewOffered: fk.reviewOffered }
  });
  async function saveProposal({ silent } = {}) {
    if (!storage().available || fk.saving || !hasIdea()) return false;
    const epoch = fk.epoch, L = t();
    fk.saving = true; if (!silent) render();
    try {
      if (!fk.saved) {
        const r = await http('POST', 'api/fekra/proposals', savePayload(), 30000);
        if (epoch !== fk.epoch) return false;
        fk.saved = { ref: r.ref, key: r.key, version: r.version }; fk.dirty = false;
        if (!silent) saveDialog();
      } else {
        const r = await http('PUT', `api/fekra/proposals/${fk.saved.ref}`, { baseVersion: fk.saved.version, ...savePayload() }, 30000, { 'X-Fekra-Key': fk.saved.key });
        if (epoch !== fk.epoch) return false;
        fk.saved.version = r.version; fk.dirty = false;
        if (!silent) toast(L.savedVersion(r.version));
      }
      return true;
    } catch (e) { if (epoch === fk.epoch && !silent) toast(errText(e)); return false; }
    finally { if (epoch === fk.epoch) { fk.saving = false; render(); } }
  }
  function scheduleAutosave() { clearTimeout(autosaveTimer); if (fk.saved) autosaveTimer = setTimeout(() => { if (fk.dirty && !fk.saving) saveProposal({ silent: true }); }, 2500); }
  const resumeLink = s => `${location.origin}${location.pathname}#fekra=${s.ref}~${s.key.replace(/-/g, '')}`;
  function saveDialog() {
    const L = t(), s = fk.saved;
    $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic('check')}</div><h3 id="confirmTitle">${esc(L.saveTitle)}</h3><p>${esc(L.saveIntro)}</p>
      <div class="fk-save-codes"><div><small>${esc(L.doc.reference)}</small><b>${esc(s.ref)}</b></div><div><small>${esc(L.accessCode)}</small><b>${esc(s.key)}</b></div></div>
      <div class="fk-save-qr"><canvas id="fkResumeQr" width="220" height="220" aria-label="${esc(L.scanToResume)}"></canvas><small>${esc(L.scanToResume)}</small></div>
      ${storage().persistent ? '' : `<p class="fk-save-warn">${ic('alert')}${esc(L.notPersistent)}</p>`}
      <div class="modal-actions"><button class="btn btn-primary" data-action="confirm-cancel">${esc(L.ok)}</button></div>`;
    $('#confirmBox').setAttribute('dir', L.dir); showOverlay('confirm');
    try { const cv = $('#fkResumeQr'), x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 220, 220); QR.draw(x, QR.encode(resumeLink(s)), 0, 0, 220); } catch { /* the code is still shown */ }
  }
  function openDialog() {
    const L = t();
    $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic('upload')}</div><h3 id="confirmTitle">${esc(L.openTitle)}</h3><p>${esc(L.openIntro)}</p>
      <form class="fk-open-form" data-action-form="fk-open"><label><span>${esc(L.doc.reference)}</span><input id="fkOpenRef" placeholder="${esc(L.refPh)}" autocomplete="off" autocapitalize="characters" maxlength="20" data-autofocus></label>
      <label><span>${esc(L.accessCode)}</span><input id="fkOpenKey" placeholder="${esc(L.codePh)}" autocomplete="off" autocapitalize="characters" maxlength="20"></label>
      <p class="fk-open-err" id="fkOpenErr" role="alert"></p>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-action="confirm-cancel">${esc(L.cancel)}</button><button type="submit" class="btn btn-primary">${esc(L.openGo)}</button></div></form>`;
    $('#confirmBox').setAttribute('dir', L.dir); showOverlay('confirm');
  }
  async function openSaved(ref, key, fromDialog) {
    ref = String(ref || '').trim().toUpperCase(); key = String(key || '').trim();
    try {
      const rec = await http('GET', `api/fekra/proposals/${encodeURIComponent(ref)}`, null, 20000, { 'X-Fekra-Key': key });
      const d = rec.data || {}, n = fresh(rec.lang === 'ar' ? 'ar' : 'en');
      n.epoch = fk.epoch + 1;
      n.proposal = { ...emptyProposal(), ...(d.proposal || {}), problem: { ...emptyProposal().problem, ...((d.proposal || {}).problem || {}) } };
      n.check = d.check || null; n.locked = d.locked || []; n.confirmed = d.confirmed || []; n.pending = d.pending || {}; n.reviewOffered = !!d.reviewOffered;
      n.messages = (d.messages || []).map(m => m.role === 'check' ? { role: 'check', check: m.check } : m);
      n.status = rec.status || 'draft'; n.readyForReview = filled.overview(n.proposal) && filled.problem(n.proposal); n.readyForResearch = !!n.check;
      n.saved = { ref: rec.ref, key: key.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/(.{4})(?=.)/g, '$1-'), version: rec.version };
      n.mode = n.status === 'draft' ? 'chat' : 'doc';
      clearInterval(researchTimer); fk = n;
      if (fromDialog) hideOverlay('confirm');
      if (state.view !== 'fekra') navigate('fekra'); else render();
      toast(t().opened);
    } catch (e) {
      if (fromDialog) { const el = $('#fkOpenErr'); if (el) el.textContent = errText(e); } else toast(errText(e));
    }
  }

  /* ---------- PDF ---------- */
  function pdfModel() {
    const L = t(), F = L.fields, PL = L.pdfLabels, p = P(), D = L.doc, blocks = [];
    const tagOf = b => [[L.basis[b.basis] || '', b.basis], ...(b.needsValidation ? [[L.needsValidation, 'validate']] : [])].filter(x => x[0]);
    blocks.push({ type: 'cover', meta: [[D.reference, fk.saved ? fk.saved.ref : D.unsavedRef], [D.date, dateStr()], [D.status, L.statusName[fk.status]], [PL.language, PL.langName]] });
    if (p.executiveSummary) blocks.push({ type: 'box', label: F.executiveSummary, text: p.executiveSummary });
    let n = 0; const h = text => blocks.push({ type: 'heading', num: ++n, text });
    h(L.sections.overview);
    if (p.solution) blocks.push({ type: 'labelled', label: F.solution, text: p.solution });
    if (p.scope) blocks.push({ type: 'labelled', label: F.scope, text: p.scope });
    h(L.sections.problem);
    ['current', 'issue', 'whyItMatters', 'affected', 'ifUnresolved'].forEach((f, i) => { if (p.problem[f]) blocks.push({ type: 'labelled', label: F[f], text: p.problem[f], tag: i === 0 ? [L.basis[p.problem.basis] || '', p.problem.basis === 'user' ? 'user' : 'inferred'] : null }); });
    h(L.sections.assessment);
    const c = fk.check;
    if (!c) { blocks.push({ type: 'status', label: L.provisional, colors: STATUS_COLORS.inconclusive }); blocks.push({ type: 'note', text: L.provisionalNote }); }
    else {
      blocks.push({ type: 'status', label: L.status[c.status], colors: STATUS_COLORS[c.status], note: c.searched ? L.checkMeta(c.sources.length, dateStr(c.checkedAt)) : L.checkMetaNone(dateStr(c.checkedAt)) });
      if (c.summary) blocks.push({ type: 'para', text: c.summary });
      const idx = id => { const i = c.sources.findIndex(s => s.id === id); return i >= 0 ? `[${i + 1}]` : ''; };
      const rows = list => list.map(x => [`${x.entity || ''}${x.entity && x.initiative ? ' — ' : ''}${x.initiative || ''}`, x.description, [x.similarities && `${L.similarities}: ${x.similarities}`, x.differences && `${L.differences}: ${x.differences}`].filter(Boolean).join('\n'), (x.sources || []).map(idx).join(' ')]);
      const cols = [{ title: `${PL.org} / ${PL.initiative}`, w: 2.6 }, { title: PL.desc, w: 3 }, { title: PL.simDiff, w: 3.4 }, { title: PL.source, w: 1 }];
      const g = c.similar.filter(x => x.scope === 'gdrfa'), o = c.similar.filter(x => x.scope !== 'gdrfa');
      if (c.searched) { blocks.push({ type: 'labelled', label: L.withinGdrfa, text: g.length ? '' : L.noneInGdrfa }); if (g.length) blocks.push({ type: 'table', cols, rows: rows(g) }); }
      if (o.length) { blocks.push({ type: 'labelled', label: L.otherOrgs, text: '' }); blocks.push({ type: 'table', cols, rows: rows(o) }); }
      [[L.exists, c.alreadyExists], [L.different, c.different], [L.opportunities, c.opportunities]].forEach(([lab, items]) => { if (items.length) { blocks.push({ type: 'labelled', label: lab, text: '' }); blocks.push({ type: 'bullets', items: items.map(x => ({ text: x })) }); } });
      blocks.push({ type: 'labelled', label: L.limitations, text: '' }); blocks.push({ type: 'bullets', items: [...c.limitations, L.internalNote, L.notProof].map(x => ({ text: x })) });
    }
    const benefits = (key) => { h(L.sections[key]); if (!p[key].length) blocks.push({ type: 'note', text: PL.none }); else blocks.push({ type: 'table', cols: [{ title: F.benefit, w: 2.3 }, { title: F.reasoning, w: 3 }, { title: `${F.kpi} / ${F.measurement}`, w: 2.9 }, { title: PL.basisCol, w: 2 }], rows: p[key].map(b => [b.benefit, b.reasoning, [b.kpi, b.measurement].filter(Boolean).join('\n'), tagOf(b).map(x => x[0]).join('\n')]) }); };
    benefits('customerBenefits'); benefits('orgBenefits');
    h(L.sections.technology);
    if (p.technologies.length) blocks.push({ type: 'table', cols: [{ title: PL.tech, w: 2 }, { title: F.role, w: 2.6 }, { title: F.why, w: 2.4 }, { title: `${F.dependencies} / ${F.considerations}`, w: 3.2 }], rows: p.technologies.map(x => [x.name, x.role, x.why, [x.dependencies, x.considerations].filter(Boolean).join('\n')]) });
    if (p.architecture) blocks.push({ type: 'labelled', label: F.architecture, text: p.architecture });
    h(L.sections.roadmap);
    if (p.roadmap.length) blocks.push({ type: 'table', cols: [{ title: PL.phase, w: 2 }, { title: F.activities, w: 4.2 }, { title: F.validation, w: 3.8 }], rows: p.roadmap.map(r => [L.phases[r.phase] || r.phase, r.activities, r.validation]) });
    if (p.dependencies.length) { blocks.push({ type: 'labelled', label: F.depsList, text: '' }); blocks.push({ type: 'bullets', items: p.dependencies.map(x => ({ text: x })) }); }
    if (p.risks.length) blocks.push({ type: 'table', cols: [{ title: F.risk, w: 4 }, { title: F.mitigation, w: 6 }], rows: p.risks.map(r => [r.risk, r.mitigation]) });
    h(L.sections.assumptions);
    blocks.push({ type: 'note', text: PL.assumptionsIntro });
    if (p.assumptions.length) blocks.push({ type: 'bullets', items: p.assumptions.map(a => ({ text: `${L.areas[a.area] || a.area}: ${a.text}`, tag: [L.basis.inferred, 'inferred'] })) }); else blocks.push({ type: 'note', text: PL.none });
    if (fk.confirmed.length) { blocks.push({ type: 'labelled', label: F.confirmed, text: '' }); blocks.push({ type: 'bullets', items: fk.confirmed.map(x => ({ text: x, tag: [L.basis.user, 'user'] })) }); }
    if (p.openQuestions.length) { blocks.push({ type: 'labelled', label: F.openQuestions, text: '' }); blocks.push({ type: 'bullets', items: p.openQuestions.map(x => ({ text: x })) }); }
    blocks.push({ type: 'note', text: PL.unverified });
    h(L.sections.references);
    const srcs = sources(); if (srcs.length) blocks.push({ type: 'refs', items: srcs.map(s => ({ title: s.title || host(s.url), url: s.url })) }); else blocks.push({ type: 'note', text: PL.noSources });
    return { dir: L.dir, lang: fk.lang, title: p.title || PL.untitled, reference: fk.saved ? fk.saved.ref : null, labels: PL, logo: ORG_LOGO, blocks };
  }
  async function generatePdf() {
    const L = t();
    if (!filled.overview(P())) { toast(L.needIdea); return; }
    if (!window.FekraPDF) { toast(L.pdfFailed); return; }
    if (!fk.saved && storage().available && CONFIG.served) await saveProposal({ silent: true }); // the PDF carries the proposal reference
    else if (fk.saved && fk.dirty) await saveProposal({ silent: true }); // and the latest saved content
    toast(L.writingPdf);
    try {
      const blob = await window.FekraPDF.build(pdfModel());
      const a = document.createElement('a'), slug = (P().title || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'proposal';
      a.href = URL.createObjectURL(blob); a.download = `Fekra-${fk.saved ? fk.saved.ref : 'Draft'}-${slug}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      toast(L.pdfDone);
    } catch (e) { toast(L.pdfFailed); }
  }

  /* ---------- submission (integration point) ---------- */
  async function submit() {
    if (fk.busy || !hasIdea()) return;
    const L = t(), epoch = fk.epoch; fk.busy = 'submit'; renderDoc();
    try {
      const r = await api('submit', { lang: fk.lang, proposal: fk.proposal, check: fk.check, reference: fk.saved ? fk.saved.ref : null }, 30000);
      if (epoch !== fk.epoch) return;
      if (r.submitted) { fk.status = 'under_review'; markDirty(); infoDialog('check', L.sentTitle, L.sentText(r.reference)); }
      else infoDialog('info', L.pendingSubmitTitle, L.pendingSubmitText);
    } catch (e) { if (epoch === fk.epoch) { if (e.reason === 'offline') infoDialog('info', L.pendingSubmitTitle, L.pendingSubmitText); else toast(errText(e)); } }
    finally { if (epoch === fk.epoch) { fk.busy = null; render(); } }
  }
  function infoDialog(icon, title, text) {
    $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic(icon)}</div><h3 id="confirmTitle">${esc(title)}</h3><p>${esc(text)}</p><div class="modal-actions"><button class="btn btn-primary" data-action="confirm-cancel">${esc(t().ok)}</button></div>`;
    $('#confirmBox').setAttribute('dir', t().dir); showOverlay('confirm');
  }
  function confirmBox(icon, title, text, okLabel, onOk) {
    const L = t();
    $('#confirmBox').innerHTML = `<div class="dialog-ic">${ic(icon)}</div><h3 id="confirmTitle">${esc(title)}</h3><p>${esc(text)}</p><div class="modal-actions"><button class="btn btn-ghost" data-action="confirm-cancel">${esc(L.cancel)}</button><button class="btn btn-primary" data-action="confirm-ok">${esc(okLabel)}</button></div>`;
    $('#confirmBox').setAttribute('dir', L.dir); confirmDialog.onOk = onOk; showOverlay('confirm');
  }

  /* ---------- wiring into the app ---------- */
  VIEWS.push('fekra');
  RENDER.fekra = () => { render(); grow(); };
  const rerender = () => (fk.mode === 'doc' ? renderDoc() : render());
  Object.assign(ACTIONS, {
    'fk-start': d => { const i = $('#fkInput'); i.value = t().starts[+d.id][1]; grow(); updateSend(); i.focus(); i.setSelectionRange(i.value.length, i.value.length); },
    'fk-suggest': d => send(d.q),
    'fk-retry': () => { fk.error = null; chatTurn(); },
    'fk-retry-update': () => requestUpdate(fk.lastOpts || { mode: 'update' }),
    'fk-edit-msg': d => {
      if (fk.busy) return;
      const i = +d.id, m = fk.messages[i]; if (!m || m.role !== 'user') return;
      if (m.snapshot) Object.assign(fk, JSON.parse(JSON.stringify(m.snapshot)));
      fk.messages = fk.messages.slice(0, i); fk.error = null; fk.epoch += 1; fk.updating = null; fk.updateQueued = null; fk.researching = false; clearInterval(researchTimer);
      render(); const inp = $('#fkInput'); inp.value = m.text; grow(); updateSend(); inp.focus();
    },
    'fk-research': () => runResearch({}),
    'fk-research-form': () => { fk.researchForm = true; renderDoc(); const i = $('#fkResearchFocus'); if (i) i.focus(); },
    'fk-research-cancel': () => { fk.researchForm = false; renderDoc(); },
    'fk-review': () => { fk.mode = 'doc'; if (fk.status === 'draft') { fk.status = 'under_review'; markDirty(); } fk.reviewOffered = true; render(); const s = $('#fkDoc .fk-paper-scroll'); if (s) s.scrollTop = 0; },
    'fk-keep-refining': () => { const i = $('#fkInput'); if (i) i.focus(); },
    'fk-chat': () => { fk.mode = 'chat'; fk.edit = null; fk.improve = null; fk.researchForm = false; render(); },
    'fk-panel': () => { fk.panel = !fk.panel; render(); },
    'fk-tab': d => { fk.tab = d.id; render(); },
    'fk-lang': () => {
      fk.lang = fk.lang === 'ar' ? 'en' : 'ar';
      if (filled.overview(P()) || filled.problem(P())) requestUpdate({ mode: 'translate' }); // the proposal follows the chosen language
      render();
      if (window.kioskSetLang) window.kioskSetLang(fk.lang, { fromFekra: true }); // the rest of the kiosk follows too
    },
    'fk-save': () => saveProposal({}),
    'fk-open': () => openDialog(),
    'fk-pdf': () => generatePdf(),
    'fk-submit': () => submit(),
    'fk-new': () => {
      if (!hasIdea()) return;
      const L = t();
      confirmBox('reset', L.newIdeaTitle, L.newIdeaText, L.clear, () => { const lang = fk.lang, e = fk.epoch + 1; clearInterval(researchTimer); clearTimeout(autosaveTimer); fk = fresh(lang); fk.epoch = e; render(); });
    },
    'fk-lock': d => { const k = d.id; fk.locked = isLocked(k) ? fk.locked.filter(x => x !== k) : [...fk.locked, k]; markDirty(); renderDoc(); renderPanel(); },
    'fk-approve-all': () => { fk.locked = LOCKABLE.slice(); fk.status = 'finalized'; fk.edit = null; fk.improve = null; markDirty(); render(); if (fk.saved) saveProposal({ silent: true }); },
    'fk-reopen': () => { fk.status = 'under_review'; markDirty(); render(); },
    'fk-regenerate': () => { const D = t().doc; confirmBox('reset', D.regenerateTitle, D.regenerateText, D.go, () => requestUpdate({ mode: 'regenerate' })); },
    'fk-pending-accept': d => { const k = d.id; if (fk.pending[k]) { Object.assign(fk.proposal, fk.pending[k]); delete fk.pending[k]; fk.changes[k] = Date.now(); markDirty(); rerender(); renderPanel(); } },
    'fk-pending-dismiss': d => { delete fk.pending[d.id]; markDirty(); rerender(); renderPanel(); },
    'fk-sec-edit': d => { const k = d.id; fk.edit = { key: k, draft: JSON.parse(JSON.stringify(Object.fromEntries(SECTION_FIELDS[k].map(f => [f, fk.proposal[f]])))) }; fk.improve = null; renderDoc(); const el = $(`#fk-sec-${k} [data-path]`); if (el) el.focus(); },
    'fk-sec-save': () => {
      if (!fk.edit) return;
      const k = fk.edit.key, dft = fk.edit.draft, e = EDITORS[k];
      if (!Array.isArray(e)) { [e, e.list2].filter(Boolean).forEach(spec => { dft[spec.list] = dft[spec.list].filter(it => Object.values(it).some(v => typeof v === 'string' && v.trim() && !PHASES.includes(v) && !AREAS.includes(v))); }); }
      if (k === 'customerBenefits' || k === 'orgBenefits') dft[k] = dft[k].map(b => ({ ...b, basis: 'user', needsValidation: b.needsValidation }));
      Object.assign(fk.proposal, dft); delete fk.pending[k];
      if (!isLocked(k)) fk.locked.push(k); // the employee's own wording is approved content
      fk.changes[k] = Date.now(); fk.edit = null; markDirty(); renderDoc(); renderPanel();
    },
    'fk-sec-cancel': () => { fk.edit = null; fk.improve = null; renderDoc(); },
    'fk-ed-add': d => { const e = EDITORS[fk.edit.key], spec = e.list === d.list ? e : e.list2; fk.edit.draft[d.list].push(spec.blank()); renderDoc(); },
    'fk-ed-remove': d => { fk.edit.draft[d.list].splice(+d.id, 1); renderDoc(); },
    'fk-sec-improve': d => { fk.improve = d.id; fk.edit = null; renderDoc(); const inp = $('#fkImprove'); if (inp) inp.focus(); },
    'fk-sec-quick': d => { if (fk.improve) requestUpdate({ mode: 'section', section: fk.improve, instruction: d.q }); renderDoc(); },
    'fk-confirm': d => { const a = P().assumptions[+d.id]; if (!a) return; fk.confirmed.push(a.text); fk.proposal.assumptions = P().assumptions.filter((_, i) => i !== +d.id); markDirty(); rerender(); renderPanel(); },
    'fk-correct': d => { const a = P().assumptions[+d.id]; if (!a) return; fk.mode = 'chat'; fk.tab = 'chat'; render(); const i = $('#fkInput'); i.value = t().doc.correctPrefix(a.text); grow(); updateSend(); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  });
  document.addEventListener('submit', e => {
    const f = e.target;
    if (f.matches('[data-action-form="fk-improve"]')) { e.preventDefault(); const v = ($('#fkImprove') || {}).value; if (v && v.trim() && fk.improve) { requestUpdate({ mode: 'section', section: fk.improve, instruction: v.trim().slice(0, 1000) }); renderDoc(); } }
    if (f.matches('[data-action-form="fk-research"]')) { e.preventDefault(); runResearch({ focus: ($('#fkResearchFocus') || {}).value || '' }); }
    if (f.matches('[data-action-form="fk-open"]')) { e.preventDefault(); openSaved($('#fkOpenRef').value, $('#fkOpenKey').value, true); }
  });

  /* reset + inactivity hooks used by app.js; resume link (#fekra=REF~CODE) handled once the runtime config is loaded */
  window.fekraHasWork = () => hasIdea() || !!($('#fkInput') && $('#fkInput').value.trim());
  window.fekraReset = () => { const e = fk.epoch + 1; clearInterval(researchTimer); clearTimeout(autosaveTimer); fk = fresh(window.I18N && window.I18N.lang === 'ar' ? 'ar' : 'en'); fk.epoch = e; if (built) { $('#fkInput').value = ''; render(); } };
  /* the kiosk's language switch: Fekra changes with it, rewriting a drafted proposal in the new language */
  window.fekraSetLang = lang => {
    lang = lang === 'ar' ? 'ar' : 'en'; if (fk.lang === lang) return;
    fk.lang = lang;
    if (filled.overview(P()) || filled.problem(P())) requestUpdate({ mode: 'translate' });
    if (built) render();
  };
  window.fekraBoot = () => {
    const m = /#fekra=(FK-\d{6}-[A-Z0-9]{4})~([A-Z0-9]{12})/i.exec(location.hash || '');
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search); // the code should not linger in the address bar
    openSaved(m[1], m[2], false);
  };
})();
