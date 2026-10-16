import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

/**
 * EXERCÍCIO 4 — detalhe do produto.
 *  - useLocalSearchParams() devolve { id } (vem do nome do arquivo [id].tsx).
 *  - Carregue com fetchProduct(Number(id)).
 *  - Mostre as variantes (pesos) como botões com accessibilityState={{ selected }} e recalcule o preço com getUnitPrice(product, indice).
 *  - Botão "Adicionar ao carrinho" (Exercício 5).
 */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>Produto {id}</Text>
    </View>
  );
}
