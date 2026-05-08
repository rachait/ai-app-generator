#!/usr/bin/env node
// Test runner for evaluation framework

const testCases = require('./evaluation/testcases');

async function runTests() {
  console.log('\n🧪 AI App Generator - Evaluation Test Suite\n');
  console.log(`Running ${testCases.length} test cases...\n`);
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    byCategory: {}
  };

  let totalLatency = 0;
  let successfulRequests = 0;

  for (const testCase of testCases) {
    const category = testCase.category;
    if (!results.byCategory[category]) {
      results.byCategory[category] = { passed: 0, failed: 0, total: 0 };
    }
    results.byCategory[category].total++;

    try {
      console.log(`[Test ${testCase.id}] ${testCase.category.toUpperCase()}`);
      console.log(`  Prompt: "${testCase.prompt.substring(0, 60)}${testCase.prompt.length > 60 ? '...' : ''}"`);
      console.log(`  Expected to pass: ${testCase.expectedToPass}`);

      // Make API call to /generate
      const response = await fetch('http://localhost:3000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testCase.prompt })
      });

      const data = await response.json();
      const passed = testCase.expectedToPass ? response.ok : !response.ok;

      if (passed) {
        console.log(`  ✅ PASSED`);
        results.passed++;
        results.byCategory[category].passed++;
        if (response.ok) {
          totalLatency += data.latencyMs;
          successfulRequests++;
        }
      } else {
        console.log(`  ❌ FAILED`);
        results.failed++;
        results.byCategory[category].failed++;
        if (data.error) {
          console.log(`     Error: ${data.error}`);
        }
      }

      if (data.latencyMs) {
        console.log(`     Latency: ${data.latencyMs}ms`);
      }

      console.log('');
    } catch (error) {
      console.log(`  ⏭️  SKIPPED - Server error: ${error.message}\n`);
      results.skipped++;
    }
  }

  // Print summary
  console.log('\n📊 SUMMARY\n');
  console.log(`Total Tests:        ${testCases.length}`);
  console.log(`Passed:             ${results.passed} (${((results.passed / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`Failed:             ${results.failed} (${((results.failed / testCases.length) * 100).toFixed(1)}%)`);
  console.log(`Skipped:            ${results.skipped}`);
  console.log(`Average Latency:    ${successfulRequests > 0 ? (totalLatency / successfulRequests).toFixed(0) : 'N/A'}ms`);

  console.log('\n📈 BY CATEGORY\n');
  for (const [category, stats] of Object.entries(results.byCategory)) {
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`${category.toUpperCase()}: ${stats.passed}/${stats.total} passed (${passRate}%)`);
  }

  console.log('\n✨ Evaluation complete!\n');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/metrics');
    return response.ok;
  } catch {
    return false;
  }
}

(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.error('❌ Error: Server is not running on http://localhost:3000');
    console.error('   Run: npm start');
    process.exit(1);
  }
  await runTests();
})();
