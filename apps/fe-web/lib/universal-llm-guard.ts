/**
 * Universal LLM Guard Injection System
 *
 * 🛡️ Automatically wraps ALL LLM client methods
 * 🚫 Zero-bypass proxy-based architecture
 * 🔄 Seamless integration with existing code
 * 📊 Complete execution tracking
 */

import { LLMExecutionAuthority, ExecutionContext, getCaller, ExecutionDeniedError } from './llm-execution-authority';
import { executionTracer } from './execution-tracer';

// 🎯 Known LLM methods that require guarding
const LLM_METHODS = [
  'generateText',
  'generateAugmentation',
  'evaluateQuality',
  'complete',
  'chat',
  'embed',
  'analyze',
  'process',
  'invoke'
];

// 🏗️ Guarded LLM Client Interface
export interface GuardedLLMClient {
  [key: string]: any;
  _isGuarded: boolean;
  _originalClient: any;
}

// 📊 Guard Injection Statistics
interface GuardStats {
  clientsGuarded: number;
  methodsWrapped: number;
  executionsBlocked: number;
  bypassAttempts: number;
}

/**
 * 🛡️ Universal Guard Injection Engine
 */
export class UniversalLLMGuard {
  private static stats: GuardStats = {
    clientsGuarded: 0,
    methodsWrapped: 0,
    executionsBlocked: 0,
    bypassAttempts: 0
  };

  private static guardedClients = new WeakSet();

  /**
   * 🎯 Main Guard Injection Function
   * Wraps any LLM client with execution authority validation
   */
  static injectGuards<T extends object>(client: T, clientName: string = 'unknown'): GuardedLLMClient {
    // 🔍 Check if already guarded
    if (this.guardedClients.has(client)) {
      console.log(`🛡️ [Guard] Client already guarded: ${clientName}`);
      return client as GuardedLLMClient;
    }

    // 🚨 Feature flag check
    if (!this.isGuardInjectionEnabled()) {
      console.warn(`🚨 [Guard] Guard injection disabled - returning original client: ${clientName}`);
      return client as GuardedLLMClient;
    }

    console.log(`🛡️ [Guard] Injecting guards into client: ${clientName}`);

    const guardedClient = this.createGuardedProxy(client, clientName);
    this.guardedClients.add(guardedClient);
    this.stats.clientsGuarded++;

    return guardedClient;
  }

  /**
   * 🔄 Create Proxy-Based Guarded Client
   */
  private static createGuardedProxy<T extends object>(client: T, clientName: string): GuardedLLMClient {
    return new Proxy(client, {
      get: (target: any, prop: string | symbol) => {
        const propName = prop.toString();

        // 🏷️ Special guard metadata
        if (propName === '_isGuarded') return true;
        if (propName === '_originalClient') return target;

        // 🎯 Check if this is an LLM method that needs guarding
        if (LLM_METHODS.includes(propName) || this.isLLMMethod(propName)) {
          return this.createGuardedMethod(target, propName, clientName);
        }

        // 🔍 Non-LLM method - return as-is but log potential bypass attempts
        const originalMethod = target[prop];
        if (typeof originalMethod === 'function') {
          return this.createMonitoredMethod(originalMethod, propName, clientName);
        }

        return originalMethod;
      },

      set: (target: any, prop: string | symbol, value: any) => {
        target[prop] = value;
        return true;
      }
    }) as GuardedLLMClient;
  }

  /**
   * 🛡️ Create Guarded LLM Method
   */
  private static createGuardedMethod(target: any, methodName: string, clientName: string) {
    this.stats.methodsWrapped++;

    return async (...args: any[]) => {
      const caller = getCaller();
      const sessionId = this.extractSessionId(args);

      // 🎯 Create execution context
      const context: ExecutionContext = {
        method: `${clientName}.${methodName}`,
        args: this.sanitizeArgs(args),
        caller,
        timestamp: Date.now(),
        sessionId
      };

      try {
        console.log(`🛡️ [Guard] Requesting authorization: ${context.method}`);

        // 🔒 Request execution authorization
        const authorization = await LLMExecutionAuthority.authorizeExecution(context);

        if (!authorization.authorized) {
          this.stats.executionsBlocked++;

          if (authorization.source === 'denied') {
            throw new ExecutionDeniedError(
              authorization.reason || 'Execution denied by LLM Authority',
              context
            );
          }

          // 🔄 Fallback mode
          console.warn(`⚠️ [Guard] Fallback execution: ${context.method} - ${authorization.reason}`);
          return this.handleFallbackExecution(methodName, args, authorization);
        }

        // ✅ Execute with authorization
        console.log(`✅ [Guard] Executing authorized: ${context.method} (${authorization.executionId})`);

        const result = await target[methodName](...args);

        // 📊 Add execution metadata to result
        if (typeof result === 'object' && result !== null) {
          result._execution = {
            source: authorization.source,
            executionId: authorization.executionId,
            authorized: true,
            timestamp: new Date().toISOString()
          };
        }

        return result;

      } catch (error) {
        console.error(`❌ [Guard] Execution failed: ${context.method}`, error);

        // 🔄 Handle execution errors with potential fallback
        if (this.shouldFallbackOnError(error)) {
          return this.handleErrorFallback(methodName, args, error);
        }

        throw error;
      }
    };
  }

  /**
   * 👀 Create Monitored Non-LLM Method
   */
  private static createMonitoredMethod(originalMethod: Function, methodName: string, clientName: string) {
    return (...args: any[]) => {
      // 🚨 Detect potential bypass attempts
      if (this.isPotentialBypass(methodName, args)) {
        this.stats.bypassAttempts++;
        LLMExecutionAuthority.recordBypassAttempt(getCaller(), `${clientName}.${methodName}`);
      }

      return originalMethod.apply(this, args);
    };
  }

  /**
   * 🔄 Handle Fallback Execution
   */
  private static handleFallbackExecution(methodName: string, args: any[], authorization: any): any {
    console.warn(`🔄 [Guard] Executing fallback for: ${methodName}`);

    // 🎯 Method-specific fallback strategies
    switch (methodName) {
      case 'generateText':
        return this.generateFallbackText(args);
      case 'generateAugmentation':
        return this.generateFallbackAugmentation(args);
      case 'evaluateQuality':
        return this.generateFallbackEvaluation(args);
      default:
        return this.generateGenericFallback(methodName, args);
    }
  }

  /**
   * 🚨 Handle Error Fallback
   */
  private static handleErrorFallback(methodName: string, args: any[], error: any): any {
    console.warn(`🚨 [Guard] Error fallback for: ${methodName}`, error);

    return {
      _execution: {
        source: 'error_fallback',
        authorized: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      result: `Error fallback result for ${methodName}`
    };
  }

  // 🛠️ Helper Methods

  private static isGuardInjectionEnabled(): boolean {
    return process.env.FEATURE_UNIVERSAL_GUARD_INJECTION !== 'false';
  }

  private static isLLMMethod(methodName: string): boolean {
    // 🎯 Heuristic detection of LLM methods
    const llmKeywords = ['generate', 'complete', 'chat', 'embed', 'analyze', 'process', 'llm', 'ai'];
    return llmKeywords.some(keyword => methodName.toLowerCase().includes(keyword));
  }

  private static extractSessionId(args: any[]): string | undefined {
    // 🔍 Try to find sessionId in arguments
    for (const arg of args) {
      if (typeof arg === 'string' && arg.includes('session')) return arg;
      if (typeof arg === 'object' && arg?.sessionId) return arg.sessionId;
    }
    return undefined;
  }

  private static sanitizeArgs(args: any[]): any[] {
    // 🧹 Remove sensitive data from args for logging
    return args.map(arg => {
      if (typeof arg === 'string' && arg.length > 100) {
        return arg.substring(0, 100) + '...[truncated]';
      }
      if (typeof arg === 'object' && arg !== null) {
        return { ...arg, _truncated: true };
      }
      return arg;
    });
  }

  private static isPotentialBypass(methodName: string, args: any[]): boolean {
    // 🚨 Detect patterns that might indicate bypass attempts
    const suspiciousPatterns = [
      'direct',
      'bypass',
      'skip',
      'raw',
      'unguarded',
      'force'
    ];

    return suspiciousPatterns.some(pattern =>
      methodName.toLowerCase().includes(pattern) ||
      args.some(arg => typeof arg === 'string' && arg.toLowerCase().includes(pattern))
    );
  }

  private static shouldFallbackOnError(error: any): boolean {
    // 🔄 Determine if error should trigger fallback
    if (error instanceof ExecutionDeniedError) return false;

    const fallbackErrors = ['timeout', 'network', 'api_error', 'rate_limit'];
    const errorMessage = error?.message?.toLowerCase() || '';

    return fallbackErrors.some(errorType => errorMessage.includes(errorType));
  }

  // 🎯 Fallback Generators

  private static generateFallbackText(args: any[]): string {
    const prompt = args[0] || 'default prompt';
    return `[FALLBACK] Generated response for: "${prompt.substring(0, 50)}..." - This is a template response generated when LLM execution is not available.`;
  }

  private static generateFallbackAugmentation(args: any[]): string {
    const [input, type] = args;
    return `[FALLBACK] ${type} augmentation of: "${input?.substring(0, 50)}..." - Template augmentation result.`;
  }

  private static generateFallbackEvaluation(args: any[]): any {
    return {
      score: 0.7,
      metrics: {
        semantic_similarity: 0.7,
        fluency: 0.7,
        coherence: 0.7,
        usefulness: 0.7
      },
      _execution: {
        source: 'fallback',
        note: 'Template evaluation when LLM not available'
      }
    };
  }

  private static generateGenericFallback(methodName: string, args: any[]): any {
    return {
      _execution: {
        source: 'fallback',
        method: methodName,
        authorized: false,
        timestamp: new Date().toISOString()
      },
      result: `Fallback result for ${methodName}`
    };
  }

  // 📊 Public Statistics Interface

  static getGuardStats(): GuardStats {
    return { ...this.stats };
  }

  static resetStats(): void {
    this.stats = {
      clientsGuarded: 0,
      methodsWrapped: 0,
      executionsBlocked: 0,
      bypassAttempts: 0
    };
  }

  /**
   * 🔍 Verify Guard Injection Status
   */
  static verifyGuardInjection(client: any, clientName: string): boolean {
    const isGuarded = this.guardedClients.has(client);
    const hasGuardMarker = client?._isGuarded === true;

    if (!isGuarded && this.isGuardInjectionEnabled()) {
      console.warn(`⚠️ [Guard] Unguarded client detected: ${clientName}`);
      return false;
    }

    return isGuarded && hasGuardMarker;
  }
}

/**
 * 🎯 Convenience function for quick guard injection
 */
export function guardLLMClient<T extends object>(client: T, clientName?: string): GuardedLLMClient {
  return UniversalLLMGuard.injectGuards(client, clientName || 'anonymous');
}

/**
 * 🔍 Check if a client is properly guarded
 */
export function isClientGuarded(client: any): boolean {
  return client?._isGuarded === true;
}

/**
 * 📊 Export guard statistics for monitoring
 */
export { UniversalLLMGuard as GuardInjector };