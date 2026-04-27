import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { db } from './db';
import { computeCost } from './cost';
import { assertWithinCap } from './cap';

interface TrackedCallArgs<T> {
  userId: string;
  endpoint: 'consultant' | 'strategy' | 'profile-bootstrap';
  call: () => Promise<{ message: Anthropic.Message; result: T }>;
}

/**
 * Wrap a Claude API call:
 *   1. Reject if the user has hit their daily cap
 *   2. Run the call
 *   3. Log usage + cost from the response
 */
export async function callClaudeTracked<T>({ userId, endpoint, call }: TrackedCallArgs<T>): Promise<T> {
  await assertWithinCap(userId);
  const { message, result } = await call();
  const usage = message.usage;
  const cost = computeCost(message.model, usage);
  await db.claudeUsage.create({
    data: {
      userId,
      endpoint,
      model: message.model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
      costUsd: cost,
    },
  });
  return result;
}
