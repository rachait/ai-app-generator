const testCases = [
  {
    id: 1,
    category: 'product',
    prompt: 'Build a CRM with login, contacts, dashboard, role-based access, and premium payments',
    expectedToPass: true,
  },
  {
    id: 2,
    category: 'product',
    prompt: 'Build an e-commerce store with products, cart, checkout, and admin panel',
    expectedToPass: true,
  },
  {
    id: 3,
    category: 'product',
    prompt: 'Create a project management tool like Trello with boards, cards, and teams',
    expectedToPass: true,
  },
  {
    id: 4,
    category: 'product',
    prompt: 'Build a hospital management system with patients, doctors, and appointments',
    expectedToPass: true,
  },
  {
    id: 5,
    category: 'product',
    prompt: 'Create a food delivery app with restaurants, menus, orders, and tracking',
    expectedToPass: true,
  },
  {
    id: 6,
    category: 'product',
    prompt: 'Build a learning management system with courses, students, and progress tracking',
    expectedToPass: true,
  },
  {
    id: 7,
    category: 'product',
    prompt: 'Make a real estate listing site with properties, agents, and bookings',
    expectedToPass: true,
  },
  {
    id: 8,
    category: 'product',
    prompt: 'Create an HR management system with employees, payroll, and attendance',
    expectedToPass: true,
  },
  {
    id: 9,
    category: 'product',
    prompt: 'Build a social media platform with posts, likes, comments, and follow actions',
    expectedToPass: true,
  },
  {
    id: 10,
    category: 'product',
    prompt: 'Create inventory management software with products, suppliers, and stock alerts',
    expectedToPass: true,
  },
  {
    id: 11,
    category: 'edge',
    prompt: '',
    expectedToPass: false,
  },
  {
    id: 12,
    category: 'edge',
    prompt: 'todo',
    expectedToPass: false,
  },
  {
    id: 13,
    category: 'edge',
    prompt: 'app with no login but users have profiles',
    expectedToPass: false,
  },
  {
    id: 14,
    category: 'edge',
    prompt: 'build something cool',
    expectedToPass: false,
  },
  {
    id: 15,
    category: 'edge',
    prompt: 'This is a long app description intended to test the pipeline under a very verbose request. It should include many sections such as authentication, onboarding, analytics, billing, support workflows, multi-tenant workspaces, notifications, audit logs, granular permissions, search, reporting, exports, imports, tagging, comments, attachments, activity feeds, task templates, automation rules, integrations, webhooks, scheduled jobs, feature flags, team hierarchies, data retention policies, and compliance controls. The goal is to force the generator to build a broad but coherent system with enough detail to exercise the architecture, schema, and refinement stages. It should also mention mobile responsiveness, admin controls, and a polished dashboard experience. The app should support several distinct user journeys, including signup, invitations, profile management, content management, approval flows, and usage-based billing. It should also account for settings pages, help center content, and support for internal operators. The generator should infer missing details and maintain consistency across every layer of the output while still producing a valid JSON response that matches the requested schema exactly. Additional modules include observability, email delivery, background processing, data import queues, role audit trails, and a support inbox. The app should be enterprise-ready and extendable.',
    expectedToPass: true,
  },
  {
    id: 16,
    category: 'edge',
    prompt: '🚀📊💳',
    expectedToPass: false,
  },
  {
    id: 17,
    category: 'edge',
    prompt: 'everyone is admin',
    expectedToPass: false,
  },
  {
    id: 18,
    category: 'edge',
    prompt: 'app with payments',
    expectedToPass: false,
  },
  {
    id: 19,
    category: 'edge',
    prompt: 'एक CRM बनाओ',
    expectedToPass: false,
  },
  {
    id: 20,
    category: 'edge',
    prompt: 'build Facebook',
    expectedToPass: false,
  },
];

module.exports = testCases;

if (require.main === module) {
  console.log(JSON.stringify(testCases, null, 2));
}