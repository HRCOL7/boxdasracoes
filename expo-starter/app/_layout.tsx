import { Stack } from 'expo-router';

// Navegação por pilha: cada <Stack.Screen> é uma tela. O título aparece no topo (e é lido pelo leitor de tela).
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Box das Rações' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Produto' }} />
    </Stack>
  );
}
