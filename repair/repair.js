const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

function isEnabled(value, defaultValue = false) {
  if (typeof value === 'undefined') {
    return defaultValue;
  }

  return String(value).toLowerCase() === 'true';
}

function stringifyValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function extractClaudeText(responseData) {
  if (!responseData || !Array.isArray(responseData.content)) {
    return '';
  }

  return responseData.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim();
}

function tryParseJSON(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function extractJSONAfterMarker(userText, marker) {
  if (!userText || !marker) {
    return null;
  }

  const markerIndex = userText.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const jsonCandidate = userText.slice(markerIndex + marker.length).trim();
  return tryParseJSON(jsonCandidate);
}

function inferAppNameFromPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return 'Generated App';
  }

  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return 'Generated App';
  }

  if (/crm/i.test(clean)) {
    return 'CRM Pro';
  }

  const words = clean.split(' ').slice(0, 3);
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return `${title} App`;
}

function buildStage1Mock(user) {
  const marker = 'User app description:';
  const prompt = user.includes(marker) ? user.slice(user.indexOf(marker) + marker.length).trim() : user;
  const appName = inferAppNameFromPrompt(prompt);

  return {
    appName,
    entities: ['User', 'Customer', 'Contact', 'Deal', 'Activity'],
    roles: ['admin', 'manager', 'agent'],
    features: ['auth', 'dashboard', 'contacts', 'pipeline', 'notes'],
    hasPayments: /payment|billing|subscription|invoice|checkout/i.test(prompt),
    hasAuth: true,
    assumptions: [
      'The app is a web-based SaaS product.',
      'Primary users need role-based access control.',
      'Contacts and deals are the core business objects.',
    ],
  };
}

function buildStage2Mock(user) {
  const intent = extractJSONAfterMarker(user, 'Stage 1 output:') || buildStage1Mock(user);
  const roles = Array.isArray(intent.roles) && intent.roles.length > 0 ? intent.roles : ['admin'];

  return {
    pages: [
      { name: 'Login', route: '/login', accessRoles: roles },
      { name: 'Dashboard', route: '/dashboard', accessRoles: roles },
      { name: 'Contacts', route: '/contacts', accessRoles: roles },
      { name: 'Deals', route: '/deals', accessRoles: roles },
    ],
    apiEndpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Authenticate user credentials' },
      { method: 'GET', path: '/api/contacts', description: 'List contacts' },
      { method: 'POST', path: '/api/contacts', description: 'Create contact' },
      { method: 'GET', path: '/api/deals', description: 'List deals' },
      { method: 'POST', path: '/api/deals', description: 'Create deal' },
    ],
    dbTables: [
      { name: 'users', fields: ['id', 'email', 'password_hash', 'role', 'created_at'] },
      { name: 'contacts', fields: ['id', 'name', 'email', 'phone', 'owner_id', 'created_at'] },
      { name: 'deals', fields: ['id', 'title', 'value', 'stage', 'contact_id', 'owner_id', 'created_at'] },
    ],
  };
}

function buildStage3Mock(user) {
  const design = extractJSONAfterMarker(user, 'Stage 2 output:') || buildStage2Mock(user);
  const pages = Array.isArray(design.pages) ? design.pages : [];
  const endpoints = Array.isArray(design.apiEndpoints) ? design.apiEndpoints : [];

  return {
    uiSchema: {
      pages: pages.map((page) => ({
        name: page.name,
        route: page.route,
        accessRoles: Array.isArray(page.accessRoles) ? page.accessRoles : ['admin'],
        components: ['Header', 'DataTable', 'FormModal'],
        fields: ['name', 'email', 'phone'],
        actions: ['create', 'update', 'delete'],
      })),
    },
    apiSchema: {
      endpoints: endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        requestBody: endpoint.method === 'GET' || endpoint.method === 'DELETE'
          ? null
          : { type: 'object', required: ['name'] },
        response: { type: 'object', properties: { success: { type: 'boolean' } } },
      })),
    },
    dbSchema: {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'email', type: 'varchar' },
            { name: 'password_hash', type: 'varchar' },
            { name: 'role', type: 'varchar' },
            { name: 'created_at', type: 'timestamp' },
          ],
        },
        {
          name: 'contacts',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'name', type: 'varchar' },
            { name: 'email', type: 'varchar' },
            { name: 'phone', type: 'varchar' },
            { name: 'owner_id', type: 'uuid' },
            { name: 'created_at', type: 'timestamp' },
          ],
        },
        {
          name: 'deals',
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'title', type: 'varchar' },
            { name: 'value', type: 'decimal' },
            { name: 'stage', type: 'varchar' },
            { name: 'contact_id', type: 'uuid' },
            { name: 'owner_id', type: 'uuid' },
            { name: 'created_at', type: 'timestamp' },
          ],
        },
      ],
    },
    authSchema: {
      roles: ['admin', 'manager', 'agent'],
      permissions: {
        admin: ['*'],
        manager: ['contacts:read', 'contacts:write', 'deals:read', 'deals:write'],
        agent: ['contacts:read', 'contacts:write', 'deals:read'],
      },
    },
  };
}

function buildStage4Mock(user) {
  const schema = extractJSONAfterMarker(user, 'Stage 3 output:') || buildStage3Mock(user);
  return {
    ...schema,
    consistencyReport: [],
  };
}

function detectStageFromPrompt(user = '') {
  if (/appName, entities, roles, features, hasPayments, hasAuth, assumptions/i.test(user)) {
    return 'stage1';
  }

  if (/exact keys: pages, apiEndpoints, dbTables/i.test(user)) {
    return 'stage2';
  }

  if (/exact keys: uiSchema, apiSchema, dbSchema, authSchema/i.test(user)) {
    return 'stage3';
  }

  if (/consistencyReport/i.test(user) || /Check the full schema for cross-layer consistency/i.test(user)) {
    return 'stage4';
  }

  return 'unknown';
}

function buildMockForPrompt(user = '') {
  const stage = detectStageFromPrompt(user);

  if (stage === 'stage1') {
    return buildStage1Mock(user);
  }

  if (stage === 'stage2') {
    return buildStage2Mock(user);
  }

  if (stage === 'stage3') {
    return buildStage3Mock(user);
  }

  if (stage === 'stage4') {
    return buildStage4Mock(user);
  }

  return { message: 'mock response', stage };
}

function isLowCreditErrorMessage(message = '') {
  const normalized = String(message).toLowerCase();
  return normalized.includes('credit balance is too low')
    || normalized.includes('plans & billing')
    || normalized.includes('purchase credits');
}

function maybeReturnMockFromError(message, user) {
  const allowCreditFallback = isEnabled(process.env.ALLOW_MOCK_ON_LOW_CREDIT, true);
  if (!allowCreditFallback || !isLowCreditErrorMessage(message)) {
    return null;
  }

  console.warn('Anthropic low-credit detected. Falling back to mock pipeline output.');
  return JSON.stringify(buildMockForPrompt(user), null, 2);
}

async function callClaudeRaw({ system, user, maxTokens = 6000, temperature = 0.2 }) {
  const forceMockMode = isEnabled(process.env.MOCK_MODE, false);
  if (forceMockMode) {
    return JSON.stringify(buildMockForPrompt(user), null, 2);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'your_key_here') {
    console.warn('ANTHROPIC_API_KEY is not set. Using deterministic mock output so the generator remains functional.');
    return JSON.stringify(buildMockForPrompt(user), null, 2);
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available in this Node.js runtime.');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system,
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: user,
        },
      ],
    }),
  });

  const responseText = await response.text();
  let responseData = {};

  try {
    responseData = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    responseData = { raw: responseText };
  }

  if (!response.ok) {
    const apiMessage = responseData && responseData.error && responseData.error.message
      ? responseData.error.message
      : responseText;

    const mockResponse = maybeReturnMockFromError(apiMessage, user);
    if (mockResponse) {
      return mockResponse;
    }

    throw new Error(`Claude API request failed (${response.status}): ${apiMessage}`);
  }

  const text = extractClaudeText(responseData);

  if (!text) {
    throw new Error('Claude API returned no text content.');
  }

  return text;
}

async function repairStage(originalInput, brokenOutput, errorMessage, stageInstructions) {
  console.log(`Repairing stage. Error: ${errorMessage}`);

  const system = [
    'You are a JSON repair engine for a multi-stage AI app generator.',
    'Fix only the broken JSON for the current stage.',
    'Do not regenerate the whole pipeline.',
    'Preserve the intended structure and field names as much as possible.',
    'Return ONLY raw JSON. No markdown. No explanation.',
  ].join(' ');

  const user = [
    'Original stage instructions:',
    stringifyValue(stageInstructions),
    '',
    'Original input:',
    stringifyValue(originalInput),
    '',
    'Broken output:',
    stringifyValue(brokenOutput),
    '',
    'Error message:',
    stringifyValue(errorMessage),
    '',
    'Fix ONLY the broken JSON. Return ONLY raw JSON. No markdown. No explanation.',
  ].join('\n');

  return callClaudeRaw({
    system,
    user,
    maxTokens: 4000,
    temperature: 0,
  });
}

module.exports = {
  callClaudeRaw,
  repairStage,
};