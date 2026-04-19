# Job Switch Preparation Strategy
**Target:** 30 LPA in 30 days → 70 LPA in 3 months
**Current CTC:** 15 LPA
**Profile:** SRE / Platform Engineer, 4+ years, Tata Motors
**Availability:** 1–2 hours/day
**Location preference:** Remote > Bangalore/Hyderabad > Pune

---

## Core Philosophy

You are not a fresher. You have 4+ years of real production experience — 15+ apps, 99.9% uptime, 25% cost savings, 50–70% faster deployments. Your gap is not experience. Your gap is:

1. **Fundamentals you use but can't explain** (Linux, Networking, K8s internals, AWS internals)
2. **Presenting your work in interview language** (STAR stories, system design frameworks)

> You've been cooking great food for 4 years. Now you need to learn how to describe the dish to a food critic — not learn to cook.

**With 1–2 hrs/day:**
- 30 days × 1.5 hrs = ~45 hours → Interview ready at 30 LPA
- 3 months × 1.5 hrs = ~135 hours → Dangerous at 70 LPA companies

---

## The Learning Ladder

Interviews are a building. You cannot skip floors.

```
FLOOR 4 → System Design           (70 LPA interviews)
FLOOR 3 → K8s + AWS Deep Internals (50 LPA interviews)
FLOOR 2 → Networking + Linux Basics (30 LPA interviews)
FLOOR 1 → Talking about your work  (ALL interviews)
GROUND  → Resume + LinkedIn fixed  (getting shortlisted)
```

---

## The Interview Funnel (SRE/Platform roles)

```
Round 1: HR Screen       → "Are you a real person? Can you talk?"
Round 2: Technical Screen → Basics — Linux, K8s, CI/CD concepts
Round 3: System Design    → Design a scalable production system
Round 4: Deep Dive        → Internals of your stack
Round 5: Offer/Salary     → Negotiation
```

---

## Phase 1: 30-Day Plan — Interview Ready (30 LPA)

### Week 1: Ground Floor — Get Shortlisted (Days 1–7)
**Goal:** Fix resume, build LinkedIn, craft your story, start applying

| Day | Task |
|-----|------|
| 1–2 | Fix resume: add LinkedIn/GitHub URLs, remove duplicate bullets, add graduation years |
| 3–4 | Build LinkedIn: headline, about section, all projects with numbers |
| 5–6 | Write and memorize your 90-second "tell me about yourself" script |
| 7   | Apply to 10 remote SRE/Platform roles (LinkedIn, Naukri, Wellfound) |

**Your script:**
> "I'm an SRE/Platform Engineer with 4 years building production infrastructure on AWS. At Tata Motors I owned 15+ applications, cut cloud costs by 25% with Lambda automation, and built CI/CD pipelines that reduced deployment time by 70%. I'm now looking to bring that to a product company at scale."

---

### Week 2: Floor 1 — Linux + Networking Basics (Days 8–14)
**Goal:** Explain what you already use every day

| Day | Topic | What to Learn |
|-----|-------|---------------|
| 8–9  | Linux Process Management | ps, top, signals, systemd, how processes work |
| 10–11 | Linux Networking | netstat, iptables, how packets move, what a socket is |
| 12–13 | DNS + Load Balancers | How DNS resolves, what ALB actually does, TCP vs UDP |
| 14   | Mock explain day | Explain each concept out loud for 2 mins — record yourself |

**Resources:**
- TechWorld with Nana — Linux crash course (YouTube, free)
- Julia Evans — Networking Zine (jvns.ca, free)
- ByteByteGo — DNS explained (YouTube, free)

**The interview question these cover:**
> "Walk me through what happens when a user hits your application URL."

---

### Week 3: Floor 2 — K8s + AWS Internals Basics (Days 15–21)
**Goal:** Know what's happening inside tools you already operate

| Day | Topic | What to Learn |
|-----|-------|---------------|
| 15–16 | K8s Architecture | etcd, API server, scheduler, kubelet — draw the diagram |
| 17–18 | K8s Pod Lifecycle | How a pod gets scheduled, eviction, resource limits |
| 19–20 | AWS VPC Internals | Subnets, security groups, NAT gateway, traffic flow |
| 21   | AWS IAM + Secrets | Roles, policies, Secrets Manager internals, least privilege |

**Resource:** TechWorld with Nana — Kubernetes full course (YouTube, free, watch at 1.5x)

---

### Week 4: Floor 1 — Behavioral Stories + Apply Hard (Days 22–30)
**Goal:** Convert real experience into interview-ready STAR stories

**Your 5 must-have stories:**

| Story | Your Angle |
|-------|-----------|
| "Tell me about a production incident you resolved" | Real incident from 15+ apps |
| "Tell me about a cost optimization" | 25% savings with Lambda automation |
| "Tell me about improving a deployment process" | 50–70% CI/CD improvement |
| "Tell me about leading a technical initiative" | K8s cluster setup from scratch |
| "Why are you leaving Tata Motors?" | Growth, scale, product company exposure |

**Days 28–30:** Apply to 20 more companies. You are ready for initial screens.

---

## Phase 2: Month 2 — Active Interviewing + Deeper Mastery (30→50 LPA)

**Theme:** Learn by doing interviews in parallel. Each rejection is data.

| Week | Study Focus | Interviewing At |
|------|-------------|-----------------|
| 5–6 | K8s deep dive: CKA syllabus — CNI, RBAC, storage, troubleshooting | 30–35 LPA companies |
| 7–8 | AWS deep dive: SAA-C03 syllabus — EC2 internals, RDS HA, EKS vs ECS | 35–45 LPA companies |

**Target companies:**
- ThoughtWorks, Freshworks, Atlassian (Bangalore), Walmart Global Tech, Persistent
- Remote: US/EU startups on Wellfound, Himalayas.app, Remote.com

**Certification to attempt end of Month 2:**
- **AWS Solutions Architect Associate (SAA-C03)** — adds credibility, justifies salary ask
- Prep: Adrian Cantrill's course (best for internals, not just exam)

---

## Phase 3: Month 3 — System Design Mastery (50→70 LPA)

**Theme:** Think like a Staff Engineer. Make trade-off decisions under pressure.

| Week | Study Focus | Practice |
|------|-------------|----------|
| 9–10  | System Design framework: capacity estimation, components, trade-offs | Design 1 system/day |
| 11    | SRE-specific design: observability platform, CI/CD at scale, auto-scaling | Your domain = your advantage |
| 12    | Mock interviews + salary negotiation | Pramp.com, Exponent, peers |

**5 System Design problems every SRE must nail:**
1. Design a URL shortener (warmup)
2. Design a monitoring/alerting system (your home turf)
3. Design a CI/CD pipeline at scale
4. Design a multi-region deployment system
5. Design an auto-scaling infrastructure

**Resources:**
- Alex Xu — "System Design Interview Vol 1 & 2"
- ByteByteGo newsletter (free tier)
- GitHub: `donnemartin/system-design-primer` (free)

---

## Company Target List by Salary Band

| Band | Companies | What They Test |
|------|-----------|----------------|
| 25–35 LPA | Mphasis, Persistent, mid-stage startups, EPAM | Basic SRE, K8s ops, CI/CD |
| 35–50 LPA | ThoughtWorks, Freshworks, Atlassian, Walmart Global Tech | System design basics, AWS depth |
| 50–70 LPA | Razorpay, CRED, Zepto, Swiggy, PhonePe, Groww | Deep internals, scale design |
| 60–80 LPA remote | US/EU startups on Wellfound, Himalayas, Remote.com | Strong system design + communication |

**Strategy:** Start applying at 25–35 LPA from Day 10. Use early interviews as practice. Do not wait for perfection.

---

## Daily Schedule

```
Weekday (1.5 hrs):
  30 mins — Read/watch one concept
  30 mins — Write it in your own words (rubber duck it)
  30 mins — Apply/practice (write a command, draw a diagram, answer mock question)

Weekend (2–3 hrs):
  1 hr    — Review week's concepts
  1 hr    — Mock interview practice (talk out loud)
  30 mins — Apply to 5–10 jobs
```

**The rubber duck rule:** If you cannot explain it in plain English, you do not know it yet. Write it down every day.

---

## Salary Negotiation

When you get an offer at 30 LPA, here is how you push to 38–40 LPA:

**Never give a number first:**
> "I'm looking for a significant step up from my current package. I'd love to understand the band for this role first."

**When you receive an offer:**
> "Thank you for the offer. I'm very excited about the role. I was expecting something closer to [X] based on the scope and my experience. Is there any flexibility?"

**Always negotiate.** 80% of companies have room. Most candidates never ask.

---

## Success Metrics

| Milestone | When | Signal |
|-----------|------|--------|
| Resume fixed + LinkedIn updated | Day 7 | Getting recruiter messages |
| First HR call cleared | Day 14–20 | Script works |
| First technical round cleared | Day 25–30 | Basics solid |
| First offer at 28–35 LPA | Month 2 | Plan is working |
| Offer at 50+ LPA | Month 3 | Deep mastery paying off |
| Offer at 70 LPA | Month 3 end | Target achieved |
