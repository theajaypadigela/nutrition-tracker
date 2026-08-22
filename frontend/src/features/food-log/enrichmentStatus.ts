import type { EnrichmentStatus } from '../../types/types';

export interface EnrichmentPresentation {
  label: string;
  backgroundColor: string;
  textColor: string;
  showNutrition: boolean;
  isTerminal: boolean;
}

export const getEnrichmentPresentation = (
  status: EnrichmentStatus | undefined,
): EnrichmentPresentation => {
  switch (status) {
    case 'pending':
    case 'in_progress':
      return {
        label: 'Estimating…',
        backgroundColor: '#FEF3C7',
        textColor: '#B45309',
        showNutrition: false,
        isTerminal: false,
      };
    case 'failed':
      return {
        label: "Couldn't estimate",
        backgroundColor: '#FEE2E2',
        textColor: '#DC2626',
        showNutrition: false,
        isTerminal: true,
      };
    case 'completed':
      return {
        label: 'Estimated',
        backgroundColor: '#DBEAFE',
        textColor: '#3B82F6',
        showNutrition: true,
        isTerminal: true,
      };
    default:
      // Older servers omit the additive field. Preserve their numeric display
      // until all deployed backends expose an explicit state.
      return {
        label: 'AI Logged',
        backgroundColor: '#DBEAFE',
        textColor: '#3B82F6',
        showNutrition: true,
        isTerminal: false,
      };
  }
};
