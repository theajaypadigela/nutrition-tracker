import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import MealReminderSettings from '../../components/food-log/MealReminderSettings';

/**
 * Standalone "Meal Reminders" screen (reached from Profile). The controls themselves live in
 * the reusable MealReminderSettings component, which is also embedded inline on the Food Log
 * page so users can manage food reminders where they log their meals.
 */
export default function MealScheduleScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <MealReminderSettings variant="screen" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },
  content: { padding: 24 },
});
