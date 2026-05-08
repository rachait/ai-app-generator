require('dotenv').config();
const express = require('express');
const path = require('path');
const { stage1Intent } = require('./pipeline/stage1_intent');
const { stage2Design } = require('./pipeline/stage2_design');
const { stage3Schema } = require('./pipeline/stage3_schema');
const { stage4Refine } = require('./pipeline/stage4_refine');
const { validateRuntimeExecutability } = require('./runtime/validator');
const { MetricsTracker } = require('./metrics/tracker');
const { getRuntimeConfig, getPublicRuntimeConfig } = require('./runtime/config');
const {
  createSession,
  destroySession,
  getSession,
  readStore,
  updateStore,
  nextEntityId,
  addNotification,
  getVisibleRecords,
} = require('./runtime/store');

const app = express();
const PORT = process.env.PORT || 3000;
const metricsTracker = new MetricsTracker();

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  const pairs = cookieHeader.split(';').map((item) => item.trim()).filter(Boolean);
  const cookies = {};

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = decodeURIComponent(pair.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(pair.slice(separatorIndex + 1).trim());
    cookies[key] = value;
  }

  return cookies;
}

function getCurrentUser(req) {
  const sessionId = parseCookies(req).sid;
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const config = getRuntimeConfig();
  const user = config.auth.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function requireRuntimeAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.runtimeUser = user;
  next();
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}

function getEntityConfig(entityId) {
  const config = getRuntimeConfig();
  return config.entities.find((entity) => entity.id === entityId) || null;
}

function normalizeScalarValue(field, value) {
  if (value === undefined || value === null || value === '') {
    if (field.default !== undefined) {
      return { value: field.default };
    }

    if (field.required) {
      return { error: `Field ${field.name} is required` };
    }

    return { value: null };
  }

  if (field.type === 'boolean') {
    if (typeof value === 'boolean') {
      return { value };
    }

    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return { value: true };
      }
      if (['false', '0', 'no', 'off'].includes(normalized)) {
        return { value: false };
      }
    }

    return { error: `Field ${field.name} must be boolean` };
  }

  if (field.type === 'number') {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return { error: `Field ${field.name} must be numeric` };
    }
    return { value: parsed };
  }

  if (field.type === 'select') {
    const option = String(value);
    if (Array.isArray(field.options) && field.options.length > 0 && !field.options.includes(option)) {
      return { error: `Field ${field.name} must be one of: ${field.options.join(', ')}` };
    }
    return { value: option };
  }

  return { value: String(value) };
}

function normalizeRecordInput(entity, input, existingRecord = null) {
  const payload = input && typeof input === 'object' ? input : {};
  const errors = [];
  const record = existingRecord ? { ...existingRecord } : {};
  const extra = payload.extra && typeof payload.extra === 'object' ? { ...payload.extra } : {};
  const fieldMap = new Map(entity.fields.map((field) => [field.name, field]));

  for (const field of entity.fields) {
    const incomingValue = Object.prototype.hasOwnProperty.call(payload, field.name)
      ? payload[field.name]
      : record[field.name];
    const normalized = normalizeScalarValue(field, incomingValue);

    if (normalized.error) {
      errors.push(normalized.error);
      continue;
    }

    record[field.name] = normalized.value;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!fieldMap.has(key) && key !== 'extra' && key !== 'id' && key !== 'ownerId' && key !== 'createdAt' && key !== 'updatedAt') {
      extra[key] = value;
    }
  }

  record.extra = extra;
  return { record, errors };
}

function parseCsvRows(csvText) {
  const text = String(csvText || '').trim();
  if (!text) {
    return [];
  }

  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if ((char === ',' || char === ';') && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows.shift().map((cell) => cell.trim());
  return rows.map((cells) => {
    const rowObject = {};
    headers.forEach((header, headerIndex) => {
      rowObject[header] = cells[headerIndex] || '';
    });
    return rowObject;
  });
}

function analyzePromptQuality(prompt) {
  const cleanPrompt = String(prompt || '').trim();
  const lowerPrompt = cleanPrompt.toLowerCase();
  const wordCount = cleanPrompt ? cleanPrompt.split(/\s+/).filter(Boolean).length : 0;

  if (!/[a-z]/i.test(cleanPrompt)) {
    return {
      blocked: true,
      reason: 'Prompt needs a clearer business description.',
    };
  }

  if (/[\u0900-\u097F]/.test(cleanPrompt) && wordCount <= 4) {
    return {
      blocked: true,
      reason: 'Please provide the request in a supported language or add more detail.',
    };
  }

  if (/everyone is admin/i.test(cleanPrompt)) {
    return {
      blocked: true,
      reason: 'Conflicting access rules: everyone cannot be admin.',
    };
  }

  if (/no login/i.test(cleanPrompt) && /users?|profiles?/i.test(cleanPrompt)) {
    return {
      blocked: true,
      reason: 'Conflicting auth requirements: login is disabled but user profiles are required.',
    };
  }

  if (/build\s+(facebook|instagram|whatsapp|twitter|youtube|tiktok|gmail|uber|airbnb|amazon|netflix)\b/i.test(cleanPrompt)) {
    return {
      blocked: true,
      reason: 'Please describe a new app instead of cloning an existing product.',
    };
  }

  if (/\b(something|thing|stuff|cool|nice|good|awesome)\b/i.test(cleanPrompt) && wordCount <= 4) {
    return {
      blocked: true,
      reason: 'Prompt too vague. Please provide a specific app domain and workflow.',
    };
  }

  if (/\bapp with payments\b/i.test(cleanPrompt) || (/\bpayments?\b/i.test(cleanPrompt) && wordCount <= 4)) {
    return {
      blocked: true,
      reason: 'Please specify the app domain and payment flow.',
    };
  }

  return {
    blocked: false,
    vague: /\b(something|thing|app|stuff)\s+(cool|nice|good|awesome)\b/i.test(cleanPrompt) || /^\s*(build|make|create)\s+\w+\s*$/i.test(cleanPrompt),
  };
}

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'runtime.html'));
});

app.get('/api/runtime/config', (req, res) => {
  res.json(getPublicRuntimeConfig());
});

app.get('/api/auth/session', (req, res) => {
  const user = getCurrentUser(req);
  res.json({ user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const config = getRuntimeConfig();
  const user = config.auth.users.find((candidate) => candidate.email === email && candidate.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sid = createSession(user);
  setSessionCookie(res, sid);

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = parseCookies(req).sid;
  destroySession(sid);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.get('/api/data/:entityId', requireRuntimeAuth, (req, res) => {
  const entity = getEntityConfig(req.params.entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Unknown entity' });
  }

  const store = readStore();
  const records = getVisibleRecords(store, entity.id, req.runtimeUser);
  res.json({ entity: entity.id, records });
});

app.post('/api/data/:entityId', requireRuntimeAuth, (req, res) => {
  const entity = getEntityConfig(req.params.entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Unknown entity' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const { record, errors } = normalizeRecordInput(entity, payload);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const result = updateStore((store) => {
    const storedRecord = {
      id: nextEntityId(store, entity.id),
      ownerId: entity.scoped ? req.runtimeUser.id : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...record,
    };

    if (!Array.isArray(store.records[entity.id])) {
      store.records[entity.id] = [];
    }

    store.records[entity.id].unshift(storedRecord);
    addNotification(store, {
      userId: req.runtimeUser.id,
      type: 'create',
      message: `${entity.id} record created`,
      entityId: entity.id,
      recordId: storedRecord.id,
    });

    return storedRecord;
  });

  res.status(201).json({ record: result });
});

app.patch('/api/data/:entityId/:recordId', requireRuntimeAuth, (req, res) => {
  const entity = getEntityConfig(req.params.entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Unknown entity' });
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const result = updateStore((store) => {
    const records = Array.isArray(store.records[entity.id]) ? store.records[entity.id] : [];
    const existingRecord = records.find((item) => item.id === req.params.recordId);

    if (!existingRecord) {
      return { error: 'Record not found' };
    }

    if (entity.scoped && req.runtimeUser.role !== 'admin' && existingRecord.ownerId !== req.runtimeUser.id) {
      return { error: 'Forbidden' };
    }

    const { record, errors } = normalizeRecordInput(entity, payload, existingRecord);
    if (errors.length > 0) {
      return { error: 'Validation failed', details: errors };
    }

    record.id = existingRecord.id;
    record.ownerId = existingRecord.ownerId;
    record.createdAt = existingRecord.createdAt;
    record.updatedAt = new Date().toISOString();

    const index = records.findIndex((item) => item.id === existingRecord.id);
    records[index] = record;
    store.records[entity.id] = records;
    addNotification(store, {
      userId: req.runtimeUser.id,
      type: 'update',
      message: `${entity.id} record updated`,
      entityId: entity.id,
      recordId: record.id,
    });

    return { record };
  });

  if (result.error) {
    const status = result.error === 'Forbidden' ? 403 : 400;
    return res.status(status).json(result);
  }

  res.json(result);
});

app.delete('/api/data/:entityId/:recordId', requireRuntimeAuth, (req, res) => {
  const entity = getEntityConfig(req.params.entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Unknown entity' });
  }

  const result = updateStore((store) => {
    const records = Array.isArray(store.records[entity.id]) ? store.records[entity.id] : [];
    const existingRecord = records.find((item) => item.id === req.params.recordId);

    if (!existingRecord) {
      return { error: 'Record not found' };
    }

    if (entity.scoped && req.runtimeUser.role !== 'admin' && existingRecord.ownerId !== req.runtimeUser.id) {
      return { error: 'Forbidden' };
    }

    store.records[entity.id] = records.filter((item) => item.id !== existingRecord.id);
    addNotification(store, {
      userId: req.runtimeUser.id,
      type: 'delete',
      message: `${entity.id} record deleted`,
      entityId: entity.id,
      recordId: existingRecord.id,
    });

    return { success: true };
  });

  if (result.error) {
    const status = result.error === 'Forbidden' ? 403 : 400;
    return res.status(status).json(result);
  }

  res.json(result);
});

app.post('/api/import/:entityId', requireRuntimeAuth, (req, res) => {
  const entity = getEntityConfig(req.params.entityId);
  if (!entity) {
    return res.status(404).json({ error: 'Unknown entity' });
  }

  const csvText = req.body && typeof req.body.csv === 'string' ? req.body.csv : '';
  const rows = parseCsvRows(csvText);

  if (rows.length === 0) {
    return res.status(400).json({ error: 'CSV payload is empty or invalid' });
  }

  const imported = [];
  const errors = [];

  updateStore((store) => {
    for (const row of rows) {
      const { record, errors: rowErrors } = normalizeRecordInput(entity, row);
      if (rowErrors.length > 0) {
        errors.push({ row, errors: rowErrors });
        continue;
      }

      const storedRecord = {
        id: nextEntityId(store, entity.id),
        ownerId: entity.scoped ? req.runtimeUser.id : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...record,
      };

      if (!Array.isArray(store.records[entity.id])) {
        store.records[entity.id] = [];
      }

      store.records[entity.id].unshift(storedRecord);
      imported.push(storedRecord);
    }

    addNotification(store, {
      userId: req.runtimeUser.id,
      type: 'import',
      message: `${imported.length} ${entity.id} rows imported`,
      entityId: entity.id,
    });
  });

  res.json({ importedCount: imported.length, errorCount: errors.length, records: imported, errors });
});

app.get('/api/notifications', requireRuntimeAuth, (req, res) => {
  const store = readStore();
  const notifications = req.runtimeUser.role === 'admin'
    ? store.notifications
    : store.notifications.filter((notification) => notification.userId === req.runtimeUser.id);

  res.json({ notifications });
});

// POST /generate endpoint
app.post('/generate', async (req, res) => {
  const request = metricsTracker.startRequest(req.body.prompt || '');
  const startTime = Date.now();
  const log = [];

  try {
    const { prompt } = req.body;

    // Validate prompt length and clarity
    if (!prompt || prompt.length < 5) {
      request.error = 'Prompt too vague';
      metricsTracker.finishRequest(request, false, request.error);
      return res.status(400).json({
        error: 'Prompt too vague. Please provide at least 5 characters describing your app.',
        log,
        latencyMs: Date.now() - startTime
      });
    }

    const promptQuality = analyzePromptQuality(prompt);
    if (promptQuality.blocked) {
      request.error = promptQuality.reason;
      metricsTracker.finishRequest(request, false, request.error);
      return res.status(400).json({
        error: promptQuality.reason,
        log,
        latencyMs: Date.now() - startTime
      });
    }

    // Warning: detect potentially vague prompts
    if (promptQuality.vague) {
      log.push('⚠️  Prompt appears vague - will make reasonable assumptions');
    }

    // Stage 1: Extract Intent
    try {
      metricsTracker.recordStageStart(request, 'Stage 1');
      const intent = await stage1Intent(prompt);
      metricsTracker.recordStageSuccess(request, 'Stage 1');
      log.push('✓ Stage 1: Intent extraction successful');
      
      // Stage 2: Design Architecture
      try {
        metricsTracker.recordStageStart(request, 'Stage 2');
        const design = await stage2Design(intent);
        metricsTracker.recordStageSuccess(request, 'Stage 2');
        log.push('✓ Stage 2: Architecture design successful');
        
        // Stage 3: Generate Schemas
        try {
          metricsTracker.recordStageStart(request, 'Stage 3');
          const schema = await stage3Schema(design);
          metricsTracker.recordStageSuccess(request, 'Stage 3');
          log.push('✓ Stage 3: Schema generation successful');
          
          // Stage 4: Refine and Validate
          try {
            metricsTracker.recordStageStart(request, 'Stage 4');
            const finalSchema = await stage4Refine(schema);
            metricsTracker.recordStageSuccess(request, 'Stage 4');
            log.push('✓ Stage 4: Consistency refinement successful');
            
            // Runtime validation - check if output is actually executable
            const runtimeCheck = validateRuntimeExecutability(finalSchema);
            if (!runtimeCheck.isExecutable) {
              log.push(`⚠️  Runtime validation: ${runtimeCheck.issues.length} issue(s) found`);
              runtimeCheck.issues.forEach(issue => log.push(`  - ${issue}`));
            } else {
              log.push('✓ Runtime validation: Output is executable');
            }
            
            const latencyMs = Date.now() - startTime;
            metricsTracker.finishRequest(request, true);
            
            return res.json({
              success: true,
              latencyMs,
              log,
              intent,
              design,
              finalSchema,
              runtimeValidation: runtimeCheck
            });
          } catch (err) {
            metricsTracker.recordStageFail(request, 'Stage 4');
            const latencyMs = Date.now() - startTime;
            metricsTracker.finishRequest(request, false, err.message);
            return res.status(500).json({
              error: 'Failed at Stage 4',
              details: err.message,
              log,
              latencyMs
            });
          }
        } catch (err) {
          metricsTracker.recordStageFail(request, 'Stage 3');
          const latencyMs = Date.now() - startTime;
          metricsTracker.finishRequest(request, false, err.message);
          return res.status(500).json({
            error: 'Failed at Stage 3',
            details: err.message,
            log,
            latencyMs
          });
        }
      } catch (err) {
        metricsTracker.recordStageFail(request, 'Stage 2');
        const latencyMs = Date.now() - startTime;
        metricsTracker.finishRequest(request, false, err.message);
        return res.status(500).json({
          error: 'Failed at Stage 2',
          details: err.message,
          log,
          latencyMs
        });
      }
    } catch (err) {
      metricsTracker.recordStageFail(request, 'Stage 1');
      const latencyMs = Date.now() - startTime;
      metricsTracker.finishRequest(request, false, err.message);
      return res.status(500).json({
        error: 'Failed at Stage 1',
        details: err.message,
        log,
        latencyMs
      });
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return res.status(500).json({
      error: 'Server error',
      details: err.message,
      log,
      latencyMs
    });
  }
});

// GET /metrics endpoint - system health and performance dashboard
app.get('/metrics', (req, res) => {
  const metrics = metricsTracker.getMetrics();
  res.json(metrics);
});

// Start server
app.listen(PORT, () => {
  console.log(`AI App Generator server running on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
  console.log(`Metrics: http://localhost:${PORT}/metrics`);
});