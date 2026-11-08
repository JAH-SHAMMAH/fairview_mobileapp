import { Ionicons } from "@expo/vector-icons";
import { ColorValue, Text } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoleProvider, useRole } from "../../src/lib/role";
import { colors } from "../../src/lib/theme";
import { Loading } from "../../src/components/ui";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (n: IconName, nf: IconName) => {
  const TabIcon = ({ color, focused, size }: { color: any; focused: boolean; size: number }) => <Ionicons name={focused ? n : nf} size={size + 2} color={color} />;
  return TabIcon;
};
// One line, shrinking to fit on narrow phones instead of "Atten…" / "Childr…".
const TabLabel = ({ color, children }: { color: ColorValue | null; children: string }) => (
  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: color ?? undefined, fontWeight: "700", fontSize: 10, letterSpacing: -0.1 }}>{children}</Text>
);

// Screens reached from inside the app (an exam, a report, user admin...) that
// should never show a button in the tab bar. Not `href: null`: since expo-router
// 58 that marks the route hidden and redirects anyone landing on it to the first
// tab, so every one of these screens bounced straight back to Home.
const SCREEN_ONLY = { tabBarButton: () => null, tabBarItemStyle: { display: "none" as const }, tabBarStyle: { display: "none" as const } };

function TabsByRole() {
  const { role, isLoading } = useRole();
  const parent = role === "parent";
  const student = role === "student";
  const admin = role === "admin";
  const staff = role === "admin" || role === "teacher";
  // A fixed height replaces the navigator's own safe-area padding, so on iPhones
  // with a home indicator (and Android gesture bars) the labels sat under the bar.
  // Add the bottom inset back. Labels (TabLabel) are 10pt and shrink to fit,
  // so six tabs fit a 360-375pt phone without "Attendance" being cut to "Atte...".
  const { bottom } = useSafeAreaInsets();
  const padBottom = Math.max(bottom, 10);
  // Wait for the role before building the tabs: a role tab (Children, School...)
  // is hidden until then, and expo-router sends anyone focused on a hidden tab to
  // Home, so opening the app from an attendance alert landed on Home, not Children.
  if (isLoading) return <Loading />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: "#fff", borderTopColor: colors.border, height: 58 + padBottom, paddingBottom: padBottom, paddingTop: 6 }, tabBarLabel: TabLabel, tabBarItemStyle: { paddingHorizontal: 0 } }}>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
      <Tabs.Screen name="children" options={{ title: "Children", href: parent ? undefined : null, tabBarIcon: icon("people", "people-outline") }} />
      <Tabs.Screen name="fees" options={{ title: "Fees", href: parent ? undefined : null, tabBarIcon: icon("card", "card-outline") }} />
      <Tabs.Screen name="exams" options={{ title: "Exams", href: student ? undefined : null, tabBarIcon: icon("document-text", "document-text-outline") }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", href: student ? undefined : null, tabBarIcon: icon("trending-up", "trending-up-outline") }} />
      <Tabs.Screen name="mark" options={{ title: "Attendance", href: staff ? undefined : null, tabBarIcon: icon("checkbox", "checkbox-outline") }} />
      <Tabs.Screen name="cbt" options={{ title: "CBT", href: role === "teacher" ? undefined : null, tabBarIcon: icon("podium", "podium-outline") }} />
      <Tabs.Screen name="school" options={{ title: "School", href: admin ? undefined : null, tabBarIcon: icon("school", "school-outline") }} />
      <Tabs.Screen name="feed" options={{ title: "Feed", tabBarIcon: icon("newspaper", "newspaper-outline") }} />
      <Tabs.Screen name="notices" options={{ title: "Notices", tabBarIcon: icon("notifications", "notifications-outline") }} />
      <Tabs.Screen name="remark/[id]" options={SCREEN_ONLY} />
      <Tabs.Screen name="entry" options={SCREEN_ONLY} />
      <Tabs.Screen name="practice" options={SCREEN_ONLY} />
      <Tabs.Screen name="exam/[id]" options={SCREEN_ONLY} />
      <Tabs.Screen name="report/[id]" options={SCREEN_ONLY} />
      <Tabs.Screen name="attendance/[id]" options={SCREEN_ONLY} />
      <Tabs.Screen name="users/index" options={SCREEN_ONLY} />
      <Tabs.Screen name="users/[id]" options={SCREEN_ONLY} />
      <Tabs.Screen name="users/new" options={SCREEN_ONLY} />
      <Tabs.Screen name="backup" options={SCREEN_ONLY} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
    </Tabs>
  );
}

export default function AppLayout() {
  return <RoleProvider><TabsByRole /></RoleProvider>;
}
