const { callClaudeRaw, repairStage } = require('../repair/repair');
const { validateJSON } = require('../validator/validate');

async function stage3Schema(design) {
  console.log('Stage 3: generating schemas...');

  const stageInstructions = [
    'Generate full implementation schemas from the system design.',
    'Return a JSON object with these exact keys: uiSchema, apiSchema, dbSchema, authSchema.',
    'uiSchema must include pages, components, fields, and actions.',
    'apiSchema must include endpoint definitions with requestBody and response.',
    'dbSchema must include tables, columns, and types.',
    'authSchema must include roles and permissions.',
    'Return ONLY raw JSON. No markdown. No explanation.',
  ].join(' ');

  const userPrompt = [
    stageInstructions,
    '',
    'Stage 2 output:',
    JSON.stringify(design, null, 2),
  ].join('\n');

  const rawText = await callClaudeRaw({
    system: 'You are a full-stack schema generator that outputs strict JSON only.',
    user: userPrompt,
    maxTokens: 6000,
    temperature: 0.2,
  });

  let validation = validateJSON(rawText, ['uiSchema', 'apiSchema', 'dbSchema', 'authSchema']);

  if (!validation.success) {
    const repairedText = await repairStage(design, rawText, validation.error, stageInstructions);
    validation = validateJSON(repairedText, ['uiSchema', 'apiSchema', 'dbSchema', 'authSchema']);
  }

  if (!validation.success) {
    throw new Error(`Stage 3 failed after repair: ${validation.error}`);
  }

  return validation.data;
}

module.exports = {
  stage3Schema,
};