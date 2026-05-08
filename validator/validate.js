function stripMarkdownFences(rawText) {
  if (typeof rawText !== 'string') {
    return '';
  }

  let cleaned = rawText.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```\s*$/i, '');
  }

  return cleaned.trim();
}

function validateJSON(rawText, requiredKeys) {
  const cleanedText = stripMarkdownFences(rawText);

  if (!cleanedText) {
    return {
      success: false,
      error: 'Empty response from model.',
      raw: rawText,
    };
  }

  let parsed;

  try {
    parsed = JSON.parse(cleanedText);
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error.message}`,
      raw: rawText,
    };
  }

  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    return {
      success: false,
      error: 'Expected a JSON object.',
      raw: rawText,
    };
  }

  const missingKeys = (requiredKeys || []).filter((key) => !Object.prototype.hasOwnProperty.call(parsed, key));

  if (missingKeys.length > 0) {
    return {
      success: false,
      error: `Missing required keys: ${missingKeys.join(', ')}`,
      raw: rawText,
    };
  }

  return {
    success: true,
    data: parsed,
  };
}

module.exports = {
  stripMarkdownFences,
  validateJSON,
};