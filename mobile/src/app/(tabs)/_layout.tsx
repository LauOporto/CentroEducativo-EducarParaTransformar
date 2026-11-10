import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { HijosProvider } from '@/hijos/HijosContext';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  return (
    <HijosProvider>
      <Tabs
        // "Volver" (y la tecla atrás de Android) regresa a la pestaña anterior, no siempre a Inicio.
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.blue500,
          tabBarInactiveTintColor: colors.inkFaint,
          tabBarLabelStyle: { fontFamily: fonts.bodySemibold, fontSize: 12 },
          tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
          sceneStyle: { backgroundColor: colors.paper },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="pagos"
          options={{
            title: 'Pagos',
            tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="servicios"
          options={{
            title: 'Servicios',
            tabBarIcon: ({ color, size }) => <Ionicons name="football-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="cuenta"
          options={{
            title: 'Mi cuenta',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" color={String(color)} size={size} />
            ),
          }}
        />
      </Tabs>
    </HijosProvider>
  );
}
