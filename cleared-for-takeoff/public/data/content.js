/* =====================================================================
   CLEARED FOR TAKEOFF — CONTENT
   Booth content shared by the kiosk (browser) and the API server (Node).
   Edit this file to change tracks, demos, sessions, news and journey rules.
   Collections whose `meta.*IsSample` flag is true are labelled as sample
   content on screen — replace them with approved content and set the flag
   to false before going live.
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFT_CONTENT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
  meta: {
    product: 'Agentic AI: Cleared for Takeoff',
    event: 'GITEX 2026',
    newsIsSample: true,
    sessionsAreSample: true,
    demosAreIllustrative: true
  },
  booth: { name: 'GDRFA Booth', event: 'GITEX 2026', zones: [
    { id: 'main', label: 'Main Stage', short: 'Stage', x: 20, y: 20, w: 250, h: 120 },
    { id: 'a', label: 'Zone A · AI Lab', short: 'A', x: 290, y: 20, w: 170, h: 120 },
    { id: 'b', label: 'Zone B · Smart Travel', short: 'B', x: 20, y: 160, w: 170, h: 120 },
    { id: 'c', label: 'Zone C · Experience Wall', short: 'C', x: 210, y: 160, w: 120, h: 120 },
    { id: 'd', label: 'Zone D · Innovation Studio', short: 'D', x: 350, y: 160, w: 110, h: 120 }
  ]},

  roles: [
    { id: 'gov', label: 'Government Employee', icon: 'gov', desc: 'Public-sector staff and service teams' },
    { id: 'tech', label: 'Technology Professional', icon: 'code', desc: 'Engineers, architects, data & IT' },
    { id: 'student', label: 'Student', icon: 'tracks', desc: 'University and school learners' },
    { id: 'leader', label: 'Business Leader', icon: 'briefcase', desc: 'Executives, managers, founders' },
    { id: 'other', label: 'Other', icon: 'user', desc: 'Curious about the AI future' }
  ],
  experience: [
    { id: 'beginner', label: 'Beginner', icon: 'spark', desc: 'New to AI — I want the essentials', level: 0 },
    { id: 'intermediate', label: 'Intermediate', icon: 'layers', desc: 'I use AI tools and know the basics', level: 1 },
    { id: 'advanced', label: 'Advanced', icon: 'rocket', desc: 'I build, lead or govern AI work', level: 2 }
  ],
  levels: ['Explorer', 'Practitioner', 'Innovator'],
  interests: [
    { id: 'agentic', label: 'Agentic AI', icon: 'agent', desc: 'Agents that plan and act' },
    { id: 'genai', label: 'Generative AI', icon: 'spark', desc: 'Text, image and code generation' },
    { id: 'gov', label: 'Government Services', icon: 'gov', desc: 'Proactive public services' },
    { id: 'cyber', label: 'Cybersecurity', icon: 'shield', desc: 'Secure, trusted AI' },
    { id: 'cx', label: 'Customer Experience', icon: 'cx', desc: 'Human-centred journeys' },
    { id: 'data', label: 'Data Analytics', icon: 'data', desc: 'Insight and forecasting' },
    { id: 'automation', label: 'AI Automation', icon: 'automation', desc: 'Workflows that run themselves' },
    { id: 'future', label: 'Future Technologies', icon: 'rocket', desc: 'Quantum, twins, robotics' }
  ],

  tracks: [
    { id: 'agentic', title: 'Agentic AI Foundations', icon: 'agent', level: 'Beginner', duration: '4 modules · 3 hrs', colors: ['#1d6dff', '#46d2ff'],
      desc: 'Understand how AI agents perceive, plan, use tools and act — and where they fit in public services.',
      modules: ['What makes AI “agentic”', 'Planning, memory and tool use', 'Human-in-the-loop design', 'Your first agent workflow'],
      outcomes: ['Explain the difference between chatbots and agents', 'Map a process where an agent could assist', 'Identify where human oversight is essential'],
      interests: ['agentic', 'genai', 'automation'],
      path: {
        discover: ['How AI agents differ from chatbots', 'Agent architectures in the real world', 'The multi-agent systems landscape'],
        learn: ['Prompts, tools and memory basics', 'Designing agent workflows with guardrails', 'Orchestration, evaluation and agent ops'],
        practice: ['Build a no-code FAQ agent', 'Prototype a tool-using service agent', 'Stress-test a multi-agent pipeline'],
        innovate: ['Spot one task an agent could assist with', 'Pitch an agent-assisted service pilot', 'Design an agentic operating model'] } },
    { id: 'gov', title: 'AI for Government Services', icon: 'gov', level: 'All levels', duration: '5 modules · 4 hrs', colors: ['#0f8a8a', '#46d2ff'],
      desc: 'Explore how AI can make public services proactive, personalised and paperless — responsibly.',
      modules: ['Proactive & life-event services', 'AI in residency and travel journeys (illustrative)', 'Policy, ethics and accountability', 'Measuring public value', 'Scaling from pilot to platform'],
      outcomes: ['Describe what an AI-enabled public service looks like', 'Apply responsible-AI principles to a service', 'Build a simple value case for an AI pilot'],
      interests: ['gov', 'cx', 'automation'],
      path: {
        discover: ['What AI-enabled public services look like', 'Service-design patterns for AI', 'Global benchmarks in AI-native government'],
        learn: ['Responsible AI principles for the public sector', 'Redesigning a service journey with AI', 'AI governance, risk and procurement'],
        practice: ['Map a customer journey and its pain points', 'Run an AI service-design sprint', 'Build a value case and KPI model'],
        innovate: ['Suggest one improvement to a service you use', 'Propose a proactive-service pilot', 'Lead a cross-entity AI service programme'] } },
    { id: 'cyber', title: 'Cybersecurity in the AI Era', icon: 'shield', level: 'Intermediate', duration: '4 modules · 3.5 hrs', colors: ['#5b3dff', '#46d2ff'],
      desc: 'Learn how AI changes the threat landscape — and how to secure agents, models and data.',
      modules: ['AI-enabled threats & deepfakes', 'Securing LLMs and agents', 'Identity, access and zero trust', 'AI for security operations'],
      outcomes: ['Recognise AI-enabled social engineering', 'Explain prompt injection and how to mitigate it', 'Draft a secure-by-design checklist'],
      interests: ['cyber', 'agentic', 'data'],
      path: {
        discover: ['How attackers use AI today', 'Threats unique to AI agents', 'Adversarial ML and model supply chains'],
        learn: ['Recognising deepfakes and AI phishing', 'Prompt injection and agent guardrails', 'Red-teaming and secure-by-design AI'],
        practice: ['Spot-the-deepfake challenge', 'Harden an agent against prompt injection', 'Run an AI red-team exercise'],
        innovate: ['Share one AI-safety habit with your team', 'Draft an AI security checklist for a project', 'Design an AI security operating model'] } },
    { id: 'cx', title: 'Customer Experience with AI', icon: 'cx', level: 'Beginner', duration: '4 modules · 2.5 hrs', colors: ['#c2417a', '#7a4dff'],
      desc: 'Design AI-assisted journeys that feel human — multilingual, accessible and always on.',
      modules: ['Conversational experience design', 'Multilingual & accessible AI', 'Sentiment and feedback intelligence', 'Measuring happiness & effort'],
      outcomes: ['Write a helpful AI conversation flow', 'Design graceful hand-off to people', 'Measure customer effort and satisfaction'],
      interests: ['cx', 'genai', 'gov'],
      path: {
        discover: ['Where AI improves customer happiness', 'Conversation design fundamentals', 'Emotion-aware, omnichannel experiences'],
        learn: ['Writing helpful AI conversations', 'Designing escalation to human agents', 'Personalisation without compromising privacy'],
        practice: ['Redesign one FAQ as a conversation', 'Prototype a multilingual assistant flow', 'A/B test an AI-assisted journey'],
        innovate: ['Suggest one AI touchpoint for your service', 'Pitch a zero-wait-time service concept', 'Design an AI-first customer charter'] } },
    { id: 'data', title: 'Data & Analytics for Impact', icon: 'data', level: 'Intermediate', duration: '5 modules · 4 hrs', colors: ['#0b8f6a', '#2e8bff'],
      desc: 'Turn data into decisions with analytics, forecasting and trustworthy AI insights.',
      modules: ['Data foundations & quality', 'Dashboards that drive action', 'Forecasting & simulation', 'Data governance and privacy', 'Explaining AI insights'],
      outcomes: ['Read KPIs and dashboards critically', 'Understand how forecasts are built', 'Apply privacy and governance basics'],
      interests: ['data', 'automation', 'gov'],
      path: {
        discover: ['How data powers AI decisions', 'From descriptive to predictive analytics', 'Real-time and federated analytics'],
        learn: ['Reading dashboards and KPIs with confidence', 'Forecasting demand with machine learning', 'Data governance, privacy and explainability'],
        practice: ['Explore an open-data dashboard', 'Build a demand-forecast prototype', 'Design a decision-intelligence workflow'],
        innovate: ['Identify one decision data could improve', 'Propose a data product for your team', 'Shape an enterprise data & AI strategy'] } },
    { id: 'emerging', title: 'Emerging Technology & Innovation', icon: 'rocket', level: 'Advanced', duration: '4 modules · 3 hrs', colors: ['#b8862b', '#f4d88f'],
      desc: 'Scan the horizon: quantum, spatial computing, robotics and digital twins for government.',
      modules: ['Horizon-scanning methods', 'Digital twins & smart cities', 'Robotics, IoT & edge AI', 'Quantum-ready thinking'],
      outcomes: ['Build a personal technology radar', 'Assess an emerging technology’s readiness', 'Frame an innovation challenge'],
      interests: ['future', 'genai', 'agentic'],
      path: {
        discover: ['The technologies shaping 2030', 'Digital twins and smart-city platforms', 'Convergence: AI, quantum and robotics'],
        learn: ['Foresight and trend-radar basics', 'Evaluating emerging-tech readiness', 'Scenario planning for disruptive tech'],
        practice: ['Build a personal technology radar', 'Run a futures-thinking workshop', 'Prototype a digital-twin scenario'],
        innovate: ['Share one future idea with a colleague', 'Launch an innovation challenge', 'Build an innovation portfolio and lab'] } }
  ],

  demos: [
    { id: 'knowledge', title: 'Agentic Government Knowledge Assistant', icon: 'knowledge', zone: 'a', status: 'Interactive demo', colors: ['#1d6dff', '#46d2ff'],
      keywords: ['knowledge assistant', 'knowledge', 'policy', 'policies', 'procedures', 'citations'],
      overview: 'A multi-agent assistant that finds answers across policies, procedures and service guides, cites its sources and hands over to a human expert when it is unsure.',
      challenge: 'Staff and customers navigate thousands of pages of regulations and service guides. Answers can vary between channels and take time to find.',
      how: ['A retrieval agent searches approved knowledge sources only', 'A reasoning agent drafts an answer and attaches citations', 'A policy agent checks accuracy, tone and permissions', 'Uncertain or sensitive cases are routed to a human expert'],
      benefits: ['Faster, more consistent answers', 'Traceable sources for every response', 'Less time spent searching documents', 'Knowledge stays current as policies change'],
      tracks: ['agentic', 'gov'], tags: ['agentic', 'genai', 'gov', 'automation'],
      questions: ['How does the knowledge assistant avoid wrong answers?', 'What is Agentic AI?', 'Which learning track covers AI agents?'] },
    { id: 'border', title: 'Intelligent Border Experience', icon: 'passport', zone: 'b', status: 'Concept experience', colors: ['#0f8a8a', '#46d2ff'],
      keywords: ['border', 'travel', 'airport', 'smart gate', 'smart gates', 'biometric', 'identity'],
      overview: 'An illustrative walkthrough of a seamless, privacy-conscious travel journey that combines consent-based digital identity, biometrics and risk analytics.',
      challenge: 'Growing passenger volumes require secure, thorough processing that still feels fast and welcoming for every traveller.',
      how: ['Travellers verify identity digitally with consent', 'Biometric matching at smart gates (concept)', 'Risk analytics flag exceptions for officers', 'Officers stay in control of every decision'],
      benefits: ['Shorter queues and waiting times', 'Officers focus on genuine exceptions', 'Consistent, auditable processing', 'A more welcoming traveller experience'],
      tracks: ['gov', 'cyber', 'data'], tags: ['gov', 'cyber', 'data', 'future'],
      questions: ['How is privacy protected in the border experience?', 'What sessions cover AI identity?', 'What is the Cybersecurity in the AI Era track?'] },
    { id: 'automation', title: 'AI-Powered Service Automation', icon: 'automation', zone: 'a', status: 'Interactive demo', colors: ['#5b3dff', '#2e8bff'],
      keywords: ['service automation', 'automation', 'documents', 'application', 'applications', 'workflow'],
      overview: 'See how AI agents can pre-check applications, extract data from documents and keep applicants informed — with people approving every outcome.',
      challenge: 'Manual checks of documents and forms create backlogs, and applicants are often asked repeatedly for missing information.',
      how: ['Document AI extracts and validates key fields', 'An agent checks completeness against service rules', 'Proactive notifications explain exactly what is missing', 'Staff review and approve with full context'],
      benefits: ['Fewer incomplete applications', 'Faster processing times', 'Clear, proactive status updates', 'More staff time for complex cases'],
      tracks: ['agentic', 'gov', 'cx'], tags: ['automation', 'agentic', 'gov', 'cx'],
      questions: ['How do AI agents help with service automation?', 'What is the AI for Government Services track?', 'What sessions are happening today?'] },
    { id: 'radar', title: 'Agentic AI: Cleared for Takeoff', icon: 'radar', zone: 'c', status: 'Live — you are using it', live: true, colors: ['#b8862b', '#2e8bff'],
      keywords: ['cleared for takeoff', 'takeoff', 'future radar', 'this app', 'this experience', 'this kiosk', 'this screen'],
      overview: 'This experience: a personal guide that curates AI news, demos and learning journeys around your role, experience and interests.',
      challenge: 'Visitors face an overwhelming amount of AI information and few clear starting points.',
      how: ['You share your role, experience and interests — nothing else', 'Claude (Anthropic) picks real courses for your level from a curated catalogue', 'Every pick is checked against the catalogue; offline rules take over if the AI is unavailable', 'Your passport is created on the kiosk — name, email and photo never leave it'],
      benefits: ['A personal starting point in under two minutes', 'Real courses matched to your level', 'A take-home passport with a QR code to your courses', 'Privacy by design'],
      tracks: ['agentic', 'emerging', 'cx'], tags: ['agentic', 'genai', 'future', 'cx'],
      questions: ['How does Cleared for Takeoff personalise my journey?', 'What is the Agentic AI Passport?', 'Is my data stored?'] },
    { id: 'studio', title: 'AI Innovation Studio', icon: 'bulb', zone: 'd', status: 'Hands-on workshop', colors: ['#c2417a', '#f4a35b'],
      keywords: ['innovation studio', 'studio', 'co-creation', 'ideas', 'idea', 'prototype'],
      overview: 'A co-creation space where visitors sketch AI-enabled service ideas and test them with simulated agents.',
      challenge: 'Good ideas often stall somewhere between inspiration and a testable prototype.',
      how: ['Pick a challenge card and a target user', 'Combine AI capability cards into a concept', 'Simulate the concept in a guided agent walkthrough', 'Leave with a one-page concept canvas'],
      benefits: ['Ideas tested in minutes, not months', 'A shared language for business and tech', 'Human-centred AI concepts', 'A pipeline of innovation ideas'],
      tracks: ['emerging', 'agentic', 'cx'], tags: ['future', 'genai', 'agentic', 'cx'],
      questions: ['Can I build my own AI agent at the booth?', 'What is the Emerging Technology & Innovation track?', 'When is the next workshop?'] },
    { id: 'analytics', title: 'Smart Government Analytics', icon: 'analytics', zone: 'c', status: 'Illustrative dashboard', colors: ['#0b8f6a', '#46d2ff'],
      keywords: ['analytics', 'dashboard', 'forecast', 'forecasting', 'simulation', 'demand'],
      overview: 'An illustrative command view showing how forecasting and simulation can help plan capacity and service demand. Uses synthetic data only.',
      challenge: 'Seasonal peaks and major events make it hard to plan staff and resources ahead of time.',
      how: ['Historical and real-time signals are combined (synthetic in this demo)', 'Forecast models predict demand by channel', 'What-if simulation tests staffing scenarios', 'Explainable insights show why a forecast changed'],
      benefits: ['Proactive capacity planning', 'Data-driven decisions', 'Transparent, explainable forecasts', 'Better service levels at peak times'],
      tracks: ['data', 'gov'], tags: ['data', 'gov', 'automation'],
      questions: ['How does AI forecasting work?', 'What is the Data & Analytics for Impact track?', 'Which session covers data and analytics?'] }
  ],

  /* Running order of the day. `time` is the local start time used when SCHEDULE_MODE=fixed;
     in SCHEDULE_MODE=relative (demo) times are generated around "now" so a session is always live. */
  sessions: [
    { id: 's-keynote', time: '10:00', title: 'Opening Keynote: The Agentic Government Vision', type: 'Keynote', zone: 'main', host: 'GDRFA Leadership Office', mins: 45,
      keywords: ['keynote', 'opening', 'vision'], tags: ['gov', 'agentic', 'future'], track: 'gov', demo: 'radar',
      desc: 'An opening look at how agentic AI could shape the next generation of residency and travel services — proactive, personalised and trusted.',
      agenda: ['Why “agentic” matters for public services', 'Principles: human oversight, privacy, transparency', 'What visitors can explore at the booth today'] },
    { id: 's-public', time: '11:00', title: 'Agentic AI for Public Services', type: 'Talk', zone: 'main', host: 'AI Innovation Team', mins: 45,
      keywords: ['public services', 'agentic ai for public'], tags: ['agentic', 'gov', 'automation'], track: 'agentic', demo: 'knowledge',
      desc: 'How teams of AI agents can assist with research, pre-checks and follow-ups — and where people must stay in the loop.',
      agenda: ['From chatbots to agents: what changes', 'Illustrative walkthrough: a knowledge assistant', 'Guardrails, evaluation and accountability'] },
    { id: 's-identity', time: '12:00', title: 'AI Identity & Border Experience', type: 'Showcase', zone: 'b', host: 'Smart Travel Programme', mins: 45,
      keywords: ['ai identity', 'identity & border', 'identity session'], tags: ['gov', 'cyber', 'data'], track: 'gov', demo: 'border',
      desc: 'A guided look at concepts for seamless, privacy-conscious travel using digital identity, biometrics and risk analytics.',
      agenda: ['The traveller journey, reimagined', 'Consent, privacy and security by design', 'Live Q&A at the Smart Travel zone'] },
    { id: 's-firstagent', time: '13:00', title: 'Building Your First AI Agent', type: 'Workshop', zone: 'd', host: 'Innovation Studio Coaches', mins: 45, seats: 12,
      keywords: ['first agent', 'first ai agent', 'build', 'building', 'own ai agent'], tags: ['agentic', 'genai', 'automation'], track: 'agentic', demo: 'studio',
      desc: 'A hands-on, no-code workshop: design a simple agent, give it tools and guardrails, and test it on a real-world scenario.',
      agenda: ['Agent anatomy: goal, tools, memory', 'Build a FAQ agent in 20 minutes', 'Test, break and improve it'] },
    { id: 's-future', time: '14:00', title: 'Future of Government Innovation', type: 'Panel', zone: 'main', host: 'Innovation & Foresight Panel', mins: 45,
      keywords: ['future of government', 'innovation panel', 'panel'], tags: ['future', 'gov', 'agentic'], track: 'emerging', demo: 'studio',
      desc: 'A panel discussion on the technologies, skills and operating models that will define government services by 2030.',
      agenda: ['Signals on the horizon', 'Skills for an AI-native workforce', 'Audience questions'] },
    { id: 's-trust', time: '15:00', title: 'Trust by Design: Securing AI Agents', type: 'Talk', zone: 'main', host: 'Cyber & AI Assurance Team', mins: 45,
      keywords: ['trust', 'securing', 'security', 'secure'], tags: ['cyber', 'agentic'], track: 'cyber', demo: 'knowledge',
      desc: 'Prompt injection, data leakage and deepfakes: practical patterns for keeping AI agents safe and accountable.',
      agenda: ['The AI threat landscape', 'Guardrails and red-teaming', 'A secure-by-design checklist'] },
    { id: 's-data', time: '16:00', title: 'Data to Decisions: Forecasting Service Demand', type: 'Showcase', zone: 'c', host: 'Data & Analytics Team', mins: 45,
      keywords: ['data to decisions', 'forecasting', 'demand', 'data and analytics'], tags: ['data', 'gov', 'automation'], track: 'data', demo: 'analytics',
      desc: 'An illustrative look at how forecasting and simulation can help plan for peaks — using synthetic data.',
      agenda: ['Signals that predict demand', 'What-if staffing simulation', 'Explaining forecasts to decision-makers'] },
    { id: 's-cx', time: '17:00', title: 'Designing Human-Centred AI Conversations', type: 'Workshop', zone: 'd', host: 'Customer Experience Lab', mins: 45, seats: 16,
      keywords: ['conversation', 'conversations', 'human-centred', 'human centred'], tags: ['cx', 'genai', 'gov'], track: 'cx', demo: 'automation',
      desc: 'Write AI conversations that are clear, inclusive and multilingual, and know when to hand over to a person.',
      agenda: ['Principles of helpful AI conversations', 'Redesign a real FAQ', 'Escalation and empathy'] }
  ],

  news: [
    { id: 'n1', cat: 'agentic', featured: true, title: 'Agentic AI moves from pilots to production in public services', days: 0, mins: 4, track: 'agentic',
      summary: 'Across the public sector, AI agents that can plan multi-step tasks, use tools and hand off to people are moving beyond experiments. The focus is shifting from “can it work?” to “how do we govern it at scale?”.',
      points: ['Agents are being scoped to narrow, well-governed tasks first', 'Human approval remains the default for consequential decisions', 'Evaluation and audit trails are becoming procurement requirements'] },
    { id: 'n2', cat: 'agentic', title: 'Teams of agents: why multi-agent orchestration is the new design pattern', days: 1, mins: 5, track: 'agentic',
      summary: 'Instead of one large assistant, designers increasingly split work across specialised agents — retrieval, reasoning, checking — coordinated by an orchestrator.',
      points: ['Specialised agents are easier to test and explain', 'An orchestrator manages hand-offs and escalation', 'Clear roles make guardrails simpler to enforce'] },
    { id: 'n3', cat: 'gov', title: 'Proactive government: life-event services powered by AI', days: 1, mins: 4, track: 'gov',
      summary: 'Governments are exploring services that start before the customer asks — triggered by life events such as a new job, a move or a family milestone, always with consent.',
      points: ['Consent and transparency are prerequisites', 'Fewer forms, fewer visits, fewer repeated questions', 'Success is measured in customer time saved'] },
    { id: 'n4', cat: 'gov', title: 'AI-assisted document checks: what changes for applicants and staff', days: 2, mins: 3, track: 'gov',
      summary: 'Document AI can pre-validate uploads and explain what is missing in plain language, letting staff concentrate on cases that genuinely need judgement.',
      points: ['Instant feedback reduces incomplete submissions', 'Staff keep final approval', 'Plain-language explanations build trust'] },
    { id: 'n5', cat: 'research', title: 'New evaluation methods aim to make AI agents more reliable', days: 3, mins: 6, track: 'agentic',
      summary: 'Research groups are developing benchmarks that test whether agents complete real tasks safely — not just whether they answer questions correctly.',
      points: ['Task-completion benchmarks complement Q&A tests', 'Safety checks look for unintended actions', 'Continuous evaluation after deployment is recommended'] },
    { id: 'n6', cat: 'research', title: 'Round-up: human-in-the-loop design and trust in AI services', days: 4, mins: 5, track: 'cx',
      summary: 'A synthesis of recent studies suggests people trust AI services more when they can see how a decision was reached and can easily reach a human.',
      points: ['Explanations matter more than raw accuracy claims', 'Easy escalation increases satisfaction', 'Tone and language choice affect perceived fairness'] },
    { id: 'n7', cat: 'emerging', title: 'Digital twins are becoming everyday planning tools for smart cities', days: 2, mins: 4, track: 'emerging',
      summary: 'City-scale digital twins let planners simulate traffic, events and services before changing anything in the real world.',
      points: ['Simulation reduces costly trial-and-error', 'AI agents can explore thousands of scenarios', 'Data sharing agreements are the main hurdle'] },
    { id: 'n8', cat: 'emerging', title: 'Small, efficient models bring AI to the edge', days: 5, mins: 3, track: 'emerging',
      summary: 'Compact models running on local devices promise faster responses and better privacy, because data does not need to leave the device.',
      points: ['On-device AI reduces latency', 'Privacy improves when data stays local', 'Useful for kiosks, vehicles and field operations'] },
    { id: 'n9', cat: 'gov', title: 'Responsible AI frameworks: what public-sector leaders are prioritising', days: 6, mins: 5, track: 'gov',
      summary: 'Leaders are converging on a common set of priorities: accountability, transparency, privacy, fairness and the ability to switch AI off safely.',
      points: ['Named accountability for every AI system', 'Impact assessments before deployment', 'Clear routes for complaints and appeal'] },
    { id: 'n10', cat: 'research', title: 'Securing AI agents: prompt injection moves up the risk register', days: 3, mins: 4, track: 'cyber',
      summary: 'As agents gain access to tools and data, hidden instructions inside documents or web pages become a significant security concern.',
      points: ['Treat retrieved content as untrusted input', 'Limit agent permissions to the task at hand', 'Log and review tool use'] },
    { id: 'n11', cat: 'events', title: 'Visitor guide: exploring Agentic AI at GITEX 2026', days: 0, mins: 3, track: 'agentic',
      summary: 'A short Cleared for Takeoff guide to getting the most from the GDRFA booth: start with a demo, join a session, then build your personal journey.',
      points: ['Begin at the Experience Wall (Zone C)', 'Join a hands-on workshop in Zone D', 'Collect your Agentic AI Passport before you leave'] },
    { id: 'n12', cat: 'events', title: 'Booth programme: hands-on agent-building workshops', days: 0, mins: 2, track: 'agentic',
      summary: 'Short, no-code workshops run throughout the day at the Innovation Studio. Seats are limited — check the Live Sessions screen for times.',
      points: ['No coding experience needed', 'Small groups for hands-on time', 'Take your agent design home as a canvas'] },
    { id: 'n13', cat: 'agentic', title: 'From chatbots to agents: what changes for customer experience', days: 2, mins: 4, track: 'cx',
      summary: 'Agents can complete tasks rather than only answering questions, which raises the bar for transparency, consent and graceful hand-offs to people.',
      points: ['Customers should always know when they are talking to AI', 'Agents should confirm before acting', 'Hand-off to a person must be one step away'] }
  ],
  newsCats: [
    { id: 'all', label: 'All' }, { id: 'agentic', label: 'Agentic AI', icon: 'agent' }, { id: 'gov', label: 'Government AI', icon: 'gov' },
    { id: 'research', label: 'Research & Publications', icon: 'layers' }, { id: 'emerging', label: 'Emerging Tech', icon: 'rocket' }, { id: 'events', label: 'Events & Conferences', icon: 'calendar' }
  ],

  /* Deterministic journey rules */
  rules: {
    interestToTrack: {
      agentic: { agentic: 3, emerging: 1 }, genai: { agentic: 2, cx: 1, emerging: 1 }, gov: { gov: 3, cx: 1 }, cyber: { cyber: 3 },
      cx: { cx: 3, gov: 1 }, data: { data: 3, gov: 1 }, automation: { agentic: 2, gov: 1, data: 1 }, future: { emerging: 3, agentic: 1 }
    },
    roleBoost: { gov: { gov: 2 }, tech: { agentic: 1, cyber: 1, data: 1 }, student: { agentic: 1, emerging: 1 }, leader: { emerging: 1, cx: 1, gov: 1 }, other: { agentic: 1 } },
    stageExperience: { discover: 'demo', learn: 'session', practice: 'demo', innovate: 'session' },
    nextSteps: {
      gov: { discover: 'Visit the {demo} demo and note one process in your department it could simplify.', learn: 'Join “{session}” and capture two ideas to share with your team.', practice: 'Apply the {course} to one real service journey this month.', innovate: 'Submit one AI idea to your entity’s innovation programme using the AI Use-Case Canvas.' },
      tech: { discover: 'Ask the {demo} team how the architecture keeps humans in control.', learn: 'Attend “{session}” and benchmark the approach against your current stack.', practice: 'Complete the {course} and publish a short internal tech note.', innovate: 'Prototype a 30-day proof of concept in {track}.' },
      student: { discover: 'Explore the {demo} demo and write down three questions to research.', learn: 'Attend “{session}” and connect with one speaker or mentor.', practice: 'Turn the {course} into a portfolio project.', innovate: 'Enter a student innovation challenge with an idea from {track}.' },
      leader: { discover: 'See the {demo} demo and identify one outcome that matters to your customers.', learn: 'Attend “{session}” with a focus on value, risk and governance.', practice: 'Ask your team to run the {course} on a priority process.', innovate: 'Sponsor a 90-day AI pilot in {track} with clear success measures.' },
      other: { discover: 'Start with the {demo} demo to see AI in action.', learn: 'Join “{session}” for a practical introduction.', practice: 'Try the {course} at your own pace.', innovate: 'Share one AI idea that could improve your community or workplace.' }
    }
  },

  avatars: [
    { id: 'orbit', name: 'Orbit', c1: '#1b6dff', c2: '#46d2ff', pattern: 'orbits' },
    { id: 'prism', name: 'Prism', c1: '#7a4dff', c2: '#46d2ff', pattern: 'tri' },
    { id: 'circuit', name: 'Circuit', c1: '#0bb39b', c2: '#7af0ff', pattern: 'circuit' },
    { id: 'aurora', name: 'Aurora', c1: '#d8b15b', c2: '#ff9a62', pattern: 'waves' },
    { id: 'pulse', name: 'Pulse', c1: '#ff4d8a', c2: '#9a6bff', pattern: 'rings' },
    { id: 'nova', name: 'Nova', c1: '#2e8bff', c2: '#f4d88f', pattern: 'hex' }
  ],

  askTopics: [
    { title: 'Agentic AI basics', icon: 'agent', qs: ['What is Agentic AI?', 'How is Agentic AI different from Generative AI?', 'What are the latest AI developments in government?'] },
    { title: 'At the booth', icon: 'pin', qs: ['What demos are available at the GDRFA booth?', 'What sessions are happening today?', 'Where is the Innovation Studio?'] },
    { title: 'Learning', icon: 'tracks', qs: ['Which learning track is right for me?', 'I am a government employee — where should I start?', 'Tell me about the Cybersecurity in the AI Era track'] },
    { title: 'Your journey', icon: 'journey', qs: ['What is the Agentic AI Passport?', 'How does Cleared for Takeoff personalise my journey?', 'Is my data stored?'] }
  ],
  defaultSuggestions: ['What are the latest AI developments in government?', 'What demos are available at the GDRFA booth?', 'What is Agentic AI?', 'Which learning track is right for me?', 'What sessions are happening today?']
  };
});
