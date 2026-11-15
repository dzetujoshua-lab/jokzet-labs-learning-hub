import { mod, type ProgrammeSpec } from "./types";

/**
 * Cost rule: every exercise must be completable on free tiers, local open-source models or provided test keys, and every module
 * that calls a paid API states the expected cost cap. Learners never put keys in submitted code (the platform rejects secrets).
 */
export const AI: ProgrammeSpec = {
  code: "ai",
  name: "Artificial Intelligence and Automation",
  levelOutcomes: [
    "Explain what AI can and cannot do, use AI tools responsibly, and build one simple no-code automation.",
    "Write Python automations, prompt for structured output, and train a simple machine-learning model.",
    "Build applications and workflows that call language models, connect databases and email, and use retrieval.",
    "Build reliable, secure AI applications and agents with evaluation, error handling and human approval steps.",
    "Deploy and operate a useful AI application and an automated business workflow in production with monitoring and cost control.",
  ],
  competencies: {
    "ai-concepts": "Explain what AI, machine learning and generative AI are, and what they cannot do reliably.",
    "responsible-ai-use": "Use AI tools while verifying outputs, protecting private data and crediting AI help.",
    "no-code-automation": "Build and test a simple automation with a trigger, an action and error handling.",
    "python-automation": "Automate file, data and web tasks with Python scripts.",
    "prompt-engineering": "Write prompts that give consistent, correct, structured outputs and test them.",
    "ml-basics": "Train, evaluate and explain a simple machine-learning model on a dataset.",
    "data-handling": "Load, clean and summarise data with Python.",
    "llm-integration": "Call a language-model API from code with correct parameters, parsing and error handling.",
    "n8n-workflows": "Build workflows in n8n with webhooks, branches and credentials.",
    "db-email-integration": "Connect workflows to a database and send email safely.",
    "rag": "Build a retrieval-augmented generation pipeline with chunking, embeddings and a retrieval test.",
    "ai-evaluation": "Measure an AI feature with a test set and metrics and use the results to improve it.",
    "ai-app-development": "Build a web application whose core feature uses a language model.",
    "agents-tools": "Build an agent that calls tools with validated inputs and bounded behaviour.",
    "ai-reliability": "Add retries, timeouts, fallbacks and validation so failures do not corrupt results.",
    "ai-security": "Defend against prompt injection, data leakage and key exposure.",
    "human-approval": "Design workflows where a person approves risky actions before they happen.",
    "ai-monitoring": "Log, trace and alert on AI behaviour and cost in production.",
    "cost-management": "Estimate, cap and reduce AI costs and explain the trade-offs.",
    "ai-deployment": "Deploy and operate an AI application with configuration, secrets and rollback.",
    "business-automation": "Automate a real business process end to end and measure the time or errors it saves.",
    "responsible-ai-review": "Assess an AI system for bias, privacy, safety and documentation gaps.",
  },
  modules: [
    // Level 0
    mod("AI-L0-M01", 0, "Computer and AI fundamentals", "Explain in a one-page note, with three real examples, what AI can do well, what it gets wrong, and how it differs from ordinary software.", 6, ["SH-L0-M01"], ["ai-concepts"], ["DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L0-M02", 0, "Using AI tools responsibly", "Use an AI assistant for three tasks, check each output against a trusted source, and record the errors you found and how you protected private information.", 6, ["SH-L0-M02", "AI-L0-M01"], ["responsible-ai-use"], ["DOCUMENT", "SCREENSHOT"], "AI_AUTOMATION"),
    mod("AI-L0-M03", 0, "Your first automation", "Build a no-code automation (for example a form response that creates a spreadsheet row and a notification), test it with five inputs, and show what happens when one fails.", 8, ["AI-L0-M02"], ["no-code-automation"], ["SCREENSHOT", "VIDEO", "DOCUMENT"], "AI_AUTOMATION"),
    // Level 1
    mod("AI-L1-M01", 1, "Python for automation", "Write scripts that rename files, read a spreadsheet and fetch a web page, each with tests and clear error messages.", 20, ["SH-L1-M06", "SH-L1-M05"], ["python-automation"], ["REPOSITORY"], "AI_AUTOMATION"),
    mod("AI-L1-M02", 1, "Prompt engineering and structured outputs", "Write prompts that return valid JSON for ten different inputs, measure how often they are correct, and improve the pass rate with documented changes.", 14, ["AI-L0-M02", "SH-L1-M06"], ["prompt-engineering"], ["DOCUMENT", "REPOSITORY"], "AI_AUTOMATION"),
    mod("AI-L1-M03", 1, "Data handling with Python", "Load a dataset, clean it, and produce a summary with three charts and one finding that a reader could act on.", 16, ["SH-L1-M06"], ["data-handling"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L1-M04", 1, "Machine-learning fundamentals", "Train and evaluate a simple classifier on a public dataset with a train and test split, and explain its errors and one way it could mislead.", 20, ["AI-L1-M03"], ["ml-basics"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    // Level 2
    mod("AI-L2-M01", 2, "Language-model APIs", "Build a command-line or web tool that calls a language-model API with parameters, parsed output, rate-limit handling and a hard cost cap.", 20, ["SH-L2-M01", "AI-L1-M02"], ["llm-integration", "ai-security"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L2-M02", 2, "Workflow automation with n8n and webhooks", "Build an n8n workflow triggered by a webhook that branches on conditions, retries failed steps and reports errors to you.", 18, ["AI-L0-M03", "SH-L2-M01"], ["n8n-workflows"], ["SCREENSHOT", "VIDEO", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L2-M03", 2, "Database and email integrations", "Extend a workflow to read and write a database and send a templated email, with credentials stored safely and a test that avoids emailing real people.", 16, ["AI-L2-M02"], ["db-email-integration"], ["SCREENSHOT", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L2-M04", 2, "Retrieval-augmented generation fundamentals", "Build a question-answering tool over your own documents with chunking, embeddings and retrieval, and show five questions where retrieval found or missed the right passage.", 24, ["AI-L2-M01"], ["rag"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L2-M05", 2, "Evaluating AI outputs", "Create a test set of at least thirty cases for one AI feature, measure accuracy, and make and record two changes that improve the result.", 16, ["AI-L2-M01"], ["ai-evaluation"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L2-M06", 2, "Checkpoint project: a tested document assistant", "Build a working assistant that answers questions from a set of your own documents, with a thirty-case evaluation, a cost cap and a README that lets someone else run it.", 24, ["AI-L2-M04", "AI-L2-M05"], ["rag", "ai-evaluation", "llm-integration"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION", true),
    // Level 3
    mod("AI-L3-M01", 3, "AI application development", "Build a web application whose core feature uses a language model, with accounts, saved results, input validation and a clear display of AI limitations.", 36, ["AI-L2-M01", "SH-L2-M01"], ["ai-app-development"], ["LIVE_SITE", "REPOSITORY"], "AI_AUTOMATION"),
    mod("AI-L3-M02", 3, "AI agents and tool calling", "Build an agent with at least three tools, validated inputs and a step limit, and show a trace of a successful run and a blocked unsafe request.", 28, ["AI-L2-M04", "AI-L2-M05"], ["agents-tools"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L3-M03", 3, "Reliability and error handling", "Add timeouts, retries with backoff, output validation and a fallback to your application, and show it surviving three injected failures without wrong output.", 20, ["AI-L3-M01"], ["ai-reliability"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L3-M04", 3, "Security for AI applications", "Test your own application against ten prompt-injection and data-leak attempts in a lab, fix what fails, and show that keys and personal data never reach prompts or logs.", 24, ["AI-L3-M01"], ["ai-security"], ["REPOSITORY", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L3-M05", 3, "Human approval and monitoring", "Add an approval step before any action with side effects, and add logs, a dashboard and an alert for failures and unusual cost.", 20, ["AI-L3-M02"], ["human-approval", "ai-monitoring"], ["REPOSITORY", "SCREENSHOT", "DOCUMENT"], "AI_AUTOMATION"),
    mod("AI-L3-M06", 3, "Cost management", "Measure the cost per request for your application, reduce it by at least a quarter with a documented change, and set a budget alert.", 12, ["AI-L3-M01"], ["cost-management"], ["DOCUMENT", "SCREENSHOT"], "AI_AUTOMATION"),
    // Level 4
    mod("AI-L4-M01", 4, "Capstone: production AI application", "Deliver a working AI application used by real people, with evaluation results, security tests, monitoring and cost controls, and a post-launch review.", 80, ["AI-L3-M03", "AI-L3-M04", "AI-L3-M05", "AI-L3-M06"], ["ai-deployment", "ai-app-development"], ["LIVE_SITE", "REPOSITORY", "DOCUMENT", "VIDEO"], "AI_AUTOMATION", true),
    mod("AI-L4-M02", 4, "Capstone: automated business workflow", "Automate a real business process end to end with approvals, error handling and reporting, and show measured time saved or errors avoided over two weeks.", 60, ["AI-L3-M05", "AI-L2-M03"], ["business-automation"], ["VIDEO", "DOCUMENT", "SCREENSHOT"], "AI_AUTOMATION", true),
    mod("AI-L4-M03", 4, "Deployment and operations", "Deploy an AI service with secrets in configuration, a staging copy, automated checks and a rollback you have actually practised.", 24, ["AI-L3-M05", "SH-L1-M07"], ["ai-deployment"], ["LIVE_SITE", "REPOSITORY"], "AI_AUTOMATION"),
    mod("AI-L4-M04", 4, "Responsible AI review", "Review an AI system (your own or a provided case) for bias, privacy, safety and documentation, and deliver a report with five prioritised fixes.", 16, ["AI-L3-M04"], ["responsible-ai-review"], ["DOCUMENT"], "AI_AUTOMATION"),
  ],
};
