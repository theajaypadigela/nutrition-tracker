import { getEnrichmentPresentation } from '../enrichmentStatus';

describe('nutrition enrichment presentation', () => {
  it.each(['pending', 'in_progress'] as const)(
    'does not render nutrition while status is %s',
    status => {
      expect(getEnrichmentPresentation(status)).toMatchObject({
        label: 'Estimating…',
        showNutrition: false,
        isTerminal: false,
      });
    },
  );

  it('shows a visible failure without treating it as zero nutrition', () => {
    expect(getEnrichmentPresentation('failed')).toMatchObject({
      label: "Couldn't estimate",
      showNutrition: false,
      isTerminal: true,
    });
  });

  it('renders nutrition only after successful enrichment', () => {
    expect(getEnrichmentPresentation('completed')).toMatchObject({
      label: 'Estimated',
      showNutrition: true,
      isTerminal: true,
    });
  });
});
