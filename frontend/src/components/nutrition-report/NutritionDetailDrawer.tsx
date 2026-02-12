import React from 'react';
import { ScrollView } from 'react-native';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '../ui/actionsheet';
import { Box } from '../ui/box';
import { VStack } from '../ui/vstack';
import { HStack } from '../ui/hstack';
import { Text } from '../ui/text';
import { Heading } from '../ui/heading';
import { Icon } from '../ui/icon';
import { Pressable } from '../ui/pressable';
import {
  X,
  Ban,
  Utensils,
  Mic,
  Phone,
  Info,
  Lightbulb,
  Pin,
  Target,
  Download,
  Plus,
} from 'lucide-react-native';
import SetDailyTarget from './SetDailyTarget';

// --- Types & Interfaces ---
export interface NutrientData {
  id: string;
  name: string;
  amount: number;
  unit: string;
  target?: number;
  pctDV: number;
  weeklyAvg?: number;
  flag: 'low' | 'high' | 'none' | 'ok';
  hasAvoidPreference?: boolean;
  trend: number[]; // Array of 7 days
  topSources: string[];
  pinned?: boolean;
  recommendedValue?: number;
  currentTarget?: number;
}

export interface FoodSource {
  name: string;
  amount: number;
  unit: string;
  contribution: number;
}

interface NutritionDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNutrient: NutrientData | null;
  nutrientBreakdown?: FoodSource[];
  onPin?: (id: string) => void;
  onSetTarget?: () => void;
  onAddFood?: () => void;
  onMarkAvoid?: () => void;
}

// --- Theme / Color Map ---
const COLORS = {
  bg: {
    primary: 'white',
    tertiary: 'gray-100',
  },
  text: {
    primary: 'gray-900',
    secondary: 'gray-600',
    tertiary: 'gray-400',
  },
  accent: {
    primary: 'blue-500',
    light: 'blue-100',
  },
  status: {
    low: { bg: 'red-100', text: 'red-600', bar: 'red-400' },
    high: { bg: 'amber-100', text: 'amber-600', bar: 'amber-400' },
    ok: { bg: 'green-100', text: 'green-600', bar: 'green-400' },
    none: { bg: 'gray-100', text: 'gray-500', bar: 'gray-300' },
  },
};

// --- Helpers ---
const getStatusBadge = (flag: string, pctDV: number) => {
  switch (flag) {
    case 'low':
      return { label: `Low (${pctDV}%)`, ...COLORS.status.low };
    case 'high':
      return { label: `High (${pctDV}%)`, ...COLORS.status.high };
    case 'ok':
      return { label: `Optimal (${pctDV}%)`, ...COLORS.status.ok };
    default:
      return { label: 'No Target', ...COLORS.status.none };
  }
};

const getStatusColor = (flag: string) => {
   switch (flag) {
    case 'low': return COLORS.status.low;
    case 'high': return COLORS.status.high;
    case 'ok': return COLORS.status.ok;
    default: return COLORS.status.none;
  }
}

const hasNoTrendData = (trend?: number[]) =>
  !trend || trend.every(t => t === 0);
const hasPartialTrendData = (trend?: number[]) =>
  trend && trend.some(t => t > 0);
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const NutritionDetailDrawer: React.FC<NutritionDetailDrawerProps> = ({
  isOpen,
  onClose,
  selectedNutrient,
  nutrientBreakdown = [],
  onPin,
  onSetTarget,
  onAddFood,
  onMarkAvoid,
}) => {
  if (!selectedNutrient) return null;

  const [showModal, setShowModal] = React.useState(false);

  const openModal = () => {
    setShowModal(true);
  };

  return (
    <>
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[85]}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        className={`bg-${COLORS.bg.primary} rounded-t-3xl overflow-hidden`}
        style={{ maxHeight: '85%' }}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* --- Header --- */}
        <Box className={`w-full p-4 border-b border-${COLORS.bg.tertiary}`}>
          <HStack className="items-center justify-between mb-2">
            <Heading size="lg" className={`font-bold text-${COLORS.text.primary}`}>
              {selectedNutrient.name}
            </Heading>
            <Pressable
              onPress={onClose}
              className={`p-2 rounded-full bg-${COLORS.bg.tertiary}`}
            >
              <Icon
                as={X}
                size="sm"
                className={`text-${COLORS.text.primary}`}
              />
            </Pressable>
          </HStack>

          {/* Status Badge */}
          <Box className="flex-row mb-2">
            {(() => {
              const badge = getStatusBadge(
                selectedNutrient.flag,
                selectedNutrient.pctDV,
              );
              return (
                <Box className={`px-2.5 py-1 rounded-full bg-${badge.bg}`}>
                  <Text className={`text-[10px] font-semibold text-${badge.text}`}>
                    {badge.label}
                  </Text>
                </Box>
              );
            })()}
          </Box>

          {/* Context Information */}
          <HStack className="items-center gap-3 mt-1">
            <Text className={`text-[10px] text-${COLORS.text.secondary}`}>
              Current:{' '}
              <Text className={`text-[10px] font-bold text-${COLORS.text.primary}`}>
                {selectedNutrient.amount} {selectedNutrient.unit}
              </Text>
            </Text>
            <Text className={`text-[10px] text-${COLORS.text.secondary}`}>•</Text>
            <Text className={`text-[10px] text-${COLORS.text.secondary}`}>
              Target:{' '}
              <Text className={`text-[10px] font-bold text-${COLORS.text.primary}`}>
                {selectedNutrient.target || '—'} {selectedNutrient.target ? selectedNutrient.unit : ''}
              </Text>
            </Text>
            <Text className={`text-[10px] text-${COLORS.text.secondary}`}>•</Text>
            <Text className={`text-[10px] text-${COLORS.text.secondary}`}>
              Wk Avg:{' '}
              <Text className={`text-[10px] font-bold text-${COLORS.text.primary}`}>
                {selectedNutrient.weeklyAvg || '—'}%
              </Text>
            </Text>
          </HStack>
        </Box>

        {/* --- Scrollable Content --- */}
        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <VStack space="md" className="p-4">
            
            {/* 1. Today's Sources */}
            {nutrientBreakdown.length > 0 && !hasNoTrendData(selectedNutrient.trend) && (
              <Box>
                <Text className={`text-xs uppercase tracking-wide font-semibold mb-2 text-${COLORS.text.tertiary}`}>
                  Today's Sources
                </Text>
                <VStack space="xs">
                  {nutrientBreakdown.map((food, i) => (
                    <HStack
                      key={i}
                      className={`items-center justify-between p-2 rounded-lg bg-${COLORS.bg.tertiary}`}
                    >
                      <Text className={`text-xs text-${COLORS.text.primary}`}>
                        {food.name}
                      </Text>
                      <HStack className="items-center gap-3">
                        <Text className={`text-xs text-${COLORS.text.secondary}`}>
                          {food.amount}{food.unit}
                        </Text>
                        <Text className={`text-xs font-semibold w-10 text-right text-${COLORS.accent.primary}`}>
                          {food.contribution}%
                        </Text>
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}

            {/* 2. 7-Day Chart */}
            <Box>
              <Text className={`text-xs uppercase tracking-wide font-semibold mb-2 text-${COLORS.text.tertiary}`}>
                7-Day Trend
              </Text>

              {hasNoTrendData(selectedNutrient.trend) ? (
                // Empty State with Ghost Bars
                <Box className={`relative rounded-lg p-4 bg-${COLORS.bg.tertiary}`}>
                  {/* Ghost bars in background */}
                  <HStack className="absolute top-0 bottom-0 left-0 right-0 p-4 opacity-20 items-end gap-1">
                    {[30, 50, 40, 60, 45, 55, 35].map((h, i) => (
                      <Box
                        key={i}
                        className="flex-1 rounded-t bg-gray-400"
                        style={{ height: h }}
                      />
                    ))}
                  </HStack>
                  
                  {/* Empty state content */}
                  <VStack className="relative z-10 items-center py-4">
                    <Text className={`text-sm font-semibold mb-1 text-${COLORS.text.primary}`}>
                      No data detected for this nutrient
                    </Text>
                    <Text className={`text-xs mb-4 text-center text-${COLORS.text.secondary}`}>
                      We couldn't detect this nutrient in your last 7 days of call logs.
                    </Text>
                    
                    <HStack className="gap-2 justify-center mb-3">
                       <Pressable className={`px-3 py-1.5 rounded-lg bg-${COLORS.accent.light} flex-row items-center`}>
                          <Icon as={Utensils} size="xs" className={`text-${COLORS.accent.primary} mr-1`} />
                          <Text className={`text-[10px] font-semibold text-${COLORS.accent.primary}`}>Suggest Foods</Text>
                       </Pressable>
                       <Pressable className={`px-3 py-1.5 rounded-lg bg-${COLORS.accent.light} flex-row items-center`}>
                          <Icon as={Mic} size="xs" className={`text-${COLORS.accent.primary} mr-1`} />
                          <Text className={`text-[10px] font-semibold text-${COLORS.accent.primary}`}>Quick Add Call</Text>
                       </Pressable>
                       <Pressable className={`px-3 py-1.5 rounded-lg bg-${COLORS.bg.tertiary} flex-row items-center`}>
                          <Icon as={Phone} size="xs" className={`text-${COLORS.text.secondary} mr-1`} />
                          <Text className={`text-[10px] font-semibold text-${COLORS.text.secondary}`}>Recent Calls</Text>
                       </Pressable>
                    </HStack>
                    
                    <HStack className="items-center justify-center gap-1">
                      <Icon as={Info} size="xs" className={`w-[10px] h-[10px] text-${COLORS.text.tertiary}`} />
                      <Text className={`text-[9px] text-${COLORS.text.tertiary}`}>
                        Voice transcripts may miss certain nutrients.
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              ) : (
                // Regular chart with partial data handling
                <Box>
                  <HStack className="items-end justify-between gap-1 p-2 rounded-lg bg-gray-100" style={{ height: 96 }}>
                    {selectedNutrient.trend.map((val, i) => {
                      const isNoEntry = val === 0 && hasPartialTrendData(selectedNutrient.trend);
                      const statusKey = val > 100 ? 'high' : val < 50 ? 'low' : 'ok';
                      
                      // Get color values for inline styles
                      const getBarColor = (key: string) => {
                        switch(key) {
                          case 'low': return '#f87171'; // red-400
                          case 'high': return '#fbbf24'; // amber-400
                          case 'ok': return '#4ade80'; // green-400
                          default: return '#d1d5db'; // gray-300
                        }
                      };
                      
                      const barHeight = Math.min(val, 100);
                      
                      return (
                        <VStack key={i} className="flex-1 items-center gap-1 justify-end" style={{ height: '100%' }}>
                           <Box className="w-full relative items-center justify-end" style={{ flex: 1 }}>
                              {isNoEntry ? (
                                <Box className="absolute bottom-0 w-full bg-gray-200 rounded-t items-center justify-center" style={{ height: '30%' }}>
                                   <Text className="text-[6px] text-gray-400" style={{ transform: [{ rotate: '-90deg' }] }}>No entry</Text>
                                </Box>
                              ) : (
                                <Box 
                                  className="absolute bottom-0 w-full rounded-t" 
                                  style={{ 
                                    height: `${barHeight}%`,
                                    backgroundColor: getBarColor(statusKey)
                                  }} 
                                />
                              )}
                           </Box>
                           <Text className="text-[8px] text-gray-400">
                             {WEEK_DAYS[i]}
                           </Text>
                        </VStack>
                      );
                    })}
                  </HStack>
                  <Text className="text-[10px] mt-1.5 text-gray-400">
                    Trend shows daily intake over the last 7 days.
                  </Text>
                </Box>
              )}
            </Box>

            {/* 3. AI Recommendation */}
            <Box className="p-4 rounded-xl bg-amber-100">
               <HStack className="items-center gap-2 mb-2">
                 <Icon as={Lightbulb} size="sm" className="text-amber-600" />
                 <Text className="text-xs font-semibold text-amber-800">Recommendation</Text>
               </HStack>
               <Text className="text-xs text-amber-700 leading-relaxed">
                 {selectedNutrient.flag === 'low' 
                   ? `Your ${selectedNutrient.name} intake is below optimal. Consider adding ${selectedNutrient.topSources.join(' or ') || 'recommended foods'} to boost your levels.`
                   : selectedNutrient.flag === 'high'
                   ? `Your ${selectedNutrient.name} is above recommended levels. Try reducing intake from ${selectedNutrient.topSources.join(' and ') || 'common sources'}.`
                   : selectedNutrient.flag === 'none'
                   ? `Set a daily target to track your ${selectedNutrient.name} intake and receive personalized insights.`
                   : `Your ${selectedNutrient.name} intake is on track. Keep up the good work!`}
               </Text>
            </Box>

            {/* 4. Primary Action Buttons */}
            <HStack className="gap-2 items-stretch">
               {/* Pin Button */}
               <Pressable 
                 className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border border-${COLORS.accent.primary}`}
                 onPress={() => onPin && onPin(selectedNutrient.id)}
               >
                 <Icon as={Pin} size="xs" className={`text-${COLORS.accent.primary}`} />
                 <Text className={`text-xs font-semibold text-${COLORS.accent.primary}`}>
                    {selectedNutrient.pinned ? 'Unpin' : 'Pin'}
                 </Text>
               </Pressable>

               {/* Set Target Button */}
               <Pressable 
                  className={`flex-1 flex-col items-center justify-center py-2 rounded-xl border border-${COLORS.accent.primary}`}
                  onPress={() => setShowModal(true)}
               >
                 <HStack className="items-center gap-1">
                    <Icon as={Target} size="xs" className={`text-${COLORS.accent.primary}`} />
                    <Text className={`text-xs font-semibold text-${COLORS.accent.primary}`}>Set Daily Target</Text>
                 </HStack>
                 <Text className={`text-[9px] font-normal mt-0.5 text-${COLORS.text.tertiary}`}>
                    Define a personal goal
                 </Text>
               </Pressable>
            </HStack>

            {/* 5. Quick Actions with Helper Text */}
            <Box className="space-y-2">
               <HStack className="gap-2">
                  {/* Mark Avoid */}
                  <Pressable 
                     className="flex-1 flex-col items-center py-3 rounded-xl bg-red-100"
                     onPress={onMarkAvoid}
                  >
                     <HStack className="items-center">
                        <Icon as={Ban} size="xs" className="mr-1 text-red-600" />
                        <Text className="text-xs font-semibold text-red-600">Mark Foods to Avoid</Text>
                     </HStack>
                     <Text className="text-[9px] font-normal opacity-70 mt-0.5 text-red-600">
                        Improves recommendations
                     </Text>
                  </Pressable>
               </HStack>
            </Box>

          </VStack>
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
      {showModal && <SetDailyTarget RecommendedValue={selectedNutrient.recommendedValue} unit={selectedNutrient.unit} currentTarget={selectedNutrient.currentTarget} showModal={showModal} onClose={() => setShowModal(false)} onSave={(value) => {
        // TODO: Implement saving the target value
        console.log('Save target:', value);
        if (onSetTarget) onSetTarget();
      }}></SetDailyTarget>}
      </>
  );
};

export default NutritionDetailDrawer;