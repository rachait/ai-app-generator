const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getRuntimeConfig } = require('./config');

const storePath = path.join(__dirname, '..', 'data', 'runtime-store.json');
const sessions = new Map();

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createSeedStore() {
  const config = getRuntimeConfig();
  const records = {};

  for (const entity of config.entities) {
    records[entity.id] = [];
  }

  return {
    records,
    notifications: [],
    nextIds: {},
    meta: {
      createdAt: new Date().toISOString(),
      version: 1
    }
  };
}

function ensureStoreFile() {
  const dirPath = path.dirname(storePath);
  fs.mkdirSync(dirPath, { recursive: true });

  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(createSeedStore(), null, 2), 'utf8');
  }
}

function readStore() {
  ensureStoreFile();

  try {
    const rawText = fs.readFileSync(storePath, 'utf8');
    const parsed = rawText ? JSON.parse(rawText) : createSeedStore();
    const config = getRuntimeConfig();

    if (!parsed.records || typeof parsed.records !== 'object') {
      parsed.records = {};
    }

    for (const entity of config.entities) {
      if (!Array.isArray(parsed.records[entity.id])) {
        parsed.records[entity.id] = [];
      }
    }

    if (!Array.isArray(parsed.notifications)) {
      parsed.notifications = [];
    }

    if (!parsed.nextIds || typeof parsed.nextIds !== 'object') {
      parsed.nextIds = {};
    }

    return parsed;
  } catch (_error) {
    const seedStore = createSeedStore();
    saveStore(seedStore);
    return seedStore;
  }
}

function saveStore(store) {
  const dirPath = path.dirname(storePath);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
}

function updateStore(mutator) {
  const store = readStore();
  const result = mutator(store);
  saveStore(store);
  return result;
}

function nextEntityId(store, entityId) {
  const current = store.nextIds[entityId] || 1;
  store.nextIds[entityId] = current + 1;
  return `${entityId}_${current}`;
}

function createSession(user) {
  const sid = makeId('sess');
  sessions.set(sid, {
    userId: user.id,
    createdAt: new Date().toISOString()
  });
  return sid;
}

function getSession(sid) {
  if (!sid) {
    return null;
  }

  return sessions.get(sid) || null;
}

function destroySession(sid) {
  if (sid) {
    sessions.delete(sid);
  }
}

function addNotification(store, { userId, type, message, entityId, recordId }) {
  const notification = {
    id: makeId('note'),
    userId,
    type,
    message,
    entityId: entityId || null,
    recordId: recordId || null,
    createdAt: new Date().toISOString()
  };

  store.notifications.unshift(notification);
  store.notifications = store.notifications.slice(0, 100);
  return notification;
}

function getVisibleRecords(store, entityId, user) {
  const records = Array.isArray(store.records[entityId]) ? store.records[entityId] : [];

  if (!user || user.role === 'admin') {
    return records;
  }

  return records.filter((record) => record.ownerId === user.id);
}

module.exports = {
  storePath,
  readStore,
  saveStore,
  updateStore,
  nextEntityId,
  createSession,
  getSession,
  destroySession,
  addNotification,
  getVisibleRecords
};
