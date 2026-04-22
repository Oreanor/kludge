import { ModelRouter, RouteDecision, TaskKind, ChatContext, ModelConfig } from '../types';

export class ModelRouterService implements ModelRouter {
  private models: Record<string, ModelConfig> = {};

  registerModels(configs: ModelConfig[] = []) {
    configs.forEach(c => { this.models[c.id] = c; });
  }

  route(task: TaskKind, context: ChatContext): RouteDecision {
    const ids = Object.keys(this.models);
    return {
      modelId: ids[0] ?? 'default',
      reason: 'default-route'
    };
  }

  chooseFallback(primary: string, error?: any): string | undefined {
    const ids = Object.keys(this.models).filter(id => id !== primary);
    return ids[0];
  }

  async showModelPicker(): Promise<string | undefined> {
    return undefined;
  }
}
