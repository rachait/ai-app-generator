const { callClaudeRaw, repairStage } = require('../repair/repair');
const { validateJSON } = require('../validator/validate');

async function stage1Intent(prompt) {
  console.log('Stage 1: extracting intent...');

  const stageInstructions = [
    'Extract structured product intent from the user prompt.',
    'Infer a sensible app name from the prompt.',
    'Identify core entities, roles, and features.',
    'Set hasPayments and hasAuth as booleans based on the prompt.',
    'Add reasonable assumptions when details are missing.',
    'Return a JSON object with these exact keys: appName, entities, roles, features, hasPayments, hasAuth, assumptions.',
    'Return ONLY raw JSON. No markdown. No explanation.',
  ].join(' ');

  const userPrompt = [
    stageInstructions,
    '',
    'User app description:',
    prompt,
  ].join('\n');

  const rawText = await callClaudeRaw({
    system: 'You are a product strategist that converts app ideas into strict JSON.',
    user: userPrompt,
    maxTokens: 3000,
    temperature: 0.2,
  });

  let validation = validateJSON(rawText, [
    'appName',
    'entities',
    'roles',
    'features',
    'hasPayments',
    'hasAuth',
    'assumptions',
  ]);

  if (!validation.success) {
    const repairedText = await repairStage(prompt, rawText, validation.error, stageInstructions);
    validation = validateJSON(repairedText, [
      'appName',
      'entities',
      'roles',
      'features',
      'hasPayments',
      'hasAuth',
      'assumptions',
    ]);
  }

  if (!validation.success) {
    throw new Error(`Stage 1 failed after repair: ${validation.error}`);
  }

  return validation.data;
}

module.exports = {
  stage1Intent,
};