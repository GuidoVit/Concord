import { useCallback, useState } from "react";

import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
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
};

type TalhaoResumo = {
  nome: string;
  leituras: Leitura[];
  quantidade: number;
  densidadeMedia: number;
  proximaArvore: string;
};

function numeroArvore(nome: string) {
  const match = nome.match(/(\d+)$/);

  return match ? Number(match[1]) : 0;
}

function proximaArvore(leituras: Leitura[]) {
  const numeros = leituras
    .map((item) => numeroArvore(item.arvore))
    .filter((n) => n > 0);

  if (!numeros.length) {
    return "A1";
  }

  return `A${Math.max(...numeros) + 1}`;
}

function classificar(densidade: number) {
  if (densidade < 450) {
    return "Baixa densidade";
  }

  if (densidade < 550) {
    return "Densidade média";
  }

  if (densidade < 650) {
    return "Média-alta densidade";
  }

  return "Alta densidade";
}

export default function TalhoesScreen() {
  const [talhoes, setTalhoes] = useState<TalhaoResumo[]>([]);

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

    const leituras: Leitura[] = salvo ? JSON.parse(salvo) : [];

    const grupos: Record<string, Leitura[]> = {};

    leituras.forEach((item) => {
      const chave = item.talhao.trim();

      if (!grupos[chave]) {
        grupos[chave] = [];
      }

      grupos[chave].push(item);
    });

    const resumo = Object.entries(grupos).map(([nome, lista]) => {
      const media =
        lista.reduce((total, item) => total + item.densidadeEstimada, 0) /
        lista.length;

      return {
        nome,
        leituras: lista,
        quantidade: lista.length,
        densidadeMedia: media,
        proximaArvore: proximaArvore(lista),
      };
    });

    setTalhoes(resumo);
  }

  async function continuar(talhao: TalhaoResumo) {
    await AsyncStorage.setItem(
      "sessao_ativa",
      JSON.stringify({
        talhao: talhao.nome,
        proximaArvore: talhao.proximaArvore,
        iniciadaEm: new Date().toISOString(),
      }),
    );

    router.push({
      pathname: "/leitura",

      params: {
        talhao: talhao.nome,
        arvore: talhao.proximaArvore,
      },
    });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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

          <Text style={styles.headerTitle}>Talhões</Text>

          <Text style={styles.headerSubtitle}>Áreas monitoradas</Text>
        </View>

        <Text style={styles.sectionTitle}>Talhões salvos</Text>

        {!talhoes.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={38} color={colors.primary} />

            <Text style={styles.emptyTitle}>Nenhum talhão salvo</Text>

            <Text style={styles.emptyText}>
              Finalize pelo menos uma leitura para que o talhão apareça aqui.
            </Text>
          </View>
        ) : (
          talhoes.map((talhao) => (
            <View key={talhao.nome} style={styles.card}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/talhao",

                    params: {
                      nome: talhao.nome,
                    },
                  })
                }
              >
                <View style={styles.cardHeader}>
                  <View style={styles.icon}>
                    <Ionicons
                      name="map-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.cardLabel}>ÁREA MONITORADA</Text>

                    <Text style={styles.cardTitle}>{talhao.nome}</Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={colors.textMuted}
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>ÁRVORES</Text>

                    <Text style={styles.metricValue}>{talhao.quantidade}</Text>
                  </View>

                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>DENSIDADE MÉDIA</Text>

                    <Text style={styles.metricValue}>
                      ≈ {talhao.densidadeMedia.toFixed(0)}
                    </Text>

                    <Text style={styles.metricUnit}>kg/m³</Text>
                  </View>

                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>PRÓXIMA</Text>

                    <Text style={styles.metricValue}>
                      {talhao.proximaArvore}
                    </Text>
                  </View>
                </View>

                <View style={styles.classification}>
                  <Text style={styles.classificationLabel}>CLASSIFICAÇÃO</Text>

                  <Text style={styles.classificationValue}>
                    {classificar(talhao.densidadeMedia)}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => continuar(talhao)}
              >
                <View>
                  <Text style={styles.continueTitle}>Continuar coleta</Text>

                  <Text style={styles.continueSubtitle}>
                    Iniciar {talhao.proximaArvore}
                  </Text>
                </View>

                <Ionicons name="arrow-forward" size={24} color="#173F27" />
              </TouchableOpacity>
            </View>
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
      marginTop: 3,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 19 * fontScale,
      fontWeight: "800",
      margin: 20,
      marginBottom: 12,
    },

    emptyCard: {
      marginHorizontal: 20,
      padding: 25,
      backgroundColor: colors.card,
      borderRadius: 20,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    emptyTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginTop: 10,
    },

    emptyText: {
      color: colors.textMuted,
      fontSize: 11 * fontScale,
      textAlign: "center",
      marginTop: 6,
    },

    card: {
      marginHorizontal: 20,
      marginBottom: 18,
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: compacto ? 14 : 18,
      borderWidth: 1,
      borderColor: colors.border,
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    icon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: colors.cardSecondary,
      alignItems: "center",
      justifyContent: "center",
    },

    cardInfo: {
      flex: 1,
      marginLeft: 13,
    },

    cardLabel: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    cardTitle: {
      color: colors.text,
      fontSize: 19 * fontScale,
      fontWeight: "800",
      marginTop: 2,
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: compacto ? 12 : 16,
    },

    metrics: {
      flexDirection: "row",
    },

    metric: {
      flex: 1,
    },

    metricLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    metricValue: {
      color: colors.text,
      fontSize: 20 * fontScale,
      fontWeight: "800",
      marginTop: 5,
    },

    metricUnit: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
    },

    classification: {
      marginTop: 16,
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 13,
    },

    classificationLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    classificationValue: {
      color: colors.text,
      fontSize: 13 * fontScale,
      fontWeight: "800",
      marginTop: 3,
    },

    continueButton: {
      marginTop: 16,
      backgroundColor: colors.yellow,
      borderRadius: 17,
      padding: compacto ? 13 : 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    continueTitle: {
      color: "#173F27",
      fontSize: 15 * fontScale,
      fontWeight: "800",
    },

    continueSubtitle: {
      color: "#52654F",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },
  });
}
