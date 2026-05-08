// Metrics tracker for system reliability and performance analysis

class MetricsTracker {
  constructor() {
    this.requests = [];
    this.stages = [];
  }

  startRequest(prompt) {
    return {
      id: Math.random().toString(36).substring(7),
      prompt,
      startTime: Date.now(),
      stages: {},
      result: null,
      error: null,
      retries: 0,
      totalLatency: 0,
      costEstimate: 0
    };
  }

  recordStageStart(request, stageName) {
    request.stages[stageName] = {
      name: stageName,
      startTime: Date.now(),
      endTime: null,
      latency: 0,
      success: false,
      repairs: 0
    };
  }

  recordStageSuccess(request, stageName) {
    if (request.stages[stageName]) {
      request.stages[stageName].endTime = Date.now();
      request.stages[stageName].latency = request.stages[stageName].endTime - request.stages[stageName].startTime;
      request.stages[stageName].success = true;
    }
  }

  recordStageRepair(request, stageName) {
    if (request.stages[stageName]) {
      request.stages[stageName].repairs += 1;
      request.retries += 1;
    }
  }

  recordStageFail(request, stageName) {
    if (request.stages[stageName]) {
      request.stages[stageName].endTime = Date.now();
      request.stages[stageName].latency = request.stages[stageName].endTime - request.stages[stageName].startTime;
      request.stages[stageName].success = false;
    }
  }

  finishRequest(request, success, error = null) {
    request.endTime = Date.now();
    request.totalLatency = request.endTime - request.startTime;
    request.result = success ? 'success' : 'failed';
    request.error = error;
    
    // Estimate cost based on tokens (rough: ~4 chars per token, assume $15/M input, $45/M output)
    const promptLength = request.prompt.length;
    const estimatedInputTokens = Math.ceil(promptLength / 4);
    const estimatedOutputTokens = 2000; // avg output tokens per stage * 4 stages
    const inputCost = (estimatedInputTokens * 4 * 15) / 1000000;
    const outputCost = (estimatedOutputTokens * 4 * 45) / 1000000;
    request.costEstimate = (inputCost + outputCost).toFixed(6);

    this.requests.push(request);
    return request;
  }

  getMetrics() {
    const successful = this.requests.filter(r => r.result === 'success');
    const failed = this.requests.filter(r => r.result === 'failed');
    
    const avgLatency = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.totalLatency, 0) / successful.length
      : 0;

    const avgRetries = this.requests.length > 0
      ? this.requests.reduce((sum, r) => sum + r.retries, 0) / this.requests.length
      : 0;

    const totalCost = this.requests.reduce((sum, r) => sum + parseFloat(r.costEstimate || 0), 0);

    const stageMetrics = {};
    ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'].forEach(stage => {
      const stageResults = this.requests
        .flatMap(r => r.stages[stage] ? [r.stages[stage]] : []);
      
      stageMetrics[stage] = {
        count: stageResults.length,
        successCount: stageResults.filter(s => s.success).length,
        failCount: stageResults.filter(s => !s.success).length,
        avgLatency: stageResults.length > 0
          ? stageResults.reduce((sum, s) => sum + s.latency, 0) / stageResults.length
          : 0,
        totalRepairs: stageResults.reduce((sum, s) => sum + s.repairs, 0)
      };
    });

    return {
      totalRequests: this.requests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: this.requests.length > 0
        ? ((successful.length / this.requests.length) * 100).toFixed(1) + '%'
        : '0%',
      averageLatency: Math.round(avgLatency) + 'ms',
      averageRetries: avgRetries.toFixed(2),
      estimatedTotalCost: '$' + totalCost.toFixed(4),
      stageMetrics,
      recentRequests: this.requests.slice(-10).map(r => ({
        id: r.id,
        prompt: r.prompt.substring(0, 60) + '...',
        result: r.result,
        latency: r.totalLatency + 'ms',
        retries: r.retries,
        cost: '$' + r.costEstimate
      }))
    };
  }
}

module.exports = { MetricsTracker };
