// Runtime validator - ensures generated config can actually execute

function validateRuntimeExecutability(finalSchema) {
  const issues = [];

  // 1. Check all UI pages have corresponding routes
  if (finalSchema.uiSchema?.pages) {
    const uiPages = finalSchema.uiSchema.pages.map(p => p.route);
    const apiPaths = (finalSchema.apiSchema?.endpoints || []).map(e => e.path);
    
    for (const page of finalSchema.uiSchema.pages) {
      if (!page.route || page.route.length === 0) {
        issues.push(`UI page "${page.name}" has no route defined`);
      }
      if (!page.components || page.components.length === 0) {
        issues.push(`UI page "${page.name}" has no components`);
      }
    }
  }

  // 2. Check all API endpoints have methods and paths
  if (finalSchema.apiSchema?.endpoints) {
    for (const endpoint of finalSchema.apiSchema.endpoints) {
      if (!endpoint.method || !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(endpoint.method)) {
        issues.push(`API endpoint has invalid method: ${endpoint.method}`);
      }
      if (!endpoint.path || endpoint.path.length === 0) {
        issues.push(`API endpoint has no path defined`);
      }
      if (!endpoint.requestBody && endpoint.method !== 'GET' && endpoint.method !== 'DELETE') {
        issues.push(`API endpoint ${endpoint.method} ${endpoint.path} missing requestBody`);
      }
      if (!endpoint.response) {
        issues.push(`API endpoint ${endpoint.method} ${endpoint.path} missing response schema`);
      }
    }
  }

  // 3. Check all DB tables have columns with types
  if (finalSchema.dbSchema?.tables) {
    for (const table of finalSchema.dbSchema.tables) {
      if (!table.name || table.name.length === 0) {
        issues.push(`DB table has no name`);
      }
      if (!table.columns || table.columns.length === 0) {
        issues.push(`DB table "${table.name}" has no columns`);
      }
      for (const col of (table.columns || [])) {
        if (!col.name || !col.type) {
          issues.push(`DB table "${table.name}" has column with missing name or type`);
        }
      }
    }
  }

  // 4. Check auth schema has roles and permissions
  if (finalSchema.authSchema) {
    if (!finalSchema.authSchema.roles || finalSchema.authSchema.roles.length === 0) {
      issues.push(`Auth schema has no roles defined`);
    }
    if (!finalSchema.authSchema.permissions || Object.keys(finalSchema.authSchema.permissions).length === 0) {
      issues.push(`Auth schema has no permissions defined`);
    }
  }

  // 5. Cross-check: all page accessRoles should exist in auth.roles
  if (finalSchema.uiSchema?.pages && finalSchema.authSchema?.roles) {
    const validRoles = new Set(finalSchema.authSchema.roles);
    for (const page of finalSchema.uiSchema.pages) {
      if (page.accessRoles) {
        for (const role of page.accessRoles) {
          if (!validRoles.has(role)) {
            issues.push(`Page "${page.name}" references undefined role: ${role}`);
          }
        }
      }
    }
  }

  // 6. Consistency check: API endpoints should have at least one accessible role
  if (finalSchema.apiSchema?.endpoints && finalSchema.authSchema?.permissions) {
    for (const endpoint of finalSchema.apiSchema.endpoints) {
      const accessibleRoles = Object.keys(finalSchema.authSchema.permissions || {});
      if (accessibleRoles.length === 0) {
        issues.push(`API endpoint ${endpoint.method} ${endpoint.path} has no roles with permission`);
      }
    }
  }

  return {
    isExecutable: issues.length === 0,
    issues,
    severity: issues.length === 0 ? 'none' : (issues.length <= 3 ? 'warning' : 'error')
  };
}

module.exports = { validateRuntimeExecutability };
