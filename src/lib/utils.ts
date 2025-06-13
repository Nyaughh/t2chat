import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { models, type ModelInfo } from '@/lib/models';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getModelById = (id: string): ModelInfo | undefined => {
  return models.find(model => model.id === id);
};
