const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');

const fallbackConfig = {
  appName: 'Atlas Ops',
  defaultLocale: 'en',
  locales: ['en', 'es'],
  translations: {
    en: {
      appName: 'Atlas Ops',
      signIn: 'Sign in',
      signOut: 'Sign out',
      email: 'Email',
      password: 'Password',
      dashboard: 'Dashboard',
      contacts: 'Contacts',
      tasks: 'Tasks',
      csvImport: 'CSV Import',
      notifications: 'Notifications',
      loading: 'Loading...',
      error: 'Error',
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      import: 'Import',
      rows: 'Rows',
      records: 'Records',
      language: 'Language',
      activity: 'Activity',
      ownerScoped: 'User-scoped data'
    },
    es: {
      appName: 'Atlas Ops',
      signIn: 'Iniciar sesi\u00f3n',
      signOut: 'Cerrar sesi\u00f3n',
      email: 'Correo',
      password: 'Contrase\u00f1a',
      dashboard: 'Panel',
      contacts: 'Contactos',
      tasks: 'Tareas',
      csvImport: 'Importar CSV',
      notifications: 'Notificaciones',
      loading: 'Cargando...',
      error: 'Error',
      create: 'Crear',
      update: 'Actualizar',
      delete: 'Eliminar',
      save: 'Guardar',
      cancel: 'Cancelar',
      import: 'Importar',
      rows: 'Filas',
      records: 'Registros',
      language: 'Idioma',
      activity: 'Actividad',
      ownerScoped: 'Datos por usuario'
    }
  },
  navigation: [],
  auth: { roles: [], users: [] },
  entities: [],
  dashboard: { widgets: [] }
};

function safeParseConfig(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return null;
  }
}

function normalizeConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const translations = source.translations && typeof source.translations === 'object' ? source.translations : fallbackConfig.translations;
  const locales = Array.isArray(source.locales) && source.locales.length > 0 ? source.locales : fallbackConfig.locales;
  const defaultLocale = typeof source.defaultLocale === 'string' ? source.defaultLocale : fallbackConfig.defaultLocale;
  const entities = Array.isArray(source.entities) ? source.entities : fallbackConfig.entities;
  const navigation = Array.isArray(source.navigation) ? source.navigation : fallbackConfig.navigation;
  const dashboard = source.dashboard && typeof source.dashboard === 'object' ? source.dashboard : fallbackConfig.dashboard;
  const auth = source.auth && typeof source.auth === 'object' ? source.auth : fallbackConfig.auth;

  return {
    appName: typeof source.appName === 'string' ? source.appName : fallbackConfig.appName,
    defaultLocale,
    locales,
    translations,
    navigation,
    auth: {
      roles: Array.isArray(auth.roles) ? auth.roles : fallbackConfig.auth.roles,
      users: Array.isArray(auth.users) ? auth.users : fallbackConfig.auth.users
    },
    entities: entities.map((entity) => ({
      id: entity.id,
      labelKey: entity.labelKey || entity.id,
      scoped: entity.scoped !== false,
      allowCsvImport: entity.allowCsvImport !== false,
      fields: Array.isArray(entity.fields) ? entity.fields : []
    })),
    dashboard
  };
}

function getRuntimeConfig() {
  try {
    const rawText = fs.readFileSync(configPath, 'utf8');
    const parsed = safeParseConfig(rawText);
    return normalizeConfig(parsed || fallbackConfig);
  } catch (_error) {
    return normalizeConfig(fallbackConfig);
  }
}

function getPublicRuntimeConfig() {
  const config = getRuntimeConfig();

  return {
    appName: config.appName,
    defaultLocale: config.defaultLocale,
    locales: config.locales,
    translations: config.translations,
    navigation: config.navigation,
    entities: config.entities,
    dashboard: config.dashboard,
    auth: {
      roles: config.auth.roles,
      users: config.auth.users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }))
    }
  };
}

module.exports = {
  configPath,
  getRuntimeConfig,
  getPublicRuntimeConfig,
  normalizeConfig
};
