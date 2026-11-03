import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { RoleProvider, useRole } from "../../src/lib/role";
import { colors } from "../../src/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (n: IconName, nf: IconName) => ({ color, focused, size }: { color: any; focused: boolean; size: number }) => <Ionicons name={focused ? n : nf} size={size + 2} color={color} />;

function TabsByRole() {
  const { role } = useRole();
  const parent = role === "parent";
  const student = role === "student";
  const admin = role === "admin";
  const staff = role === "admin" || role === "teacher";
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.brand, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: "#fff", borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontWeight: "700", fontSize: 12 } }}>
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
      <Tabs.Screen name="practice" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="exam/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="report/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="attendance/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
    </Tabs>
  );
}

export default function AppLayout() {
  return <RoleProvider><TabsByRole /></RoleProvider>;
}
