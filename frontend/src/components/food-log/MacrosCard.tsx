import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/text';
import { Drumstick, Apple, Droplets, Cookie } from 'lucide-react-native';
import { NutritionTotals, DailyNutritionGoals } from '@/types/types';

const T = {
  ink: '#16241c',
  inkMuted: '#8a988f',
  lineSoft: '#f1f5f2',
  good: '#0f9b54',
  goodSoft: '#e3f5ea',
  warn: '#d98a16',
  warnSoft: '#fbf0db',
  low: '#e0573e',
  lowSoft: '#fdeae3',
};

type MacroStatus = 'good' | 'warn' | 'low';

function macroStatus(
  value: number,
  target: number,
  kind: 'goal' | 'limit',
): MacroStatus {
  const pct = value / target;
  if (kind === 'goal') {
    if (pct >= 0.9) return 'good';
    if (pct >= 0.6) return 'warn';
    return 'low';
  }
  if (pct <= 0.9) return 'good';
  if (pct <= 1.0) return 'warn';
  return 'low';
}

function fmtG(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return (Math.round(v * 10) / 10).toString().replace(/\.0$/, '');
  return (Math.round(v * 10) / 10).toString();
}

const STATUS_COLORS: Record<MacroStatus, [string, string, string]> = {
  good: [T.good, T.goodSoft, 'GOOD'],
  warn: [T.warn, T.warnSoft, 'CLOSE'],
  low: [T.low, T.lowSoft, 'LOW'],
};

interface MacroDef {
  key: 'protein' | 'carbs' | 'fat' | 'sugar';
  label: string;
  goalKey: 'protein' | 'carbs' | 'fat' | 'sugar';
  kind: 'goal' | 'limit';
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

const MACROS: MacroDef[] = [
  { key: 'protein', label: 'Protein', goalKey: 'protein', kind: 'goal', Icon: Drumstick },
  { key: 'carbs', label: 'Carbs', goalKey: 'carbs', kind: 'goal', Icon: Apple },
  { key: 'fat', label: 'Fats', goalKey: 'fat', kind: 'limit', Icon: Droplets },
  { key: 'sugar', label: 'Sugar', goalKey: 'sugar', kind: 'limit', Icon: Cookie },
];

interface MacrosCardProps {
  totals: Pick<NutritionTotals, 'protein' | 'carbs' | 'fat' | 'sugar'>;
  dailyGoals: Pick<DailyNutritionGoals, 'protein' | 'carbs' | 'fat' | 'sugar'>;
}

export const MacrosCard: React.FC<MacrosCardProps> = ({ totals, dailyGoals }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Macros &amp; nutrients</Text>
        <Text style={styles.cardSub}>Today vs goal</Text>
      </View>

      {MACROS.map((m, i) => {
        const val = totals[m.key] || 0;
        const tgt = dailyGoals[m.goalKey];
        const status = macroStatus(val, tgt, m.kind);
        const [col, soft, txt] = STATUS_COLORS[status];
        const pct = Math.min(1, val / tgt);

        return (
          <View
            key={m.key}
            style={[
              styles.macroRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: T.lineSoft },
            ]}
          >
            <View style={styles.macroTop}>
              <View style={[styles.iconBox, { backgroundColor: soft }]}>
                <m.Icon size={16} color={col} strokeWidth={2} />
              </View>
              <Text style={styles.macroLabel}>{m.label}</Text>
              <Text style={styles.macroVal}>
                {fmtG(val)}
                <Text style={styles.macroTarget}> / {tgt}g</Text>
              </Text>
            </View>
            <View style={styles.barRow}>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct * 100}%` as any, backgroundColor: col },
                  ]}
                />
              </View>
              <View style={[styles.badge, { backgroundColor: soft }]}>
                <Text style={[styles.badgeText, { color: col }]}>{txt}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#e7ede9',
    shadowColor: '#102818',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: T.ink,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 11.5,
    color: T.inkMuted,
    fontWeight: '600',
  },
  macroRow: {
    paddingVertical: 13,
  },
  macroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: T.ink,
    flex: 1,
  },
  macroVal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: T.ink,
  },
  macroTarget: {
    fontSize: 13.5,
    fontWeight: '600',
    color: T.inkMuted,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 9,
  },
  barBg: {
    flex: 1,
    height: 7,
    backgroundColor: T.lineSoft,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
