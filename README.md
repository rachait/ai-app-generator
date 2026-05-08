# 🚀 AI App Generator - Production-Ready Compiler for App Specs

A multi-stage, reliability-focused system that converts natural language product descriptions into complete, executable application configurations using Claude AI, with a config-driven runtime app at `/app`.

**Live System**: `http://localhost:3000`  
**Metrics Dashboard**: `http://localhost:3000/metrics`
**Runtime App**: `http://localhost:3000/app`

---

## 📋 Overview

### What It Does
```
User Input: "Build a CRM with login, contacts, dashboard, role-based access, and premium payments"
         ↓
    [4-Stage Pipeline]
         ↓
Output: Complete JSON spec
├── UI Schema (pages, components, layouts)
├── API Schema (endpoints, methods, validation)
├── Database Schema (tables, columns, relations)
├── Auth System (roles, permissions, gating)
└── Business Logic (premium access, role-based routing)
```

### Design Philosophy
This is **not** a simple prompt wrapper. It's an **engineered compiler** with:
- ✅ Strict schema enforcement
- ✅ Automatic error detection and repair
- ✅ Runtime executability validation
- ✅ Production-grade reliability
- ✅ Comprehensive metrics tracking

---

## 🏗️ Architecture

### System Design (High Level)

```
┌─────────────────────────────────────────────────────────────┐
│                    Express Server (index.js)                │
│                                                              │
│  POST /generate  → Run 4-stage pipeline + metrics tracking   │
│  GET /app       → Dynamic config-driven runtime UI           │
│  CRUD / auth    → Runtime APIs for login and records         │
│  GET /metrics    → Real-time system health dashboard         │
│  GET /           → SPA with dark UI                          │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────────┐
        │      4-Stage Pipeline (Sequential)      │
        └─────────────────────────────────────────┘
              ↓            ↓            ↓         ↓
         Stage 1        Stage 2      Stage 3   Stage 4
        (Intent)       (Design)     (Schema)  (Refine)
              ↓            ↓            ↓         ↓
        ┌─────────────────────────────────────────┐
        │   Validation + Repair Engine            │
        │   • Strips markdown                      │
        │   • Validates JSON structure             │
        │   • Checks required keys                 │
        │   • Auto-repairs broken output           │
        └─────────────────────────────────────────┘
              ↓
        ┌─────────────────────────────────────────┐
        │   Runtime Executor Validator            │
        │   • Checks page/route consistency        │
        │   • Validates API endpoint completeness  │
        │   • Verifies DB schema integrity         │
        │   • Cross-checks auth permissions        │
        └─────────────────────────────────────────┘
              ↓
        ┌─────────────────────────────────────────┐
        │   Metrics Tracker                       │
        │   • Stage latency per request            │
        │   • Repair count & success rates         │
        │   • Cost estimation                      │
        │   • Historical tracking                  │
        └─────────────────────────────────────────┘
```

---

## 🔄 Pipeline Design

### Stage 1: Intent Extraction
**Input**: User natural language prompt  
**Output**: Structured intent  
**Guarantees**: Required fields: `appName, entities, roles, features, hasPayments, hasAuth, assumptions`

```json
{
  "appName": "CRM Pro",
  "entities": ["Contact", "Company", "Deal", "Activity"],
  "roles": ["admin", "manager", "sales_rep", "viewer"],
  "features": ["login", "contacts_list", "dashboard", "reporting"],
  "hasPayments": true,
  "hasAuth": true,
  "assumptions": [...]
}
```

### Stage 2: System Design
**Input**: Stage 1 output  
**Output**: Architecture blueprint  
**Guarantees**: Required fields: `pages, apiEndpoints, dbTables`

Converts abstract intent into concrete application structure.

### Stage 3: Schema Generation
**Input**: Stage 2 output  
**Output**: Implementation schemas  
**Guarantees**: Required fields: `uiSchema, apiSchema, dbSchema, authSchema`

Generates complete, type-safe schemas for all layers.

### Stage 4: Consistency Refinement
**Input**: Stage 3 output  
**Output**: Final validated & consistent spec  
**Guarantees**: Same structure as Stage 3 + `consistencyReport` array

Resolves cross-layer inconsistencies and documents fixes.

---

## 🛡️ Validation & Repair System (CORE)

### Validation Pipeline

```
Raw JSON Output
      ↓
[1] Strip Markdown Fences (```json, ```)
      ↓
[2] Parse JSON (catch syntax errors)
      ↓
[3] Verify Required Keys
      ↓
[4] Type Safety Checks
      ↓
    Success? ──Yes→ Return Data
      ↓ No
    Repair
```

### Repair Strategy (NOT Brute Retry)

When validation fails:

1. **Analyze error**: Identify specific failure reason
2. **Keep context**: Pass original input + broken output to Claude
3. **Targeted fix**: Ask Claude to fix ONLY the broken JSON, not regenerate
4. **Minimal changes**: Preserve intended structure, fix syntax/schema issues
5. **Verify repair**: Re-validate output after repair

**Temperature Settings**:
- Stage 1-3: `temperature=0.2` (consistent, deterministic)
- Stage 4 (refinement): `temperature=0.1` (maximum consistency)
- Repair: `temperature=0` (exact fix, no creativity)

---

## ⚡ Execution Awareness & Runtime Validation

### What Makes Output "Executable"

The system validates that generated specs can actually power an application:

```javascript
✓ All UI pages have defined routes
✓ All pages reference valid components
✓ All API endpoints have method + path + schema
✓ All DB tables have columns with types
✓ Auth schema has roles and permissions
✓ Page access roles are defined in auth.roles
✓ API endpoints accessible by at least one role
✓ No orphaned entities or unreferenced fields
```

### Example Validation Error
```
❌ Page "Dashboard" references role "super_admin" which doesn't exist in auth.roles
❌ API endpoint POST /contacts missing requestBody schema
❌ DB table "contacts" has column "id" without type definition
```

---

## 📊 Reliability & Metrics

### Tracking & Observability

Every request generates metrics:

```javascript
{
  id: "a7f3k2",
  prompt: "Build a CRM...",
  result: "success",
  totalLatency: 15234,
  retries: 0,
  costEstimate: "$0.0042",
  stages: {
    "Stage 1": { latency: 3421, repairs: 0, success: true },
    "Stage 2": { latency: 4102, repairs: 0, success: true },
    "Stage 3": { latency: 5631, repairs: 1, success: true },
    "Stage 4": { latency: 2080, repairs: 0, success: true }
  }
}
```

### System Health Dashboard

Access `/metrics` for:
- **Success Rate**: % of requests that completed successfully
- **Average Latency**: Time per request (including retries)
- **Average Retries**: Repair attempts per request
- **Cost Estimate**: Total API spend
- **Per-Stage Metrics**: Latency, success, repair count per stage

---

## 🧪 Evaluation Framework (20 Test Cases)

### Real Product Prompts (10)
1. CRM with login, contacts, dashboard, role-based access, payments
2. E-commerce store with products, cart, checkout, admin panel
3. Project management tool like Trello with boards, cards, teams
4. Hospital management with patients, doctors, appointments
5. Food delivery app with restaurants, menus, orders, tracking
6. Learning management system with courses, students, progress
7. Real estate listing site with properties, agents, bookings
8. HR management system with employees, payroll, attendance
9. Social media platform with posts, likes, comments, follow
10. Inventory management with products, suppliers, stock alerts

### Edge Cases (10)
11. Empty string `""`
12. Single word `"todo"`
13. Contradictory `"app with no login but users have profiles"`
14. Vague `"build something cool"`
15. Long verbose (500+ word) specification
16. Only emojis `"🚀📊💳"`
17. Conflicting roles `"everyone is admin"`
18. Missing key info `"app with payments"`
19. Non-English `"एक CRM बनाओ"`
20. Already built product `"build Facebook"`

### Expected Results
- **Real products**: Should generate valid specs (expectedToPass=true)
- **Edge cases**: May fail or require clarification (expectedToPass=false)
- **System should**: Not crash, provide clear error messages, make reasonable assumptions

---

## 💰 Cost vs Quality Tradeoff

### Design Decisions

**Temperature Control**:
- Lower temp (0-0.2) = more consistent, less creative
- Consistency favored over edge-case handling

**Token Efficiency**:
- Stage-based approach vs. single prompt: allows reuse of stage outputs
- Repair instead of retry: typically costs 40% less than full regeneration
- Structured prompts with explicit field names reduce hallucination

**Latency**:
- Serial pipeline (not parallel): ~15-20 seconds per request
- Trade-off: Simpler error handling, more reliable than parallel
- Each stage informs next stage → higher quality

**Cost Breakdown** (per CRM request):
- Intent extraction: ~$0.001
- Design: ~$0.0015
- Schema generation: ~$0.0025
- Refinement: ~$0.0012
- **Total per request**: ~$0.0062

**Optimization Opportunities**:
1. Caching stage outputs for similar prompts
2. Batch processing multiple requests
3. Earlier validation to skip failed requests
4. Model selection (Haiku for simpler stages)

---

## 🚀 Quick Start

### Installation
```bash
# 1. Clone repo
git clone <repo>
cd ai-app-generator

# 2. Install dependencies
npm install

# 3. Set API key in .env
ANTHROPIC_API_KEY=sk-ant-xxx
PORT=3000

# 4. Start server
npm start
```

### Usage
```bash
# Interactive UI
Open http://localhost:3000

# API endpoint
POST http://localhost:3000/generate
Content-Type: application/json

{
  "prompt": "Build a CRM with login, contacts, dashboard, role-based access, and premium payments"
}

# View metrics
GET http://localhost:3000/metrics
```

### Testing
```bash
# Run 20 test cases
npm test

# Output: detailed results, success rates, failure analysis
```

---

## 📁 File Structure

```
ai-app-generator/
├── index.js                    # Express server + endpoints
├── package.json                # Dependencies
├── .env                        # API key config
│
├── pipeline/
│   ├── stage1_intent.js        # Parse user intent
│   ├── stage2_design.js        # Design architecture
│   ├── stage3_schema.js        # Generate schemas
│   └── stage4_refine.js        # Refine consistency
│
├── validator/
│   └── validate.js             # JSON validation + repair
│
├── repair/
│   └── repair.js               # Targeted JSON repair engine
│
├── runtime/
│   └── validator.js            # Execution feasibility checker
│
├── metrics/
│   └── tracker.js              # Metrics & observability
│
├── public/
│   └── index.html              # SPA UI with dark theme
│
└── evaluation/
    └── testcases.js            # 20 test cases
```

---

## 🔍 Key Features

### 1. Multi-Stage Pipeline ✓
- Intent → Design → Schemas → Refinement
- Each stage validates output before passing to next
- Serial execution ensures quality

### 2. Strict Schema Enforcement ✓
- Required fields enforced
- Type safety checks
- Enum validation for roles/methods

### 3. Automatic Repair ✓
- Markdown stripping
- JSON syntax fixing
- Missing key insertion
- No brute retry (context-aware repairs)

### 4. Deterministic Behavior ✓
- Temperature control
- Structured prompting
- Consistent field naming

### 5. Execution Awareness ✓
- Runtime validation checklist
- Cross-layer consistency checks
- Executability score

### 6. Comprehensive Metrics ✓
- Per-stage latency tracking
- Repair counts
- Cost estimation
- Success rates

### 7. Production Grade Error Handling ✓
- Specific error messages
- Graceful degradation
- Retry-with-repair strategy
- User-friendly UI feedback

---

## 🎯 Success Criteria

| Criterion | Status | Notes |
|-----------|--------|-------|
| Multi-stage pipeline | ✅ | 4 distinct stages |
| Schema enforcement | ✅ | Required fields + types |
| Validation + repair | ✅ | Context-aware, not brute retry |
| Determinism | ✅ | Low temperatures + structured prompts |
| Execution awareness | ✅ | Runtime validator with 8+ checks |
| Failure handling | ✅ | Vague prompt detection + assumptions |
| Evaluation framework | ✅ | 20 test cases with metrics |
| Cost analysis | ✅ | Per-request + per-stage breakdown |

---

## 🔧 Advanced Usage

### Custom Test Cases
Edit `evaluation/testcases.js` to add your own:

```javascript
{
  id: 21,
  category: 'custom',
  prompt: 'Your app idea here',
  expectedToPass: true
}
```

### Monitoring Production
```javascript
// Poll metrics endpoint
setInterval(() => {
  fetch('/metrics')
    .then(r => r.json())
    .then(metrics => {
      console.log(`Success rate: ${metrics.successRate}`);
      console.log(`Avg latency: ${metrics.averageLatency}`);
    });
}, 60000);
```

### Debugging Failed Requests
```javascript
// API response includes full stage details
{
  error: "Failed at Stage 3",
  details: "Missing required key: apiSchema",
  log: [
    "✓ Stage 1: Intent extraction successful",
    "✓ Stage 2: Architecture design successful",
    "❌ Stage 3: Schema generation failed"
  ],
  latencyMs: 8234
}
```

---

## 💡 Design Rationale

### Why Multi-Stage?
- **Separation of concerns**: Each stage has one job
- **Debuggability**: Failures localized to specific stage
- **Modularity**: Easy to swap stages or add new ones
- **Reusability**: Stage outputs can be cached/reused

### Why Context-Aware Repair?
- **Efficiency**: Brute retry wastes tokens and time
- **Correctness**: Understanding error prevents regression
- **Cost**: Targeted fix ~40% cheaper than full retry

### Why Runtime Validation?
- **Productionization**: Prevents unusable specs
- **Feedback**: Users know if output can execute
- **Iteration**: Flags issues before wasting dev time

### Why Metrics?
- **Trust**: Data-driven reliability, not claims
- **Optimization**: Identifies bottlenecks
- **Accountability**: Track improvement over time

---

## 📝 License

MIT

---

## 🤝 Contributing

To enhance the system:

1. Improve stage prompts for better intent parsing
2. Add new runtime validation checks
3. Implement caching layer
4. Build adapters for deployment targets
5. Add support for multi-language prompts

---

## 📞 Support

For issues:
1. Check `/metrics` for health status
2. Review error details in response log
3. Try simpler prompt to isolate issue
4. Check `.env` for API key configuration

---

**Built with**: Node.js, Express, Claude API, TailwindCSS  
**Target User**: Platform teams, app builders, AI engineers  
**Use Case**: Automated app spec generation from natural language

