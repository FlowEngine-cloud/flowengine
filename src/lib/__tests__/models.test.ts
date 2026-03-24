import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  MODEL_CONFIG,
  getModelConfig,
  isValidModel,
  getPlannerModel,
  getDefaultExecutorModel,
  getBoostExecutorModel,
} from '@/lib/models';

// ─── AVAILABLE_MODELS ─────────────────────────────────────────────────────────

describe('AVAILABLE_MODELS', () => {
  it('contains at least one model', () => {
    expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);
  });

  it('each model has an id, name, and provider', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(['anthropic', 'openai', 'other']).toContain(model.provider);
    }
  });

  it('each model has a positive contextWindow', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('has exactly one default model', () => {
    const defaults = AVAILABLE_MODELS.filter((m) => m.isDefault === true);
    expect(defaults).toHaveLength(1);
  });

  it('contains claude-sonnet-4-6 as a valid model', () => {
    const found = AVAILABLE_MODELS.find((m) => m.id === 'claude-sonnet-4-6');
    expect(found).toBeDefined();
  });
});

// ─── MODEL_CONFIG ─────────────────────────────────────────────────────────────

describe('MODEL_CONFIG', () => {
  it('has plannerModel, defaultExecutorModel, and boostExecutorModel', () => {
    expect(MODEL_CONFIG.plannerModel).toBeTruthy();
    expect(MODEL_CONFIG.defaultExecutorModel).toBeTruthy();
    expect(MODEL_CONFIG.boostExecutorModel).toBeTruthy();
  });
});

// ─── getModelConfig ────────────────────────────────────────────────────────────

describe('getModelConfig', () => {
  it('returns the config for a known model id', () => {
    const config = getModelConfig('claude-sonnet-4-6');
    expect(config).toBeDefined();
    expect(config!.id).toBe('claude-sonnet-4-6');
    expect(config!.provider).toBe('anthropic');
  });

  it('returns undefined for an unknown model id', () => {
    expect(getModelConfig('gpt-4-turbo-nonexistent')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getModelConfig('')).toBeUndefined();
  });
});

// ─── isValidModel ─────────────────────────────────────────────────────────────

describe('isValidModel', () => {
  it('returns true for a known model', () => {
    expect(isValidModel('claude-sonnet-4-6')).toBe(true);
  });

  it('returns true for all models in AVAILABLE_MODELS', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(isValidModel(model.id)).toBe(true);
    }
  });

  it('returns false for an unknown model id', () => {
    expect(isValidModel('gpt-3.5-turbo-totally-fake')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidModel('')).toBe(false);
  });
});

// ─── getPlannerModel / getDefaultExecutorModel / getBoostExecutorModel ─────────

describe('model getters', () => {
  it('getPlannerModel returns a non-empty string', () => {
    expect(typeof getPlannerModel()).toBe('string');
    expect(getPlannerModel().length).toBeGreaterThan(0);
  });

  it('getDefaultExecutorModel returns a non-empty string', () => {
    expect(typeof getDefaultExecutorModel()).toBe('string');
    expect(getDefaultExecutorModel().length).toBeGreaterThan(0);
  });

  it('getBoostExecutorModel returns a non-empty string', () => {
    expect(typeof getBoostExecutorModel()).toBe('string');
    expect(getBoostExecutorModel().length).toBeGreaterThan(0);
  });
});
