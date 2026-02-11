import * as React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from './components/LoginScreen';
import RegisterScreen from './components/RegisterScreen';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import DashBoardScreen from './components/DashBoardScreen';
import AppBar from './components/AppBar';
import BottomNavigation from './components/BottomNavigation';
import HabitScreen from './components/HabitScreen';
import ProfileScreen from './components/ProfileScreen';
import FoodLogScreen from './components/FoodLogScreen';
import NutritionReportScreen from './components/NutritionReportScreen';

function App() {
  return (
    <GluestackUIProvider>
      <SafeAreaView style={{ flex: 1 }}>
        {/* <LoginScreen /> */}
        {/* <RegisterScreen /> */}
        <AppBar title="Habits" />
        {/* <DashBoardScreen /> */}
        {/* <HabitScreen></HabitScreen> */}
        {/* <ProfileScreen name="Ajay" age="30" gender="Male"></ProfileScreen> */}
        {/* <FoodLogScreen></FoodLogScreen> */}
        <NutritionReportScreen></NutritionReportScreen>
        <BottomNavigation activeTab="habits" onTabChange={() => {}} />
      </SafeAreaView>
    </GluestackUIProvider>
  );
}

export default App;
