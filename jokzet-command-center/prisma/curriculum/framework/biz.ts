import { mod, type ProgrammeSpec } from "./types";

/**
 * Legal and registration content is jurisdiction-specific. Modules that touch it (BIZ-L3-M04) must be reviewed by someone qualified
 * in the learner's jurisdiction before approval; the curriculum states rules as "check with the registry" and never as legal advice.
 */
export const BIZ: ProgrammeSpec = {
  code: "biz",
  name: "Business and Entrepreneurship",
  levelOutcomes: [
    "Explain how a business creates, delivers and captures value, and identify a real problem worth solving.",
    "Test a business idea with real customers and build a simple model, budget and brand.",
    "Write a business plan, market it, sell, price it and forecast its cash flow.",
    "Run a small business pilot with real customers, use analytics, and understand legal and registration requirements.",
    "Launch and grow a real venture, plan for sustainability and present it to partners or funders.",
  ],
  competencies: {
    "business-basics": "Explain revenue, costs, profit, customers and value in a real business.",
    "problem-identification": "Find and describe a real customer problem, with evidence from the people who have it.",
    "money-basics": "Calculate revenue, cost, profit and break-even for a simple business.",
    "market-research": "Size a market and compare competitors using real sources.",
    "customer-discovery": "Interview customers without leading them and learn what they actually do and pay for.",
    "value-proposition": "State who the customer is, what the problem is, and why your offer is better, in one test-ready sentence.",
    "financial-literacy": "Build a personal and a business budget and read a simple statement of income and costs.",
    "brand-marketing-basics": "Define a brand promise and choose marketing channels that fit the customer.",
    "business-planning": "Write a plan that a reader can use to decide whether to back the business.",
    "digital-marketing": "Plan, run and measure a small digital marketing campaign.",
    "sales": "Run a sales conversation, handle objections and record the pipeline.",
    "customer-service": "Handle customer complaints and requests consistently and measure satisfaction.",
    "pricing": "Set prices from costs, value and competitors and test them.",
    "cash-flow": "Forecast cash flow for twelve months and spot when cash runs short.",
    "operations-pm": "Plan work, manage a small project and set up repeatable operations.",
    "ecommerce": "Set up and run an online sales channel with payments, delivery and returns.",
    "business-analytics": "Track a few meaningful numbers and use them to make decisions.",
    "growth-retention": "Improve customer retention and choose a growth strategy with evidence.",
    "legal-awareness": "Describe the registration, tax and contract steps for a business in your jurisdiction and where to verify them.",
    "business-pilot": "Run a real small trial of a business with paying customers and report the results honestly.",
    "venture-launch": "Launch a venture with real customers, a financial model and a plan for the next twelve months.",
    "sustainability": "Plan for a business that survives: costs, people, resilience and social impact.",
    "pitching": "Present a business to partners or funders with clear numbers and a clear request.",
  },
  modules: [
    // Level 0
    mod("BIZ-L0-M01", 0, "Business fundamentals and entrepreneurial thinking", "Analyse one local business you know: who its customers are, how it earns money, its main costs, and one thing it could do better, in a two-page report with an interview.", 6, ["SH-L0-M02"], ["business-basics"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L0-M02", 0, "Finding a real problem", "Talk to five people in your community, record five real problems they have, and choose one with a written reason based on what they said.", 8, ["BIZ-L0-M01"], ["problem-identification"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L0-M03", 0, "Money basics: revenue, cost and profit", "Calculate revenue, costs, profit and break-even for a market stall or similar small business using real prices you collected.", 6, ["BIZ-L0-M01"], ["money-basics"], ["DOCUMENT"], "BUSINESS"),
    // Level 1
    mod("BIZ-L1-M01", 1, "Market research and competitor analysis", "Size a market using at least three real sources and compare five competitors on price, offer and weakness, in a table with sources named.", 14, ["BIZ-L0-M02"], ["market-research"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L1-M02", 1, "Customer discovery interviews", "Interview eight potential customers with non-leading questions, quote what they said, and show what you changed in your idea because of it.", 16, ["BIZ-L0-M02"], ["customer-discovery"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L1-M03", 1, "Value proposition and business model", "Complete a business model canvas and a one-sentence value proposition, and test the proposition with five people, recording their reactions.", 12, ["BIZ-L1-M02"], ["value-proposition"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L1-M04", 1, "Financial literacy and budgeting", "Build a personal monthly budget and a startup-cost budget for your idea, with every number sourced or marked as an assumption.", 12, ["BIZ-L0-M03"], ["financial-literacy"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L1-M05", 1, "Branding and marketing basics", "Define a brand promise, a name check and three marketing channels, and explain why each channel fits your customers.", 12, ["BIZ-L1-M03"], ["brand-marketing-basics"], ["DOCUMENT"], "BUSINESS"),
    // Level 2
    mod("BIZ-L2-M01", 2, "Business planning", "Write a twelve-page business plan with market, customer, offer, operations and finances, and have two readers state in writing whether they would back it and why.", 24, ["BIZ-L1-M03", "BIZ-L1-M04"], ["business-planning"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L2-M02", 2, "Digital marketing", "Run a small real campaign for a real or realistic offer with a budget cap, and report reach, clicks and cost per result with what you would change.", 20, ["BIZ-L1-M05"], ["digital-marketing"], ["DOCUMENT", "SCREENSHOT"], "BUSINESS"),
    mod("BIZ-L2-M03", 2, "Sales and customer service", "Role-play three sales calls and two complaint calls with feedback, and keep a simple sales pipeline for ten real or realistic prospects.", 16, ["BIZ-L1-M02"], ["sales", "customer-service"], ["VIDEO", "DOCUMENT"], "BUSINESS"),
    mod("BIZ-L2-M04", 2, "Pricing and revenue models", "Set prices for three offers using costs, value and competitors, test two price points with real people, and choose a revenue model with reasons.", 14, ["BIZ-L1-M04", "BIZ-L1-M01"], ["pricing"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L2-M05", 2, "Cash flow and financial projections", "Forecast twelve months of cash flow for your business, find the month cash runs lowest, and propose how you would cover it.", 16, ["BIZ-L1-M04"], ["cash-flow"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L2-M06", 2, "Operations and project management", "Plan a four-week project with tasks, owners, risks and a weekly review, run it, and report what slipped and why.", 16, ["SH-L2-M02"], ["operations-pm"], ["DOCUMENT"], "BUSINESS"),
    // Level 3
    mod("BIZ-L3-M01", 3, "E-commerce and business technology", "Set up an online shop or booking page with payments, delivery or fulfilment and a returns policy, and complete three test orders.", 24, ["BIZ-L2-M04"], ["ecommerce"], ["LIVE_SITE", "DOCUMENT"], "BUSINESS"),
    mod("BIZ-L3-M02", 3, "Business analytics", "Track five meaningful numbers for a real or sample business over four weeks, and make and justify two decisions from them.", 16, ["BIZ-L2-M02"], ["business-analytics"], ["DOCUMENT", "SCREENSHOT"], "BUSINESS"),
    mod("BIZ-L3-M03", 3, "Customer retention and growth strategy", "Measure repeat business for a real or sample business, design two retention ideas and a growth plan, and test one idea with real customers.", 16, ["BIZ-L3-M02", "BIZ-L2-M03"], ["growth-retention"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L3-M04", 3, "Business registration and legal awareness", "Write a checklist of the registration, tax, licence and contract steps for a business in your jurisdiction (Ghana or elsewhere) with the official source for each step, and have it reviewed by a qualified person.", 16, ["BIZ-L2-M01"], ["legal-awareness"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L3-M05", 3, "Run a small business pilot", "Run a real eight-week pilot with paying customers, record every sale and cost, and report honestly what worked and what did not.", 60, ["BIZ-L3-M01", "BIZ-L2-M05"], ["business-pilot"], ["DOCUMENT", "SCREENSHOT"], "BUSINESS", true),
    // Level 4
    mod("BIZ-L4-M01", 4, "Capstone: launch a venture", "Launch a venture with real customers and revenue, a twelve-month financial model, a registration plan and evidence of demand, and defend it to a review panel.", 80, ["BIZ-L3-M05", "BIZ-L3-M04", "BIZ-L3-M03"], ["venture-launch"], ["DOCUMENT", "VIDEO", "SCREENSHOT"], "BUSINESS", true),
    mod("BIZ-L4-M02", 4, "Scaling and sustainability", "Write a sustainability plan covering cost control, people, a key risk and its mitigation, and an environmental or community effect, with numbers.", 24, ["BIZ-L3-M05"], ["sustainability"], ["DOCUMENT"], "BUSINESS"),
    mod("BIZ-L4-M03", 4, "Pitching and funding options", "Deliver a ten-minute pitch with a clear request and a one-page financial summary, and compare three realistic funding routes for your venture with their costs.", 20, ["BIZ-L4-M01"], ["pitching"], ["VIDEO", "DOCUMENT"], "BUSINESS"),
    mod("BIZ-L4-M04", 4, "Operations leadership", "Document your operating procedures for five core tasks, train one other person to run one of them, and show the result met your standard.", 24, ["BIZ-L2-M06", "BIZ-L3-M05"], ["operations-pm"], ["DOCUMENT", "VIDEO"], "BUSINESS"),
  ],
};
