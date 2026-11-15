import type { MissionDraft } from "./types";

/**
 * Business and Entrepreneurship, Level 0 (Foundation): the missions under BIZ-L0-M01, M02 and M03.
 * Numbering continues after the two legacy missions BIZ-L0-01 and BIZ-L0-02, which stay as they are.
 * Money is in Ghana cedis (GHS) and pesewas, with the same method working for any currency. Every exercise uses ordinary public
 * information or people who agree to talk; no mission needs private financial records. Every WATCH entry is a brief for a curator
 * and no resource is named or approved.
 */
export const BIZ_L0: MissionDraft[] = [
  // ───────────── BIZ-L0-M01 Business fundamentals and entrepreneurial thinking ─────────────
  {
    code: "BIZ-L0-03", moduleId: "BIZ-L0-M01", title: "Map how a local business makes money", status: "DRAFT",
    objective: "Observe one local business for thirty minutes and draw a map showing who pays it, what they buy, what it costs the business, and how money moves.",
    minutes: 90, kind: "STUDY", evidence: "DOCUMENT", xp: 40, tools: ["Notebook and pen or a notes app", "A free diagramming tool or paper"],
    competencies: ["business-basics"],
    watch: {
      minutes: 15,
      brief: "A short explanation of revenue, costs and profit using one small, familiar business, such as a food seller, a salon or a mobile money agent.",
      mustShow: ["Revenue, costs and profit defined with a worked example from a small business", "The difference between a customer who pays and a user who benefits", "An example of a simple money-flow map for a small business"],
    },
    doSteps: [
      "Choose a small business near you that is open to the public, such as a shop, a salon, a food seller or a mobile money agent.",
      "Watch it for thirty minutes from a place where you are not in the way and note who comes, what they buy, roughly how many customers and what the visible prices are.",
      "List the costs you can see or reasonably infer, such as stock, rent, power, transport and helpers, without asking for private figures.",
      "Draw a map of the money: who pays, what for, and where the money goes, and write three sentences saying how the business makes a profit.",
    ],
    experiment: "Predict how the map would change if the busiest hour doubled, or if the supplier raised prices by one fifth. Say which would hurt the business more and why.",
    show: "Submit one document with your observation notes, your money map and your three sentences, and say which business you chose (you do not need to name the owner).",
    verification: [
      "The notes record a thirty-minute observation with times, customers and visible prices.",
      "The map shows customers, products, money coming in and at least three kinds of cost.",
      "The three sentences correctly separate revenue, costs and profit.",
      "The experiment gives a reasoned prediction, not only an opinion.",
    ],
    remediation: "Add the missing cost or flow of money the assessor named, correct any confusion between revenue and profit, and resubmit.",
    rubric: [
      { criterion: "Customer understanding", description: "Who pays and why they buy is described from observation.", points: 30 },
      { criterion: "Financial feasibility", description: "Revenue, costs and profit are correctly identified and not confused.", points: 30 },
      { criterion: "Execution quality", description: "The notes and map are complete, clear and based on a real observation.", points: 40 },
    ],
  },
  {
    code: "BIZ-L0-04", moduleId: "BIZ-L0-M01", title: "Interview a small business owner", status: "DRAFT",
    objective: "Prepare six questions, interview an adult small business owner who agrees to talk, and write up what they told you in their own words.",
    minutes: 120, kind: "STUDY", evidence: "DOCUMENT", xp: 50, tools: ["Notebook or a notes app", "A phone for calling or messaging to arrange the visit"],
    competencies: ["business-basics"],
    watch: {
      minutes: 15,
      brief: "A short guide to interviewing a small business owner respectfully: asking permission, asking open questions, listening, and not asking for private financial figures.",
      mustShow: ["How to ask for ten minutes of someone's time and what to say about why you are asking", "Open questions that start with how, what and tell me about, and the questions to avoid", "Taking notes of what was actually said and thanking the person"],
    },
    doSteps: [
      "Write six open questions about how the owner started, who their customers are, what is hardest about the work, how they decide prices and what they would change.",
      "Ask an adult owner for a short interview at a time that suits them, explain it is for your own learning, and agree that they may skip any question.",
      "Interview them for twenty to thirty minutes, write down their answers as close to their own words as you can, and do not ask for private financial figures.",
      "Thank them, then write a one-page summary with three things that surprised you and one thing you would ask next time.",
    ],
    experiment: "Look at your six questions after the interview and mark which ones got long, useful answers and which got short answers. Rewrite the weakest two so they would get better answers next time.",
    show: "Submit your six questions, your interview notes, your one-page summary, and your two rewritten questions. Do not include the owner's phone number or private details.",
    verification: [
      "Six open questions are present and none asks for private financial figures.",
      "The notes contain direct statements from the owner, not only the learner's opinions.",
      "The summary lists three surprises and one follow-up question.",
      "The two rewritten questions are open questions that are clearly better than the originals.",
    ],
    remediation: "Rewrite the closed or leading questions, add direct quotes where your notes only contain your own summary, and resubmit.",
    rubric: [
      { criterion: "Customer understanding", description: "The write-up shows what the owner's customers want and why, in the owner's words.", points: 35 },
      { criterion: "Market reasoning", description: "The summary draws sound conclusions about the business from what was said.", points: 25 },
      { criterion: "Execution quality", description: "The interview was prepared, respectful and clearly recorded.", points: 40 },
    ],
  },
  {
    code: "BIZ-L0-05", moduleId: "BIZ-L0-M01", title: "Write a two-page business analysis", status: "DRAFT",
    objective: "Combine your observation and interview into a two-page analysis that says who the customers are, how the business earns, its main costs, and one improvement with a reason.",
    minutes: 90, kind: "WRITE", evidence: "DOCUMENT", xp: 40, tools: ["Any word processor or text editor (free)"],
    competencies: ["business-basics"],
    watch: {
      minutes: 10,
      brief: "A short example of a clear one-page business description with headings for customers, income, costs and an improvement idea.",
      mustShow: ["A simple structure for describing a business in plain language", "Giving a reason for an improvement idea instead of only stating it"],
    },
    doSteps: [
      "Reread your money map and your interview notes and highlight the facts you are sure about.",
      "Write the first page: who the customers are, what they buy and how the business earns money.",
      "Write the second page: the main costs, the biggest risk to the business, and one improvement idea with two reasons based on your evidence.",
      "Read it aloud once, cut anything you cannot support with your notes, and fix unclear sentences.",
    ],
    experiment: "Give your improvement idea to someone and ask them to argue against it. Record their best objection and say whether it changes your idea.",
    show: "Submit your two-page analysis and your note on the best objection and your response.",
    verification: [
      "The analysis has sections for customers, income, costs, risk and one improvement.",
      "Each claim can be traced to the learner's own observation or interview notes.",
      "The improvement has at least two reasons that use evidence.",
      "The objection and response are recorded.",
    ],
    remediation: "Replace each unsupported claim with a fact from your notes or remove it, and resubmit.",
    rubric: [
      { criterion: "Market reasoning", description: "Claims about customers and the business are supported by the learner's own evidence.", points: 30 },
      { criterion: "Operational planning", description: "The improvement idea is specific and could actually be tried.", points: 30 },
      { criterion: "Execution quality", description: "The two pages are clear, complete and well organised.", points: 40 },
    ],
  },

  // ───────────── BIZ-L0-M02 Finding a real problem ─────────────
  {
    code: "BIZ-L0-06", moduleId: "BIZ-L0-M02", title: "Write five questions that find real problems", status: "DRAFT",
    objective: "Write five open questions that uncover problems people actually have, by asking about what they did last time rather than what they would like.",
    minutes: 60, kind: "WRITE", evidence: "DOCUMENT", xp: 25, tools: ["Any word processor or notes app"],
    competencies: ["problem-identification"],
    watch: {
      minutes: 10,
      brief: "A short explanation of why questions about past behaviour reveal real problems better than questions about opinions or future wishes.",
      mustShow: ["The difference between 'Would you use this?' and 'Tell me about the last time you...'", "Why people are polite and say yes to ideas they would never pay for"],
    },
    doSteps: [
      "Pick an everyday area where people in your community spend time or money, such as getting to work, buying food, or paying bills.",
      "Write five questions that ask about the last time something went wrong or took too long in that area.",
      "Check each question: remove any that mention your own idea, ask for an opinion about a product, or can be answered yes or no.",
      "Practise the five questions out loud once with a friend and mark any that confused them.",
    ],
    experiment: "Write one 'bad' version of each question that invites a polite yes, and explain what you would learn, or fail to learn, from each.",
    show: "Submit your five final questions and, for each, its weaker version and one sentence on why yours is better.",
    verification: [
      "There are five questions and none can be answered with yes or no.",
      "Each question asks about a specific past event.",
      "None of the questions mentions a product or idea the learner is selling.",
      "Each weaker version is paired with a clear reason.",
    ],
    remediation: "Rewrite any question that asks for an opinion or invites a yes or no so it asks about a real past event, and resubmit.",
    rubric: [
      { criterion: "Customer understanding", description: "The questions would reveal what people actually did and what went wrong.", points: 50 },
      { criterion: "Market reasoning", description: "The comparison with the weaker questions shows sound thinking about what each would and would not reveal.", points: 20 },
      { criterion: "Execution quality", description: "Questions are clear, in plain language, and every comparison is explained.", points: 30 },
    ],
  },
  {
    code: "BIZ-L0-07", moduleId: "BIZ-L0-M02", title: "Talk to five people and record what they say", status: "DRAFT",
    objective: "Talk to five adults who agree to answer, record each person's problems in their own words, and note how often and how badly each problem happens.",
    minutes: 150, kind: "STUDY", evidence: "DOCUMENT", xp: 60, tools: ["Notebook or a notes app"],
    competencies: ["problem-identification"],
    watch: {
      minutes: 15,
      brief: "A short demonstration of a short, respectful problem conversation: opening, asking open questions, staying quiet, and recording exact words.",
      mustShow: ["How to open a short conversation and ask permission to take notes", "Following up with 'Can you tell me more?' instead of suggesting answers", "Writing down what was said rather than what you hoped to hear"],
    },
    doSteps: [
      "Choose five adults in your community who face the area you picked, and ask each if they will talk with you for ten minutes about it.",
      "Use your five questions and ask follow-up questions, and write down each answer in their words without their name unless they allow it.",
      "For each person record the problem, how often it happens, what they do about it now, and how much it costs them in time or money.",
      "Thank each person and tidy your notes the same day while you still remember them.",
    ],
    experiment: "Look for a problem that two or more people described differently. Decide whether it is one problem or two, and explain how your notes support your decision.",
    show: "Submit a document with your five conversations (no names unless permitted) and your note on the problem that people described differently.",
    verification: [
      "Five separate conversations are recorded.",
      "Each record has a problem, how often it happens, what the person does now and its cost.",
      "Notes include direct words from people.",
      "No names, phone numbers or private details are included without permission.",
    ],
    remediation: "Add direct quotes and the missing frequency or cost for any conversation where they are missing, speaking to the person again if you must, and resubmit.",
    rubric: [
      { criterion: "Customer understanding", description: "Each problem is recorded from the person's own account with frequency and cost.", points: 45 },
      { criterion: "Market reasoning", description: "The learner identifies patterns and differences across conversations soundly.", points: 20 },
      { criterion: "Execution quality", description: "Conversations were respectful, complete and recorded accurately and anonymously.", points: 35 },
    ],
  },
  {
    code: "BIZ-L0-08", moduleId: "BIZ-L0-M02", title: "Sort the problems and choose one", status: "DRAFT",
    objective: "Rank your five people's problems by how often, how painful and how willing people are to pay, and choose one problem using your own evidence.",
    minutes: 90, kind: "WRITE", evidence: "DOCUMENT", xp: 40, tools: ["Any word processor or spreadsheet (free)"],
    competencies: ["problem-identification"],
    watch: {
      minutes: 10,
      brief: "A short explanation of how to compare problems on how often they happen, how much they hurt and whether people already spend time or money on them.",
      mustShow: ["Three simple tests for whether a problem is worth solving", "Treating what people already pay or do as stronger evidence than what they say"],
    },
    doSteps: [
      "List every problem from your five conversations on one page.",
      "Score each problem from 1 to 5 on how often it happens, how much it hurts, and whether people already spend time or money on a workaround.",
      "Add the scores, choose the highest-scoring problem, and write down two quotes that support the choice.",
      "Write one paragraph saying why you did not choose the second-highest problem.",
    ],
    experiment: "Change each score by one point in the direction that would hurt your chosen problem the most. Say whether it would still win, and what that tells you about how sure you are.",
    show: "Submit your scored table, the chosen problem with two supporting quotes, your paragraph on the runner-up, and your result from changing the scores.",
    verification: [
      "Each problem is scored on all three measures.",
      "The chosen problem has the highest total or the reason for an exception is given.",
      "Two direct quotes support the choice.",
      "The sensitivity test is done and its result is stated.",
    ],
    remediation: "Rescore using evidence from your notes, add any missing quotes, and resubmit with the corrected choice.",
    rubric: [
      { criterion: "Market reasoning", description: "The ranking follows the learner's evidence and the reasoning is sound.", points: 40 },
      { criterion: "Customer understanding", description: "Quotes show the real people and the pain behind the chosen problem.", points: 40 },
      { criterion: "Execution quality", description: "The table and write-up are complete and easy to follow.", points: 20 },
    ],
  },
  {
    code: "BIZ-L0-09", moduleId: "BIZ-L0-M02", title: "Test your chosen problem with three questions", status: "DRAFT",
    objective: "Check your chosen problem against three tests, state whether to continue or choose again, and say what you would do next.",
    minutes: 60, kind: "WRITE", evidence: "DOCUMENT", xp: 25, tools: ["Any word processor or notes app"],
    competencies: ["problem-identification"],
    watch: {
      minutes: 10,
      brief: "A short explanation of three checks before building anything: do many people have the problem, do they already work around it, and can you reach them.",
      mustShow: ["Why a problem only one person has is not yet a business opportunity", "How to tell whether people already spend time or money on the problem"],
    },
    doSteps: [
      "Count how many of your five people have the chosen problem and write the number and what they said.",
      "Write what each person already does or pays to cope with the problem and the cost in time or money.",
      "Say how you would reach more people with this problem and what it would cost you to reach them.",
      "Write a verdict of continue or choose again with three sentences of reasons, and one specific next step for the next two weeks.",
    ],
    experiment: "Find one other person you have not spoken to who has this problem, ask them your best question, and record whether their answer fits or changes your verdict.",
    show: "Submit your counts, workarounds, reach plan, verdict with reasons, next step and the result of your extra conversation.",
    verification: [
      "The number of people with the problem is stated with their evidence.",
      "At least two workarounds are described with a cost.",
      "The reach plan names a place or method and an approximate cost.",
      "The verdict is clearly continue or choose again with reasons, and the extra conversation is recorded.",
    ],
    remediation: "Replace any answer that says people 'would' do something with what they actually do now, and resubmit your verdict.",
    rubric: [
      { criterion: "Market reasoning", description: "The verdict follows from the counts and workarounds.", points: 40 },
      { criterion: "Financial feasibility", description: "The cost of workarounds and of reaching people is estimated sensibly.", points: 20 },
      { criterion: "Operational planning", description: "The next two-week step is specific and doable.", points: 20 },
      { criterion: "Execution quality", description: "The write-up is complete and evidence is shown, not asserted.", points: 20 },
    ],
  },

  // ───────────── BIZ-L0-M03 Money basics: revenue, cost and profit ─────────────
  {
    code: "BIZ-L0-10", moduleId: "BIZ-L0-M03", title: "Collect real prices for one product", status: "DRAFT",
    objective: "Record the selling prices of one everyday product from three sellers and the cost items behind it, using only public prices or what sellers choose to share.",
    minutes: 90, kind: "STUDY", evidence: "DOCUMENT", xp: 35, tools: ["Notebook or a notes app", "A calculator or phone"],
    competencies: ["money-basics"],
    watch: {
      minutes: 10,
      brief: "A short explanation of selling price, cost price and margin using an everyday product that is sold in small quantities.",
      mustShow: ["The difference between the price a seller pays and the price a customer pays", "Why prices differ between sellers and what the difference might tell you"],
    },
    doSteps: [
      "Choose one everyday product that is sold in your area, such as sachet water, fried plantain, phone credit or a notebook.",
      "Record the selling price from three different sellers, with where and when you saw it.",
      "Find the wholesale or supplier price from public information or from a seller who is happy to tell you, and list other visible costs such as transport, packaging or power.",
      "Write what each seller keeps for each unit and say which seller you think earns the most and why.",
    ],
    experiment: "Predict the price of the same product at a fourth place you have not visited, then check it and explain the difference between your prediction and the real price.",
    show: "Submit your table of prices with places and dates, your cost list, your per-unit calculation for each seller, and your prediction result.",
    verification: [
      "Three selling prices are recorded with place and date.",
      "At least one supplier price is recorded with its source.",
      "Per-unit calculations are shown for each seller.",
      "The prediction and the actual price are both recorded.",
    ],
    remediation: "Check any price that looks wrong, add a missing source, redo the arithmetic and resubmit.",
    rubric: [
      { criterion: "Market reasoning", description: "Price differences are noticed and explained with sensible reasons.", points: 35 },
      { criterion: "Financial feasibility", description: "Per-unit cost and margin are calculated correctly.", points: 35 },
      { criterion: "Execution quality", description: "Prices are real, dated, sourced and clearly recorded.", points: 30 },
    ],
  },
  {
    code: "BIZ-L0-11", moduleId: "BIZ-L0-M03", title: "Calculate profit and break-even", status: "DRAFT",
    objective: "Work out revenue, costs and profit for one day of a small stall and find how many units it must sell to cover its costs.",
    minutes: 120, kind: "DRILL", evidence: "DOCUMENT", xp: 50, tools: ["Calculator, paper or a free spreadsheet"],
    competencies: ["money-basics"],
    watch: {
      minutes: 15,
      brief: "A worked example of revenue, fixed and variable costs, profit and the break-even point for a small stall, shown step by step.",
      mustShow: ["Fixed costs and variable costs with a small-business example", "The break-even formula and how to use it for one product"],
    },
    doSteps: [
      "Use your product from the last mission and imagine a one-day stall selling it, with prices and costs taken from your table.",
      "List fixed costs for the day (such as rent of a table or a day's transport) and variable costs for each unit.",
      "Calculate revenue, total cost and profit if you sell 20 units, then for 40 units.",
      "Calculate the number of units you must sell just to cover your costs and show the working.",
    ],
    experiment: "Raise the selling price by ten percent and then lower it by ten percent. Recalculate the break-even each time and explain which change you would be braver about making and why.",
    show: "Submit your cost lists, your calculations for 20 and 40 units, your break-even working and your price-change comparison. Write amounts in cedis and pesewas.",
    verification: [
      "Fixed and variable costs are listed separately and correctly.",
      "Revenue, cost and profit are calculated correctly for both quantities.",
      "The break-even calculation shows its working and its result matches the inputs.",
      "The price-change comparison uses recalculated figures.",
    ],
    remediation: "Recheck the arithmetic the assessor marked, separate any cost that is in the wrong group, and resubmit.",
    rubric: [
      { criterion: "Financial feasibility", description: "Revenue, cost, profit and break-even are calculated correctly with working shown.", points: 60 },
      { criterion: "Operational planning", description: "The costs listed are realistic for running such a stall for a day.", points: 20 },
      { criterion: "Execution quality", description: "Working is neat and the results are clearly presented.", points: 20 },
    ],
  },
  {
    code: "BIZ-L0-12", moduleId: "BIZ-L0-M03", title: "Explain your numbers to a friend", status: "DRAFT",
    objective: "Write a one-page plain-language explanation of your profit and break-even numbers and improve it using a friend's questions.",
    minutes: 60, kind: "WRITE", evidence: "DOCUMENT", xp: 25, tools: ["Any word processor or notes app"],
    competencies: ["money-basics"],
    watch: {
      minutes: 10,
      brief: "A short example of explaining business numbers in plain language to someone who has not studied business.",
      mustShow: ["Replacing jargon with everyday words without losing accuracy", "Using one simple example to make a number real"],
    },
    doSteps: [
      "Write one page explaining what your stall earns, what it spends, when it starts making a profit and why, using no jargon.",
      "Give it to a friend who has not studied business and ask them to underline anything they did not understand.",
      "Write down the questions they asked and what you changed because of them.",
      "Rewrite the page so that every underlined part is clear.",
    ],
    experiment: "Ask your friend to say back, in one sentence, what the break-even point means. Compare it with your own meaning and fix the page if they differ.",
    show: "Submit your first version, your friend's underlined parts or questions, your final version and your note on the one-sentence check.",
    verification: [
      "The first and final versions are both included.",
      "The friend's questions are recorded and at least two changes are traced to them.",
      "The final version uses the correct numbers from the calculation mission.",
      "The one-sentence check is recorded.",
    ],
    remediation: "Fix the part the friend still found unclear, check the numbers match your calculation, and resubmit.",
    rubric: [
      { criterion: "Financial feasibility", description: "The explanation uses the correct numbers and meanings.", points: 30 },
      { criterion: "Customer understanding", description: "The writing was shaped by what a real reader found unclear.", points: 20 },
      { criterion: "Execution quality", description: "The final page is clear, accurate and free of jargon.", points: 50 },
    ],
  },
];
