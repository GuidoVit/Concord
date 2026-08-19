import { useCallback, useMemo, useState } from "react";

import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { router, useFocusEffect } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppSettings } from "../context/AppSettingsContext";

type Leitura = {
  id: string;
  talhao: string;
  arvore: string;
  diametro: number;
  tempoUltrassom: number;
  velocidade: number;
  densidadeEstimada: number;
  data: string;
  origem?: string;
};

export default function HistoricoScreen() {
  const [leituras, setLeituras] = useState<Leitura[]>([]);

  const [busca, setBusca] = useState("");

  const [filtroTalhao, setFiltroTalhao] = useState("Todos");

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  async function carregar() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    setLeituras(
      [...lista].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      ),
    );
  }

  const talhoes = useMemo(() => {
    return [
      "Todos",
      ...Array.from(new Set(leituras.map((item) => item.talhao))),
    ];
  }, [leituras]);

  const filtradas = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    return leituras.filter((item) => {
      const talhaoOk = filtroTalhao === "Todos" || item.talhao === filtroTalhao;

      const buscaOk =
        !texto ||
        item.talhao.toLowerCase().includes(texto) ||
        item.arvore.toLowerCase().includes(texto);

      return talhaoOk && buscaOk;
    });
  }, [leituras, busca, filtroTalhao]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />

              <Text style={styles.headerButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.replace("/")}
            >
              <Ionicons name="home-outline" size={19} color="#FFFFFF" />

              <Text style={styles.headerButtonText}>Início</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.headerLabel}>WOODSCAN</Text>

          <Text style={styles.headerTitle}>Histórico</Text>

          <Text style={styles.headerSubtitle}>
            {leituras.length} leituras salvas
          </Text>
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={colors.primary} />

          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar talhão ou árvore..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {talhoes.map((talhao) => (
            <TouchableOpacity
              key={talhao}
              style={[
                styles.filter,

                filtroTalhao === talhao && styles.filterActive,
              ]}
              onPress={() => setFiltroTalhao(talhao)}
            >
              <Text
                style={[
                  styles.filterText,

                  filtroTalhao === talhao && styles.filterTextActive,
                ]}
              >
                {talhao}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Leituras</Text>

        {!filtradas.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={34} color={colors.primary} />

            <Text style={styles.emptyTitle}>Nenhuma leitura encontrada</Text>
          </View>
        ) : (
          filtradas.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.readingCard}
              onPress={() =>
                router.push({
                  pathname: "/leitura-detalhe",

                  params: {
                    id: item.id,
                  },
                })
              }
            >
              <View style={styles.readingIcon}>
                <Ionicons
                  name="leaf-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.readingInfo}>
                <Text style={styles.readingTitle}>
                  {item.talhao} • {item.arvore}
                </Text>

                <Text style={styles.readingSubtitle}>
                  {item.diametro.toFixed(1)} cm • {item.velocidade.toFixed(0)}{" "}
                  m/s
                </Text>
              </View>

              <View style={styles.readingResult}>
                <Text style={styles.readingValue}>
                  ≈ {item.densidadeEstimada.toFixed(0)}
                </Text>

                <Text style={styles.readingUnit}>kg/m³</Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function criarStyles(colors: any, fontScale: number, compacto: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingBottom: 45,
    },

    header: {
      backgroundColor: colors.header,
      paddingTop: 45,
      paddingHorizontal: 20,
      paddingBottom: 28,
    },

    headerActions: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 18,
    },

    headerButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.headerSecondary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
    },

    homeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
    },

    headerButtonText: {
      color: "#FFFFFF",
      fontSize: 11 * fontScale,
      fontWeight: "700",
    },

    headerLabel: {
      color: colors.yellow,
      fontSize: 10 * fontScale,
      fontWeight: "800",
    },

    headerTitle: {
      color: "#FFFFFF",
      fontSize: 27 * fontScale,
      fontWeight: "800",
    },

    headerSubtitle: {
      color: "#B9CABB",
      fontSize: 12 * fontScale,
    },

    searchCard: {
      margin: 20,
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    searchInput: {
      flex: 1,
      marginLeft: 9,
      paddingVertical: 13,
      color: colors.text,
      outlineStyle: "none",
    } as any,

    filters: {
      paddingHorizontal: 20,
      gap: 8,
    },

    filter: {
      backgroundColor: colors.card,
      borderRadius: 13,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.border,
    },

    filterActive: {
      backgroundColor: colors.header,
      borderColor: colors.header,
    },

    filterText: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
      fontWeight: "700",
    },

    filterTextActive: {
      color: "#FFFFFF",
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 11,
    },

    readingCard: {
      marginHorizontal: 20,
      marginBottom: compacto ? 7 : 10,
      backgroundColor: colors.card,
      borderRadius: 17,
      padding: compacto ? 12 : 15,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    readingIcon: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },

    readingInfo: {
      flex: 1,
      marginLeft: 11,
    },

    readingTitle: {
      color: colors.text,
      fontSize: 14 * fontScale,
      fontWeight: "800",
    },

    readingSubtitle: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      marginTop: 3,
    },

    readingResult: {
      alignItems: "flex-end",
      marginRight: 9,
    },

    readingValue: {
      color: colors.text,
      fontSize: 15 * fontScale,
      fontWeight: "800",
    },

    readingUnit: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
    },

    emptyCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 30,
      alignItems: "center",
    },

    emptyTitle: {
      color: colors.text,
      fontWeight: "800",
      marginTop: 10,
    },
  });
}
