const { callClaudeRaw, repairStage } = require('../repair/repair');
const { validateJSON } = require('../validator/validate');

async function stage4Refine(schema) {
  console.log('Stage 4: refining consistency...');

  const stageInstructions = [
    'Check the full schema for cross-layer consistency.',
    'Ensure UI fields match API endpoints which match DB columns.',
    'Fix any mismatches across UI, API, DB, and auth layers.',
    'Return the same structure as the input schema with fixes applied.',
    'Add a consistencyReport array listing every fix that was made.',
    'If no fixes are needed, consistencyReport must be an empty array.',
    'Return ONLY raw JSON. No markdown. No explanation.',
  ].join(' ');

  const userPrompt = [
    stageInstructions,
    '',
    'Stage 3 output:',
    JSON.stringify(schema, null, 2),
  ].join('\n');

  const rawText = await callClaudeRaw({
    system: 'You are a consistency checker that repairs cross-layer mismatches and returns strict JSON only.',
    user: userPrompt,
    maxTokens: 6000,
    temperature: 0.1,
  });

  const requiredKeys = ['uiSchema', 'apiSchema', 'dbSchema', 'authSchema', 'consistencyReport'];
  let validation = validateJSON(rawText, requiredKeys);

  if (!validation.success) {
    const repairedText = await repairStage(schema, rawText, validation.error, stageInstructions);
    validation = validateJSON(repairedText, requiredKeys);
  }

  if (!validation.success) {
    throw new Error(`Stage 4 failed after repair: ${validation.error}`);
  }

  return validation.data;
}

module.exports = {
  stage4Refine,
};