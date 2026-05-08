const { callClaudeRaw, repairStage } = require('../repair/repair');
const { validateJSON } = require('../validator/validate');

async function stage2Design(intent) {
  console.log('Stage 2: designing architecture...');

  const stageInstructions = [
    'Design the system architecture from the extracted intent.',
    'Produce a practical page map, API surface, and database outline.',
    'Return a JSON object with these exact keys: pages, apiEndpoints, dbTables.',
    'Each page must include name, route, and accessRoles.',
    'Each API endpoint must include method, path, and description.',
    'Each DB table must include name and fields.',
    'Return ONLY raw JSON. No markdown. No explanation.',
  ].join(' ');

  const userPrompt = [
    stageInstructions,
    '',
    'Stage 1 output:',
    JSON.stringify(intent, null, 2),
  ].join('\n');

  const rawText = await callClaudeRaw({
    system: 'You are a system architect that converts product intent into strict JSON.',
    user: userPrompt,
    maxTokens: 4000,
    temperature: 0.2,
  });

  let validation = validateJSON(rawText, ['pages', 'apiEndpoints', 'dbTables']);

  if (!validation.success) {
    const repairedText = await repairStage(intent, rawText, validation.error, stageInstructions);
    validation = validateJSON(repairedText, ['pages', 'apiEndpoints', 'dbTables']);
  }

  if (!validation.success) {
    throw new Error(`Stage 2 failed after repair: ${validation.error}`);
  }

  return validation.data;
}

module.exports = {
  stage2Design,
};