import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/Home/HomeScreen';
import AraNavigator from './AraNavigator';
import ClosetNavigator from './ClosetNavigator';
import OutfitsNavigator from './OutfitsNavigator';
import ProfileNavigator from './ProfileNavigator';
import CalendarNavigator from './CalendarNavigator';
import ChatScreen from '../screens/Chat/ChatScreen';
import { makeComingSoonScreen } from '../screens/ComingSoon/ComingSoonScreen';
import { FigmaTabBar } from '../components/FigmaTabBar';

const Tab = createBottomTabNavigator();

const GoalsScreen = makeComingSoonScreen('Goals');
const ClubScreen = makeComingSoonScreen('Club');

// Bottom nav follows the Figma design: Me / Journal / Goals / Fits / Club.
// The bar itself is drawn by FigmaTabBar, which only shows those five.
//
// Tab -> screen mapping:
//   Me      -> Style Profile hub (body shape, colour analysis)
//   Journal -> Outfit calendar
//   Goals   -> placeholder until the real screen exists
//   Fits    -> HomeScreen (route name kept as "HomeTab" so every existing
//              navigate('HomeTab') call still works)
//   Club    -> placeholder until the real screen exists
//
// Ara, Closet, Outfits and Chat stay registered as routes (no button in the
// bar) so the hamburger menu, FAB actions and deep links into them keep
// working exactly as before.
export default function RootTabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      // Bug: with no backBehavior set, React Navigation's default tab
      // history could send the hardware/gesture back button (which
      // bubbles straight to this tab navigator, bypassing any screen's
      // own header back-button logic, whenever a section's own nested
      // stack has nothing left to pop) to whatever tab was focused
      // before the current one — e.g. Me/Profile, if that's how the
      // person happened to reach Outfits/Closet/Ara/Chat. "initialRoute"
      // makes that always resolve to HomeTab (Fits) instead, regardless
      // of which tab was visited previously — matching every section's
      // own explicit "back to Fits" behavior (see PageHeader/ScreenHeader).
      backBehavior="initialRoute"
      tabBar={(props) => <FigmaTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="MeTab" component={ProfileNavigator} />
      <Tab.Screen name="JournalTab" component={CalendarNavigator} />
      <Tab.Screen name="GoalsTab" component={GoalsScreen} />
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="ClubTab" component={ClubScreen} />

      {/* Reachable from the menu / in-app links, not shown in the bar */}
      <Tab.Screen name="AraTab" component={AraNavigator} />
      <Tab.Screen name="ClosetTab" component={ClosetNavigator} />
      <Tab.Screen name="OutfitsTab" component={OutfitsNavigator} />
      <Tab.Screen name="ChatTab" component={ChatScreen} />
    </Tab.Navigator>
  );
}
