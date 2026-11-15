import { mod, type ProgrammeSpec } from "./types";

/**
 * Safety and cost rules for every module in this programme:
 *  - Servers are configured, attacked-for-practice and broken ONLY in labs the learner owns: local virtual machines, a free-tier
 *    or budget-capped cloud account in the learner's name, or a lab environment the Academy provides. Never someone else's server.
 *  - Every cloud exercise states a cost cap or uses a free tier or local virtual machines, and ends with the resources torn down.
 *  - cPanel and WHM need a licence: they are practised in a lab with a trial or licence the learner is given. Where none is
 *    available the module is delivered on an open-source equivalent and the cPanel exercise stays marked "pending lab access".
 *  - No lab has been provisioned yet and no exercise here has been run; every module is DRAFT.
 */
export const CLOUD: ProgrammeSpec = {
  code: "cloud",
  name: "Cloud Computing and Server Administration",
  levelOutcomes: [
    "Explain how servers, networks, DNS, hosting and the cloud fit together, and launch and remove a first virtual server within a cost cap.",
    "Administer a Linux and a Windows server from the command line: remote access, users, permissions, processes and services.",
    "Host and maintain a real website on a VPS with a web server, DNS, HTTPS, a database, backups and a Git-based deployment.",
    "Containerise and deploy applications behind a reverse proxy with a CI/CD pipeline, monitoring, logging, hardening and automation.",
    "Design, build, secure and operate resilient cloud infrastructure as code, with high availability, disaster recovery and observability, and lead the work.",
  ],
  competencies: {
    "server-fundamentals": "Explain what a server is, how operating systems and hosting types differ, and run a server in a virtual machine.",
    "dns-domains": "Explain and manage domains, nameservers and DNS records.",
    "cloud-concepts": "Explain cloud service models, regions and pricing, and run cloud resources within a budget and tear them down.",
    "linux-install": "Install, update and log in to an Ubuntu Server system.",
    "ssh-admin": "Administer servers remotely over SSH with keys and a safe configuration.",
    "users-permissions": "Manage users, groups, permissions and sudo with least privilege.",
    "services-processes": "Manage processes and services with systemd and read their logs.",
    "windows-server": "Perform core Windows Server administration: roles, users, shares, services, events and PowerShell.",
    "linux-distros": "Work across Debian-family and Red Hat-family Linux systems and their package managers.",
    "apache": "Install, configure and troubleshoot the Apache web server with virtual hosts.",
    "nginx": "Install, configure and troubleshoot Nginx for static sites and as a reverse proxy.",
    "dns-configuration": "Configure A, AAAA, CNAME, MX and TXT records and verify propagation.",
    "tls-https": "Issue, install and renew TLS certificates and enforce HTTPS correctly.",
    "database-admin": "Install and administer PostgreSQL and MySQL: users, backups, restores and basic tuning.",
    "vps-deployment": "Deploy and run a web application on a VPS with Git-based updates and environment configuration.",
    "cpanel-whm": "Administer hosting accounts, domains, email and backups in cPanel and WHM.",
    "backup-recovery": "Plan, automate and test backups and restore a system from them.",
    "hosting-delivery": "Deliver a complete hosted website: server, DNS, HTTPS, database, backups and documentation.",
    "docker": "Build, run and manage containers and images with Docker.",
    "container-orchestration-compose": "Define multi-container applications with volumes, networks and logs using Docker Compose.",
    "reverse-proxy-lb": "Configure a reverse proxy and load balancer with health checks and failover.",
    "ci-cd": "Build a CI/CD pipeline that tests and deploys safely, with secrets handled correctly.",
    "server-hardening": "Harden a server with a firewall, SSH and service hardening, updates and an audit against a checklist.",
    "monitoring-logging": "Collect metrics and logs, build dashboards and alerts, and respond to an alert.",
    "automation": "Automate server configuration with scripts and idempotent tooling.",
    "cloud-infrastructure": "Build networks, instances, storage and managed databases on a major cloud provider.",
    "cloud-security": "Secure cloud identities, storage and network rules, and audit a configuration.",
    "platform-delivery": "Deliver a containerised application behind a proxy with CI/CD, monitoring and documentation.",
    "cloud-architecture": "Design cloud architecture from requirements, with diagrams, trade-offs and a cost model.",
    "infrastructure-as-code": "Define, review and apply infrastructure with code and manage its state safely.",
    "kubernetes": "Deploy and update an application on Kubernetes using deployments, services and configuration.",
    "high-availability": "Design and demonstrate availability and scalability with redundancy, health checks and load tests.",
    "disaster-recovery": "Set recovery objectives, build a recovery plan and prove it with a restore drill.",
    "observability": "Define service-level objectives, instrument a service and run incident response with runbooks.",
    "devops-security": "Apply secrets management, image scanning and access control across the delivery pipeline.",
    "production-platform": "Deliver and operate a production-grade platform with infrastructure as code, high availability, monitoring and recovery.",
    "managed-hosting": "Run hosting for clients with a service agreement, monitoring, backups, pricing and handover.",
  },
  modules: [
    // Level 0
    mod("CLOUD-L0-M01", 0, "Servers, operating systems and hosting", "Run a server in a virtual machine on your own computer, and explain with a diagram how it differs from a personal computer and from shared, VPS and cloud hosting.", 8, ["SH-L0-M01", "SH-L0-M04"], ["server-fundamentals"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L0-M02", 0, "Domains, DNS and registrars", "Look up the DNS records of three domains, then create and test records for a domain you own, a free subdomain or a local lab zone, and explain what each record does.", 8, ["SH-L0-M04"], ["dns-domains"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L0-M03", 0, "Cloud concepts and your first cloud server", "Launch one small virtual server in a free-tier or budget-capped cloud account of your own, set a billing alert, connect to it, and tear it down, recording the cost and each step.", 10, ["CLOUD-L0-M01", "SH-L0-M02"], ["cloud-concepts"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    // Level 1
    mod("CLOUD-L1-M01", 1, "Ubuntu Server installation and first login", "Install Ubuntu Server in your own virtual machine, apply updates, set the hostname and timezone, and document every command you ran.", 10, ["CLOUD-L0-M01", "SH-L1-M07"], ["linux-install"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L1-M02", 1, "SSH and remote administration", "Connect to your lab server over SSH with a key pair, copy files securely, and configure SSH so password sign-in is off and root login is disabled, proving each change still lets you in.", 12, ["CLOUD-L1-M01"], ["ssh-admin"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L1-M03", 1, "Users, groups, permissions and sudo", "Create three users and two groups on your lab server with least-privilege access to a shared folder and limited sudo, and demonstrate what each user can and cannot do.", 12, ["CLOUD-L1-M02"], ["users-permissions"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L1-M04", 1, "Processes, services and systemd", "Install a service on your lab server, manage it with systemd, break it on purpose, and diagnose and fix it using the logs, recording what you saw.", 14, ["CLOUD-L1-M03"], ["services-processes"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L1-M05", 1, "Windows Server fundamentals", "Install an evaluation copy of Windows Server in your own virtual machine, add users and a file share with permissions, manage a service in PowerShell, and read the event log to explain one error.", 16, ["CLOUD-L0-M01"], ["windows-server"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L1-M06", 1, "Working across Linux distributions", "Perform the same four tasks (install a package, add a user, start a service, open a firewall port) on a Debian-family and a Red Hat-family lab machine and record the command differences.", 12, ["CLOUD-L1-M04"], ["linux-distros"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    // Level 2
    mod("CLOUD-L2-M01", 2, "Apache web server", "Install Apache on your lab server, serve two sites with virtual hosts, and fix three deliberately broken configurations using the error log.", 16, ["CLOUD-L1-M04", "SH-L1-M01"], ["apache"], ["DOCUMENT", "SCREENSHOT", "LIVE_SITE"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M02", 2, "Nginx web server", "Install Nginx on your lab server, serve a static site, and configure it as a reverse proxy to a small application, with correct headers and a custom error page.", 16, ["CLOUD-L1-M04", "SH-L1-M01"], ["nginx"], ["DOCUMENT", "SCREENSHOT", "LIVE_SITE"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M03", 2, "DNS configuration", "Configure A, AAAA, CNAME, MX and TXT records for a domain or lab zone you control, lower the TTL before a change, and verify the result from two resolvers.", 12, ["CLOUD-L0-M02"], ["dns-configuration"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M04", 2, "SSL/TLS and HTTPS", "Issue a free certificate for a domain you control, install it, redirect all traffic to HTTPS, set up automatic renewal, and show a passing test result.", 14, ["CLOUD-L2-M02", "CLOUD-L2-M03"], ["tls-https"], ["DOCUMENT", "SCREENSHOT", "LIVE_SITE"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M05", 2, "PostgreSQL and MySQL administration", "Install PostgreSQL and MySQL on your lab server, create users with limited rights, take and restore a backup of each, and keep the database from accepting outside connections.", 20, ["CLOUD-L1-M03", "FSWD-L2-M04"], ["database-admin"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M06", 2, "VPS administration and application deployment", "Deploy a small web application to a VPS in your own budget-capped account using Git, with environment variables, a process manager and a deployment you can repeat and roll back.", 20, ["CLOUD-L2-M02", "SH-L1-M05", "SH-L1-M03"], ["vps-deployment"], ["LIVE_SITE", "REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M07", 2, "cPanel and WHM administration", "In a lab with a cPanel trial or licence you have been given, create two hosting accounts, add a domain, set up email and a backup in WHM and cPanel, and restore one account.", 16, ["CLOUD-L2-M03", "CLOUD-L1-M03"], ["cpanel-whm"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M08", 2, "Backups and recovery", "Automate daily backups of files and a database on your lab server to a second location, then delete the live data and restore it, timing the recovery.", 14, ["CLOUD-L2-M05"], ["backup-recovery"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L2-M09", 2, "Checkpoint project: host a business website", "Host a small business website end to end on a VPS in your own account, with a web server, DNS, HTTPS, a database, automated backups and a tested restore, and write the runbook someone else could follow.", 24, ["CLOUD-L2-M04", "CLOUD-L2-M06", "CLOUD-L2-M08"], ["hosting-delivery"], ["LIVE_SITE", "DOCUMENT", "REPOSITORY"], "CLOUD_INFRA", true),
    // Level 3
    mod("CLOUD-L3-M01", 3, "Docker and containerisation", "Write Dockerfiles for two applications, build small images, run containers with limits, and explain what you changed to reduce image size and attack surface.", 20, ["CLOUD-L2-M06"], ["docker"], ["REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M02", 3, "Docker Compose and container management", "Run a multi-container application (web, database, cache) with Compose using volumes, networks and health checks, and show that data survives a container being replaced.", 20, ["CLOUD-L3-M01"], ["container-orchestration-compose"], ["REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M03", 3, "Reverse proxies and load balancing", "Put two copies of an application behind a reverse proxy that balances load with health checks, then stop one copy and show that visitors see no failure.", 20, ["CLOUD-L2-M02", "CLOUD-L3-M02"], ["reverse-proxy-lb"], ["DOCUMENT", "SCREENSHOT", "LIVE_SITE"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M04", 3, "CI/CD pipelines", "Build a pipeline that runs tests and deploys to your lab server only when they pass, keeps secrets out of the repository, and can roll back, and show a failing change being blocked.", 24, ["CLOUD-L2-M06", "SH-L1-M05"], ["ci-cd"], ["REPOSITORY", "DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M05", 3, "Server hardening and firewall configuration", "Harden your own lab server with a default-deny firewall, SSH and service hardening and automatic security updates, then audit it against a published checklist and fix every finding you can.", 20, ["CLOUD-L1-M02", "CLOUD-L1-M03", "CLOUD-L2-M04"], ["server-hardening"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M06", 3, "Monitoring and logging", "Collect metrics and logs from two lab servers, build a dashboard and three alerts, trigger each alert on purpose, and write the response you took.", 24, ["CLOUD-L2-M09"], ["monitoring-logging"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M07", 3, "Infrastructure automation", "Automate the setup of a lab server with scripts and an idempotent configuration tool so that running it twice changes nothing the second time, and rebuild a server from scratch with it.", 24, ["CLOUD-L2-M09", "SH-L1-M07"], ["automation"], ["REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M08", 3, "Cloud infrastructure on a major provider", "Build a private network, two instances, object storage and a managed database on a cloud provider in your own budget-capped account, then document and tear it all down.", 24, ["CLOUD-L0-M03", "CLOUD-L2-M09"], ["cloud-infrastructure"], ["DOCUMENT", "SCREENSHOT", "REPOSITORY"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M09", 3, "Securing cloud accounts and networks", "Lock down your own cloud account with least-privilege identities, multi-factor authentication and restrictive network rules, and audit it to prove no storage or port is open that should not be.", 18, ["CLOUD-L3-M08", "CLOUD-L3-M05"], ["cloud-security"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L3-M10", 3, "Checkpoint project: a delivered platform", "Deliver a containerised application behind a reverse proxy with a CI/CD pipeline, monitoring, a hardening report and a runbook, in your own lab, and survive one injected failure.", 40, ["CLOUD-L3-M03", "CLOUD-L3-M04", "CLOUD-L3-M05", "CLOUD-L3-M06"], ["platform-delivery"], ["LIVE_SITE", "REPOSITORY", "DOCUMENT", "VIDEO"], "CLOUD_INFRA", true),
    // Level 4
    mod("CLOUD-L4-M01", 4, "Cloud architecture", "Design the architecture for a stated set of requirements with a diagram, two alternatives compared on cost, reliability and security, and a monthly cost estimate, and defend it to a reviewer.", 24, ["CLOUD-L3-M08", "CLOUD-L3-M09"], ["cloud-architecture"], ["DOCUMENT", "DESIGN_FILE", "VIDEO"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M02", 4, "Infrastructure as code", "Define a network, servers and a database as code, review the plan before applying, keep its state safely, and rebuild the whole environment from the repository alone in your own account.", 30, ["CLOUD-L3-M07", "CLOUD-L3-M08"], ["infrastructure-as-code"], ["REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M03", 4, "Kubernetes fundamentals", "Run an application on a local Kubernetes cluster with deployments, services and configuration, perform a rolling update, and roll it back after a bad release.", 30, ["CLOUD-L3-M02"], ["kubernetes"], ["REPOSITORY", "DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M04", 4, "High availability and scalability", "Make a service survive the loss of one instance, scale it under a load test in your own lab, and show measurements before and after the change.", 28, ["CLOUD-L3-M03", "CLOUD-L3-M06"], ["high-availability"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M05", 4, "Disaster recovery", "Set recovery time and recovery point objectives for a system, write the recovery plan, and prove it by restoring the whole system from backups in a timed drill, recording what failed.", 24, ["CLOUD-L2-M08", "CLOUD-L4-M02"], ["disaster-recovery"], ["DOCUMENT", "VIDEO"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M06", 4, "Observability and incident response", "Define service-level objectives for a service, instrument it with metrics, logs and traces, run a simulated incident from your own runbook, and write a blameless post-incident review.", 28, ["CLOUD-L3-M06"], ["observability"], ["DOCUMENT", "SCREENSHOT"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M07", 4, "DevOps practice and infrastructure security", "Add secrets management, image and dependency scanning and access controls to your delivery pipeline, and show a vulnerable image being blocked from deployment.", 24, ["CLOUD-L3-M04", "CLOUD-L3-M09"], ["devops-security"], ["REPOSITORY", "DOCUMENT"], "CLOUD_INFRA"),
    mod("CLOUD-L4-M08", 4, "Capstone: production-grade platform", "Deliver a platform defined as code with CI/CD, high availability, monitoring, security review, a recovery drill and full documentation, built and operated in your own lab or budget-capped account, and defend it to a reviewer.", 90, ["CLOUD-L4-M02", "CLOUD-L4-M04", "CLOUD-L4-M05", "CLOUD-L4-M06", "CLOUD-L4-M07"], ["production-platform"], ["REPOSITORY", "DOCUMENT", "LIVE_SITE", "VIDEO"], "CLOUD_INFRA", true),
    mod("CLOUD-L4-M09", 4, "Capstone: managed hosting service", "Run hosting for two real or realistic clients for four weeks under a written service agreement with monitoring, backups, a price list based on your costs and a client handover, and report what the monitoring caught.", 50, ["CLOUD-L3-M10", "SH-L2-M02"], ["managed-hosting"], ["DOCUMENT", "SCREENSHOT", "VIDEO"], "CLOUD_INFRA", true),
  ],
};
