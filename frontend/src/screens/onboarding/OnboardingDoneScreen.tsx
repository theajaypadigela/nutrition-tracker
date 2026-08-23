import React, { useEffect, useRef } from 'react';
import { tokens } from '@/theme/tokens';
import { Animated, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Check } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useOnboarding } from '@/context/OnboardingContext';
import { ROUTES } from '@/navigation/routeNames';
import { PrimaryButton } from '@/components/auth';

/**
 * Success landing shown after call setup (or skip). Confirms the daily call time, then
 * sends the user to the dashboard and clears the one-time onboarding flag.
 */
export default function OnboardingDoneScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();
  const callTime = (route.params as { callTime?: string } | undefined)?.callTime;

  const pop = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  const goToDashboard = () => {
    completeOnboarding();
    navigation.replace(ROUTES.MAIN_TABS);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.auth.surface} />
      <View style={styles.center}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <LinearGradient
            colors={[tokens.auth.greenMid, tokens.auth.green, tokens.auth.greenDeep]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.mark}
          >
            <Check size={46} color={tokens.auth.white} strokeWidth={3} />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.title}>You’re all set</Text>
        <Text style={styles.subtitle}>
          {callTime ? (
            <>
              We’ll call you each day at{' '}
              <Text style={styles.strong}>{callTime}</Text> to log your meals.
              Your nutrition dashboard is ready.
            </>
          ) : (
            <>
              Your nutrition dashboard is ready. You can set up your daily call
              anytime from Profile.
            </>
          )}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <PrimaryButton
          onPress={goToDashboard}
          trailing={<ArrowRight size={20} color={tokens.auth.white} />}
        >
          Go to dashboard
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.auth.surface },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  mark: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.auth.green,
    shadowOpacity: 0.33,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: tokens.auth.ink,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: tokens.auth.inkSoft,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 320,
  },
  strong: { color: tokens.auth.greenDeep, fontWeight: '800' },
  footer: { paddingHorizontal: 30, paddingTop: 18 },
});
