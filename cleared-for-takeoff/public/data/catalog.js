/* =====================================================================
   CLEARED FOR TAKEOFF — COURSE CATALOGUE
   The only courses the recommender (Claude or the offline rules) may pick.
   Every entry is a real, publicly available course or framework. Links,
   prices and durations change: re-check each entry before an event and
   update `reviewedOn`.

   Fields
     id         stable identifier used by the recommender — do not rename
     ref        short stable code used in passport QR links — never reuse or
                renumber; give new courses the next free number
     level      who it suits at the booth: beginner | intermediate | advanced
     tracks     learning-track ids it belongs to (see content.js)
     interests  interest ids it serves
     stages     journey stages it fits: discover | learn | practice | innovate
     cost       free | membership | varies   (shown as a hint, not a price)
     hours      approximate effort in hours (the provider's own estimate where it gives one)
     category   learning category shown on the course card
     providerLevel  (optional) the provider's own level label, shown beside `level` when the
                provider states one; null when the provider states no level. `level` stays the
                kiosk's fit for matching visitors, and takes the provider's prerequisites into account
     verifiedOn (optional) date the link, free access and details were last checked on the provider's site
   ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CFT_CATALOG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    reviewedOn: '2026-11-02',
    courses: [
      // ---------- Agentic AI ----------
      { id: 'anthropic-ai-fluency', ref: 'c1', title: 'AI Fluency: Framework & Foundations', provider: 'Anthropic Academy', url: 'https://anthropic.skilljar.com/ai-fluency-framework-foundations',
        level: 'beginner', format: 'Self-paced course', hours: 3, cost: 'free',
        category: 'AI Literacy', tracks: ['agentic', 'gov', 'cx', 'emerging'], interests: ['agentic', 'genai', 'gov', 'cx'], stages: ['discover', 'learn'],
        summary: 'How to work with AI effectively, efficiently, ethically and safely — a practical framework for everyday collaboration with AI systems.' },
      { id: 'anthropic-claude-101', ref: 'c2', title: 'Claude 101', provider: 'Anthropic Academy', url: 'https://anthropic.skilljar.com/claude-101',
        level: 'beginner', format: 'Self-paced course', hours: 1, cost: 'free',
        category: 'Generative AI', tracks: ['agentic', 'cx'], interests: ['genai', 'agentic', 'automation', 'cx'], stages: ['discover', 'practice'],
        summary: 'Hands-on introduction to using an AI assistant for everyday work tasks, and where to go next.' },
      { id: 'anthropic-claude-api', ref: 'c3', title: 'Building with the Claude API', provider: 'Anthropic Academy', url: 'https://anthropic.skilljar.com/claude-with-the-anthropic-api',
        level: 'intermediate', format: 'Self-paced course', hours: 8, cost: 'free',
        category: 'Agentic AI', tracks: ['agentic', 'cx', 'data'], interests: ['agentic', 'genai', 'automation', 'cx'], stages: ['learn', 'practice'],
        summary: 'Developer course covering prompting, tool use, retrieval and agent patterns with the Claude API.' },
      { id: 'dlai-agentic-ai', ref: 'c4', title: 'Agentic AI', provider: 'DeepLearning.AI', url: 'https://www.deeplearning.ai/courses/agentic-ai',
        level: 'intermediate', format: 'Course (5 modules)', hours: 15, cost: 'membership',
        category: 'Agentic AI', tracks: ['agentic', 'gov'], interests: ['agentic', 'automation', 'genai'], stages: ['learn', 'practice'],
        summary: 'Andrew Ng’s course on the four agentic design patterns: reflection, tool use, planning and multi-agent workflows.' },
      { id: 'hf-mcp-course', ref: 'c5', title: 'Model Context Protocol (MCP) Course', provider: 'Hugging Face × Anthropic', url: 'https://huggingface.co/learn/mcp-course',
        level: 'intermediate', format: 'Self-paced course', hours: 10, cost: 'free',
        category: 'Agentic AI', tracks: ['agentic', 'emerging', 'data'], interests: ['agentic', 'automation', 'future'], stages: ['learn', 'practice'],
        summary: 'Theory and practice of connecting AI agents to tools and data with the Model Context Protocol.' },
      { id: 'dlai-crewai', ref: 'c6', title: 'Multi AI Agent Systems with crewAI', provider: 'DeepLearning.AI × crewAI', url: 'https://www.deeplearning.ai/short-courses/multi-ai-agent-systems-with-crewai',
        level: 'intermediate', format: 'Short course', hours: 1, cost: 'free',
        category: 'Agentic AI', tracks: ['agentic', 'cx'], interests: ['agentic', 'automation', 'cx'], stages: ['practice'],
        summary: 'Build teams of role-based agents that collaborate on business tasks such as customer support.' },
      { id: 'dlai-langgraph', ref: 'c7', title: 'AI Agents in LangGraph', provider: 'DeepLearning.AI × LangChain', url: 'https://www.deeplearning.ai/short-courses/ai-agents-in-langgraph',
        level: 'advanced', format: 'Short course', hours: 2, cost: 'free',
        category: 'Agentic AI', tracks: ['agentic', 'cx'], interests: ['agentic', 'automation'], stages: ['practice', 'innovate'],
        summary: 'Build controllable agents with persistence, human-in-the-loop checkpoints and agentic search (Python).' },
      { id: 'hf-agents-course', ref: 'c8', title: 'AI Agents Course', provider: 'Hugging Face', url: 'https://huggingface.co/learn/agents-course',
        level: 'advanced', format: 'Self-paced course with certificate', hours: 25, cost: 'free',
        category: 'Agentic AI', tracks: ['agentic', 'emerging'], interests: ['agentic', 'automation', 'future'], stages: ['practice', 'innovate'],
        summary: 'From agent fundamentals to building and evaluating your own agents with popular open-source frameworks.' },

      // ---------- General & leadership ----------
      { id: 'coursera-genai-everyone', ref: 'c9', title: 'Generative AI for Everyone', provider: 'DeepLearning.AI on Coursera', url: 'https://www.coursera.org/learn/generative-ai-for-everyone',
        level: 'beginner', format: 'Course (3 modules)', hours: 6, cost: 'varies',
        category: 'Generative AI', tracks: ['agentic', 'gov', 'cx', 'emerging'], interests: ['genai', 'gov', 'cx', 'future'], stages: ['discover', 'learn'],
        summary: 'What generative AI can and cannot do, how to plan a generative AI project, and its impact on business and society.' },
      { id: 'coursera-ai-everyone', ref: 'c10', title: 'AI For Everyone', provider: 'DeepLearning.AI on Coursera', url: 'https://www.coursera.org/learn/ai-for-everyone',
        level: 'beginner', format: 'Course (4 modules)', hours: 6, cost: 'varies',
        category: 'AI Literacy', tracks: ['gov', 'data', 'emerging'], interests: ['gov', 'data', 'future', 'automation'], stages: ['discover', 'innovate'],
        summary: 'A non-technical course on AI strategy: what AI can do, how to spot opportunities and how to lead AI projects.' },
      { id: 'helsinki-elements-of-ai', ref: 'c11', title: 'Elements of AI', provider: 'University of Helsinki & MinnaLearn', url: 'https://www.elementsofai.com/',
        level: 'beginner', format: 'Self-paced course', hours: 30, cost: 'free',
        category: 'AI Literacy', tracks: ['gov', 'data', 'emerging'], interests: ['gov', 'data', 'future'], stages: ['discover', 'learn'],
        summary: 'A widely used free introduction to what AI is, what it can and cannot do, and how it affects society.' },

      // ---------- Government ----------
      { id: 'apolitical-gov-ai-campus', ref: 'c12', title: 'Government AI Campus', provider: 'Apolitical', url: 'https://apolitical.co/learning-hub/government-ai-campus-public/',
        level: 'beginner', format: 'Courses for public servants', hours: 2, cost: 'free',
        category: 'Digital Government', tracks: ['gov'], interests: ['gov', 'genai'], stages: ['discover', 'learn'],
        summary: 'Free AI courses and masterclasses designed specifically for public servants and policymakers.' },
      { id: 'helsinki-ethics-of-ai', ref: 'c13', title: 'Ethics of AI', provider: 'University of Helsinki', url: 'https://ethics-of-ai.mooc.fi/',
        level: 'intermediate', format: 'Self-paced course (7 chapters)', hours: 15, cost: 'free',
        category: 'Responsible AI', tracks: ['gov', 'cyber', 'cx'], interests: ['gov', 'cyber', 'cx'], stages: ['learn', 'innovate'],
        summary: 'Accountability, transparency, fairness and human rights in AI — developed with city governments for public-sector use.' },
      { id: 'mslearn-copilot-studio', ref: 'c14', title: 'Create agents in Microsoft Copilot Studio', provider: 'Microsoft Learn', url: 'https://learn.microsoft.com/training/paths/create-extend-custom-copilots-microsoft-copilot-studio',
        level: 'intermediate', format: 'Learning path with guided project', hours: 4, cost: 'free',
        category: 'Intelligent Automation', tracks: ['cx', 'gov', 'agentic'], interests: ['cx', 'automation', 'agentic', 'gov'], stages: ['practice'],
        summary: 'Low-code path for building and publishing service agents, with a hands-on guided project.' },
      { id: 'nist-ai-rmf', ref: 'c15', title: 'NIST AI Risk Management Framework (AI RMF)', provider: 'NIST', url: 'https://www.nist.gov/itl/ai-risk-management-framework',
        level: 'advanced', format: 'Framework & playbook', hours: 4, cost: 'free',
        category: 'AI Governance', tracks: ['gov', 'cyber'], interests: ['gov', 'cyber'], stages: ['innovate'],
        summary: 'The reference framework for governing, mapping, measuring and managing AI risk across an organisation.' },

      // ---------- Cybersecurity ----------
      { id: 'cisco-intro-cybersecurity', ref: 'c16', title: 'Introduction to Cybersecurity', provider: 'Cisco Networking Academy', url: 'https://www.netacad.com/courses/cybersecurity/introduction-cybersecurity',
        level: 'beginner', format: 'Self-paced course with badge', hours: 6, cost: 'free',
        category: 'Cybersecurity', tracks: ['cyber'], interests: ['cyber'], stages: ['discover', 'learn'],
        summary: 'No-experience-needed introduction to threats, attacks and how to protect yourself and your organisation.' },
      { id: 'coursera-responsible-ai', ref: 'c17', title: 'Introduction to Responsible AI', provider: 'Google Cloud on Coursera', url: 'https://www.coursera.org/learn/introduction-to-responsible-ai',
        level: 'beginner', format: 'Micro-course', hours: 1, cost: 'varies',
        category: 'Responsible AI', tracks: ['cyber', 'gov', 'cx'], interests: ['cyber', 'gov', 'genai'], stages: ['discover'],
        summary: 'Why responsible AI matters and how AI principles are put into practice in real products.' },
      { id: 'dlai-red-teaming', ref: 'c18', title: 'Red Teaming LLM Applications', provider: 'DeepLearning.AI × Giskard', url: 'https://www.deeplearning.ai/short-courses/red-teaming-llm-applications',
        level: 'intermediate', format: 'Short course', hours: 1.5, cost: 'free',
        category: 'AI Security', tracks: ['cyber', 'agentic'], interests: ['cyber', 'genai', 'agentic'], stages: ['learn', 'practice'],
        summary: 'Apply red-teaming techniques — including prompt injection — to find vulnerabilities in LLM applications.' },
      { id: 'dlai-quality-safety', ref: 'c19', title: 'Quality and Safety for LLM Applications', provider: 'DeepLearning.AI × WhyLabs', url: 'https://www.deeplearning.ai/short-courses/quality-safety-llm-applications',
        level: 'intermediate', format: 'Short course', hours: 2, cost: 'free',
        category: 'AI Security', tracks: ['cyber', 'cx', 'data'], interests: ['cyber', 'cx', 'data', 'genai'], stages: ['practice'],
        summary: 'Monitor LLM apps for hallucinations, jailbreaks and data leakage, and build a safety monitoring system.' },
      { id: 'owasp-llm-top10', ref: 'c20', title: 'OWASP GenAI LLM Top 10 (2026)', provider: 'OWASP GenAI Security Project', url: 'https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/',
        level: 'advanced', format: 'Security guide', hours: 3, cost: 'free',
        category: 'AI Security', tracks: ['cyber', 'agentic'], interests: ['cyber', 'agentic'], stages: ['learn', 'innovate'],
        summary: 'The community reference for the most critical security risks in LLM and agentic applications, with mitigations.' },

      // ---------- Customer experience ----------
      { id: 'anthropic-prompt-tutorial', ref: 'c21', title: 'Prompt Engineering Interactive Tutorial', provider: 'Anthropic (GitHub)', url: 'https://github.com/anthropics/prompt-eng-interactive-tutorial',
        level: 'intermediate', format: 'Interactive notebooks', hours: 5, cost: 'free',
        category: 'Generative AI', tracks: ['cx', 'agentic'], interests: ['genai', 'cx'], stages: ['learn', 'practice'],
        summary: 'Step-by-step exercises for writing clear, reliable prompts — the foundation of good AI conversations.' },

      // ---------- Data & analytics ----------
      { id: 'kaggle-intro-ml', ref: 'c22', title: 'Intro to Machine Learning', provider: 'Kaggle Learn', url: 'https://www.kaggle.com/learn/intro-to-machine-learning',
        level: 'beginner', format: 'Hands-on micro-course', hours: 3, cost: 'free',
        category: 'Machine Learning', tracks: ['data'], interests: ['data'], stages: ['discover', 'learn'],
        summary: 'Explore data, build your first models and validate the results — entirely in the browser.' },
      { id: 'kaggle-data-viz', ref: 'c23', title: 'Data Visualization', provider: 'Kaggle Learn', url: 'https://www.kaggle.com/learn/data-visualization',
        level: 'beginner', format: 'Hands-on micro-course', hours: 4, cost: 'free',
        category: 'Data Visualization', tracks: ['data', 'cx'], interests: ['data'], stages: ['practice'],
        summary: 'Turn data into clear charts that support decisions, ending with your own visualisation project.' },
      { id: 'kaggle-time-series', ref: 'c24', title: 'Time Series', provider: 'Kaggle Learn', url: 'https://www.kaggle.com/learn/time-series',
        level: 'intermediate', format: 'Hands-on micro-course', hours: 5, cost: 'free',
        category: 'Predictive Analytics', tracks: ['data', 'gov'], interests: ['data', 'automation'], stages: ['learn', 'practice'],
        summary: 'Forecasting with machine learning: trends, seasonality and lags — the basis of service-demand planning.' },
      { id: 'dlai-ml-specialization', ref: 'c25', title: 'Machine Learning Specialization', provider: 'DeepLearning.AI & Stanford Online', url: 'https://www.deeplearning.ai/courses/machine-learning-specialization',
        level: 'intermediate', format: 'Three-course specialization', hours: 90, cost: 'varies',
        category: 'Machine Learning', tracks: ['data', 'emerging'], interests: ['data', 'future'], stages: ['learn'],
        summary: 'Andrew Ng’s foundational machine learning programme: supervised, unsupervised and reinforcement learning.' },
      { id: 'kaggle-ml-explainability', ref: 'c26', title: 'Machine Learning Explainability', provider: 'Kaggle Learn', url: 'https://www.kaggle.com/learn/machine-learning-explainability',
        level: 'advanced', format: 'Hands-on micro-course', hours: 4, cost: 'free',
        category: 'Responsible AI', tracks: ['data', 'gov', 'cyber'], interests: ['data', 'gov'], stages: ['practice', 'innovate'],
        summary: 'Extract human-understandable insights from any model — essential for transparent public-sector AI.' },

      // ---------- Emerging technology ----------
      { id: 'coursera-futures-thinking', ref: 'c27', title: 'Futures Thinking Specialization', provider: 'Institute for the Future on Coursera', url: 'https://www.coursera.org/specializations/futures-thinking',
        level: 'beginner', format: 'Five-course specialization', hours: 40, cost: 'varies',
        category: 'Foresight', tracks: ['emerging', 'gov'], interests: ['future', 'gov'], stages: ['discover', 'learn', 'innovate'],
        summary: 'Foresight skills from IFTF: spot signals of change, imagine scenarios and turn foresight into action.' },
      { id: 'coursera-digital-twins', ref: 'c28', title: 'Digital Twins', provider: 'University of Michigan on Coursera', url: 'https://www.coursera.org/learn/digital-twins',
        level: 'intermediate', format: 'Course', hours: 10, cost: 'varies',
        category: 'Emerging Technology', tracks: ['emerging', 'data'], interests: ['future', 'data'], stages: ['learn', 'practice'],
        summary: 'How digital twins are designed and used to simulate and optimise real-world systems.' },
      { id: 'ibm-quantum-basics', ref: 'c29', title: 'Basics of Quantum Information', provider: 'IBM Quantum Learning', url: 'https://quantum.cloud.ibm.com/learning/courses/basics-of-quantum-information',
        level: 'advanced', format: 'Self-paced course with badge', hours: 12, cost: 'free',
        category: 'Quantum Computing', tracks: ['emerging'], interests: ['future'], stages: ['learn', 'innovate'],
        summary: 'John Watrous’s introduction to quantum information — the mathematics behind quantum computing.' },
      { id: 'google-intro-genai', ref: 'c30', title: 'Introduction to Generative AI', provider: 'Google Skills', url: 'https://www.skills.google/course_templates/536',
        level: 'beginner', format: 'Micro-course', hours: 1, cost: 'free',
        category: 'Generative AI', tracks: ['emerging', 'agentic', 'cx'], interests: ['genai', 'future'], stages: ['discover'],
        summary: 'A 45-minute primer on what generative AI is, how it works and how it differs from traditional machine learning.' },
      // ---------- Additional free courses: SAS Learning ----------
      // Checked on learn.sas.com on 2026-11-22: each is listed under the catalogue's "Price: Free" filter and/or as a
      // "FREE COURSE" on sas.com/en_us/training/offers/free-training.html, and opens without signing in (sign in with a
      // free SAS profile to record progress). Durations are SAS's stated "Duration"; levels are SAS's catalogue levels.
      // Placed last so that, when courses score equally, the existing courses keep their place.
      { id: 'sas-ai-literacy-genai-agentic', ref: 'c31', title: 'AI Literacy Series: Generative AI and Agentic AI', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=6729',
        level: 'intermediate', providerLevel: 'Beginner', format: 'Self-paced e-learning with hands-on practice', hours: 7, cost: 'free', category: 'Generative AI', verifiedOn: '2026-11-22',
        tracks: ['agentic', 'emerging'], interests: ['genai', 'agentic', 'future'], stages: ['learn'],
        summary: 'The main types of generative AI and agentic AI, the algorithms behind them, and how SAS applies them; new lessons are added as the field develops. Assumes some statistics and machine-learning background. Also available in Arabic.' },
      { id: 'sas-agentic-ai-governance', ref: 'c32', title: 'Agentic AI – Concepts and Governance', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=9049',
        level: 'beginner', providerLevel: 'Beginner', format: 'Self-paced e-learning with hands-on practice', hours: 7, cost: 'free', category: 'AI Governance', verifiedOn: '2026-11-22',
        tracks: ['agentic', 'gov'], interests: ['agentic', 'gov', 'genai'], stages: ['discover', 'learn'],
        summary: 'What AI agents are and how they work, their components and levels of autonomy, what makes an agent enterprise-grade, the key ethical risks, and how guardrails keep agentic systems helpful. No prerequisites.' },
      { id: 'sas-agentic-ai-viya', ref: 'c33', title: 'Agentic AI – How to with SAS Viya', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=8207',
        level: 'advanced', providerLevel: null, format: 'Self-paced e-learning with hands-on practice', hours: 14, cost: 'free', category: 'Agentic AI', verifiedOn: '2026-11-22',
        tracks: ['agentic', 'data'], interests: ['agentic', 'automation'], stages: ['practice'],
        summary: 'Register, deploy, govern and monitor LLMs and agentic decision workflows, combining proprietary and open-source LLMs with deterministic models. For technical roles: expects an understanding of LLMs and some Python. Also available in Arabic.' },
      { id: 'sas-trustworthy-ai', ref: 'c34', title: 'Responsible Innovation and Trustworthy AI', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=6443',
        level: 'beginner', providerLevel: 'Beginner', format: 'Self-paced e-learning', hours: 7, cost: 'free', category: 'Responsible AI', verifiedOn: '2026-11-22',
        tracks: ['gov', 'cyber'], interests: ['gov', 'cyber', 'data'], stages: ['learn', 'innovate'],
        summary: 'Trust and responsibility across the AI and analytics life cycle: identifying unwanted bias, and applying human-centricity, inclusivity, accountability, privacy and security, robustness and transparency to real scenarios.' },
      { id: 'sas-data-literacy-essentials', ref: 'c35', title: 'Data Literacy Essentials', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=232',
        level: 'beginner', providerLevel: 'Beginner', format: 'Self-paced e-learning', hours: 3, cost: 'free', category: 'Data Literacy', verifiedOn: '2026-11-22',
        tracks: ['data', 'gov'], interests: ['data', 'gov'], stages: ['discover', 'learn'],
        summary: 'An introduction to data literacy for anyone: what data is, what it means to be data literate and why it matters, told through people who rely on data to make decisions, including a public health expert.' },
      { id: 'sas-viya-copilot-visual-analytics', ref: 'c36', title: 'Using SAS Viya Copilot in SAS Visual Analytics', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=8901',
        level: 'beginner', providerLevel: 'Beginner', format: 'Self-paced e-learning with hands-on practice', hours: 3.5, cost: 'free', category: 'Visual Analytics', verifiedOn: '2026-11-22',
        tracks: ['data'], interests: ['data', 'genai', 'automation'], stages: ['practice'],
        summary: 'Use SAS Viya Copilot in SAS Visual Analytics to write effective prompts, prepare data, and build and refine interactive reports. No SAS or programming experience needed. Also available in Arabic.' },
      { id: 'sas-modern-data-science-workbench', ref: 'c37', title: 'Modern Data Science with SAS Viya Workbench: Unified Development with SAS, Python, and R', provider: 'SAS Learning', url: 'https://learn.sas.com/course/view.php?id=7274',
        level: 'intermediate', providerLevel: 'Beginner', format: 'Self-paced e-learning with hands-on practice', hours: 7, cost: 'free', category: 'Data Science', verifiedOn: '2026-11-22',
        tracks: ['data'], interests: ['data', 'automation'], stages: ['learn', 'practice'],
        summary: 'A full data science project in SAS, Python and R: access and transform data from cloud storage, then build and compare machine-learning models to predict customer churn. Aimed at data scientists; no prior SAS or Python needed. Also available in Arabic.' }
    ]
  };
});
