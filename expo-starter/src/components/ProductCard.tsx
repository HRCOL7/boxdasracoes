import { Pressable, Text, View, Image, StyleSheet } from 'react-native';
import type { Product } from '../types/product';
import { colors, spacing, MIN_TOUCH } from '../theme';

type Props = { product: Product; onPress: (product: Product) => void };

/**
 * EXERCÍCIO 3 — cartão de produto (acessível).
 *
 * Objetivo: mostrar foto, nome e preço; ao tocar, chamar onPress(product).
 * Checklist de acessibilidade (é o que um leitor de tela — TalkBack/VoiceOver — precisa):
 *  - <Pressable> com accessibilityRole="button" e accessibilityLabel claro:
 *      "Ração Premium 15kg, a partir de R$ 212,00. Toque duas vezes para ver detalhes."
 *  - Imagem decorativa: accessible={false} (o nome já está no texto).
 *  - Altura mínima de toque: MIN_TOUCH (48).
 *  - Produto indisponível: diga isso no label também, não só com cor.
 * Dica: use getUnitPrice() e formatBRL() do Exercício 1.
 */
export function ProductCard({ product, onPress }: Props) {
  return (
    <Pressable onPress={() => onPress(product)} style={styles.card}>
      {/* TODO: Image + Text do nome + Text do preço + props de acessibilidade */}
      <View>
        <Text style={styles.name}>{product.name}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: MIN_TOUCH, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12, marginBottom: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
