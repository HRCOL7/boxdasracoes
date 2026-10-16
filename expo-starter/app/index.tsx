import { View, Text } from 'react-native';

/**
 * EXERCÍCIO 2 — lista de produtos (tela inicial).
 *
 * Passos sugeridos (um de cada vez, testando no celular entre eles):
 *  1. useState para a lista, para "carregando" e para erro.
 *  2. useEffect que chama fetchProducts() (src/services/products.ts) e preenche a lista.
 *  3. Troque o <View> por <FlatList data=... renderItem=... keyExtractor=...> com <ProductCard />.
 *  4. Ao tocar no cartão: router.push(`/product/${product.id}`)  (import { router } from 'expo-router').
 *  5. Estados: carregando → <ActivityIndicator accessibilityLabel="Carregando produtos" />;
 *     erro → mensagem + botão "Tentar de novo"; lista vazia → "Nenhum produto encontrado".
 *  6. Bônus: <TextInput> de busca (accessibilityLabel="Buscar produtos") com espera de 400 ms (debounce).
 */
export default function HomeScreen() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800' }}>Produtos</Text>
    </View>
  );
}
