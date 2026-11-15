import { mod, type ProgrammeSpec } from "./types";

/**
 * Safety rule for every module in this programme: offensive techniques are practised ONLY in environments the learner owns
 * or has written permission to test (intentionally vulnerable applications, controlled labs, the learner's own machines).
 * No module may assign testing of a real third-party system. Reviewers reject any mission that does.
 */
export const SEC: ProgrammeSpec = {
  code: "sec",
  name: "Cybersecurity and Ethical Hacking",
  levelOutcomes: [
    "Explain how computers and networks work, apply basic security hygiene, and use a command line safely.",
    "Analyse network traffic, secure a Linux system, and write small Python tools for security tasks, inside a lab you own.",
    "Perform a scoped vulnerability assessment of an intentionally vulnerable application and report findings clearly.",
    "Run a structured penetration test and a defensive investigation in a lab, and recommend and verify remediation.",
    "Lead a complete security assessment or incident response exercise, communicate risk to non-technical readers, and practise responsible disclosure.",
  ],
  competencies: {
    "security-hygiene": "Apply password, update, backup and phishing-awareness practices and explain the reason for each.",
    "networking": "Explain TCP/IP, DNS, HTTP and HTTPS and read a packet capture.",
    "windows-security": "Harden a Windows machine and review its logs and accounts.",
    "linux-security": "Administer and harden a Linux system with users, permissions and services.",
    "python-security": "Automate security tasks in Python, such as log parsing and port checks, in a lab.",
    "threat-modelling": "Model assets, threats and controls for a system and rank the risks.",
    "cryptography": "Explain hashing, symmetric and public-key cryptography and use them correctly.",
    "iam": "Design identity and access controls with least privilege and multi-factor authentication.",
    "web-app-security": "Identify and explain web vulnerabilities from the OWASP guidance.",
    "vuln-assessment": "Run a scoped vulnerability scan, validate the results and rate severity.",
    "pentest-method": "Follow a penetration-testing methodology inside a written scope.",
    "recon": "Gather information about a target you are authorised to test, within scope.",
    "network-defence": "Segment, filter and monitor a network and detect suspicious activity.",
    "log-analysis-siem": "Collect and analyse logs in a SIEM and write detections for real attack patterns.",
    "incident-response": "Contain, investigate and recover from an incident and write a post-incident report.",
    "cloud-security": "Secure cloud identities, storage and networks and review a cloud configuration.",
    "secure-coding": "Write code that avoids the common vulnerability classes and review code for them.",
    "security-reporting": "Write findings with evidence, risk, and prioritised remediation that others can act on.",
    "security-ethics": "Operate within scope, law and professional ethics, and follow responsible disclosure.",
    "security-assessment-delivery": "Deliver a full assessment with findings, remediation advice and verification that fixes work.",
  },
  modules: [
    // Level 0
    mod("SEC-L0-M01", 0, "Security fundamentals and personal hygiene", "Secure your own accounts and devices with a checklist, then explain to a non-technical person how phishing works and how to spot a sample set of ten messages.", 8, ["SH-L0-M01", "SH-L0-M02"], ["security-hygiene"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L0-M02", 0, "Ethics, law and safe labs", "Build a personal lab with virtual machines on your own computer, sign a written scope for it, and explain what you may and may not test and why.", 8, ["SEC-L0-M01"], ["security-ethics"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L0-M03", 0, "How networks work", "Capture your own web traffic in the lab, label the DNS, TCP and HTTP steps of one page load, and explain what HTTPS protects.", 10, ["SEC-L0-M02"], ["networking"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    // Level 1
    mod("SEC-L1-M01", 1, "Networking in depth", "Design and configure a small virtual network with subnets, and use packet analysis to show what each protocol does at each layer.", 20, ["SEC-L0-M03", "SH-L1-M07"], ["networking"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L1-M02", 1, "Linux administration for security", "Harden a Linux virtual machine: users and groups, permissions, SSH keys, a firewall and unnecessary services removed, and record each step.", 20, ["SH-L1-M07"], ["linux-security"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L1-M03", 1, "Windows security basics", "Harden a Windows virtual machine, review its accounts and event logs, and explain five findings and what you changed.", 14, ["SEC-L0-M02"], ["windows-security"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L1-M04", 1, "Python for security tasks", "Write and test three small tools for your lab: a log parser, a hash checker and a port-open check that refuses to run outside your own address range.", 20, ["SH-L1-M06", "SH-L1-M05"], ["python-security"], ["REPOSITORY"], "SECURITY"),
    mod("SEC-L1-M05", 1, "Cryptography fundamentals", "Demonstrate hashing, symmetric and public-key encryption and digital signatures with working examples, and explain one misuse for each.", 14, ["SH-L1-M06"], ["cryptography"], ["REPOSITORY", "DOCUMENT"], "SECURITY"),
    // Level 2
    mod("SEC-L2-M01", 2, "Threat modelling", "Model a small web application with a data-flow diagram, list at least ten threats using a recognised method, and rank them with the controls you would add.", 14, ["SEC-L1-M01"], ["threat-modelling"], ["DOCUMENT"], "SECURITY"),
    mod("SEC-L2-M02", 2, "Identity and access management", "Design access control for a small organisation with roles, least privilege, multi-factor authentication and an offboarding checklist, and test it in a lab.", 16, ["SEC-L1-M05"], ["iam"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L2-M03", 2, "Web application security", "Find and explain at least eight OWASP Top 10 vulnerabilities in an intentionally vulnerable application, with proof of each in your lab.", 24, ["SEC-L1-M01", "SH-L1-M03"], ["web-app-security"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L2-M04", 2, "Vulnerability assessment", "Run a scan against a lab target inside a written scope, remove false positives by checking each result, and rate the real findings by severity.", 18, ["SEC-L1-M02", "SEC-L0-M02"], ["vuln-assessment"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L2-M05", 2, "Secure coding", "Fix five vulnerable code samples (injection, authentication, access control, secrets, unsafe deserialisation) and write a test that fails before and passes after each fix.", 20, ["SEC-L2-M03", "SH-L1-M06"], ["secure-coding"], ["REPOSITORY"], "SECURITY"),
    mod("SEC-L2-M06", 2, "Checkpoint project: assess a vulnerable web application", "Run a complete scoped assessment of an intentionally vulnerable web application in your own lab, from threat model to verified findings and a short report with fixes.", 24, ["SEC-L2-M03", "SEC-L2-M04", "SEC-L2-M05"], ["vuln-assessment", "web-app-security", "security-reporting"], ["DOCUMENT", "SCREENSHOT"], "SECURITY", true),
    // Level 3
    mod("SEC-L3-M01", 3, "Penetration-testing methodology and reconnaissance", "Plan a penetration test from a written scope and rules of engagement, perform authorised reconnaissance against your lab, and document what you found and what you left alone.", 24, ["SEC-L2-M04", "SEC-L2-M01"], ["pentest-method", "recon"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L3-M02", 3, "Network security and defence", "Segment and filter a lab network, add monitoring, and show that a simulated attack from another lab machine is detected and blocked.", 24, ["SEC-L1-M01", "SEC-L1-M02"], ["network-defence"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L3-M03", 3, "SIEM and log analysis", "Ingest logs from three lab systems into a SIEM, write five detection rules, and trigger and investigate each from a simulated attack.", 24, ["SEC-L1-M04", "SEC-L1-M02"], ["log-analysis-siem"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L3-M04", 3, "Incident response", "Respond to a simulated breach in your lab: contain it, collect evidence, find the root cause, recover, and write a post-incident report.", 24, ["SEC-L3-M03"], ["incident-response"], ["DOCUMENT"], "SECURITY"),
    mod("SEC-L3-M05", 3, "Cloud security", "Review a deliberately misconfigured cloud account or lab, fix its identity, storage and network settings, and show the before and after configuration.", 20, ["SEC-L2-M02"], ["cloud-security"], ["DOCUMENT", "SCREENSHOT"], "SECURITY"),
    mod("SEC-L3-M06", 3, "Security reporting and communication", "Write a findings report with an executive summary, evidence, risk ratings and prioritised remediation that a non-technical manager could act on.", 14, ["SEC-L2-M04"], ["security-reporting"], ["DOCUMENT"], "SECURITY"),
    // Level 4
    mod("SEC-L4-M01", 4, "Capstone: scoped security assessment", "Perform a complete assessment of an intentionally vulnerable system you are authorised to test, deliver the report, help fix the findings, and verify the fixes with retesting.", 70, ["SEC-L3-M01", "SEC-L3-M06", "SEC-L2-M05"], ["security-assessment-delivery"], ["DOCUMENT", "SCREENSHOT", "VIDEO"], "SECURITY", true),
    mod("SEC-L4-M02", 4, "Capstone: defensive operations exercise", "Detect, investigate and contain a multi-stage simulated attack end to end using your own monitoring, and present the timeline and lessons learned.", 50, ["SEC-L3-M03", "SEC-L3-M04", "SEC-L3-M02"], ["incident-response", "log-analysis-siem"], ["DOCUMENT", "VIDEO"], "SECURITY", true),
    mod("SEC-L4-M03", 4, "Responsible disclosure and professional practice", "Write a disclosure report for a vulnerability found in a lab or a project that has a published disclosure policy, and a professional code-of-conduct statement you will work under.", 12, ["SEC-L3-M06"], ["security-ethics", "security-reporting"], ["DOCUMENT"], "SECURITY"),
    mod("SEC-L4-M04", 4, "Advanced application security review", "Review the source of a real open-source or learner-owned application for security flaws, report five with fixes, and submit one of them upstream through its disclosure process.", 30, ["SEC-L2-M05", "SEC-L3-M01"], ["secure-coding", "web-app-security"], ["DOCUMENT", "REPOSITORY"], "SECURITY"),
  ],
};
