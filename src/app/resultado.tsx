import { useState } from "react";

import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { router, useLocalSearchParams } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppSettings } from "../context/AppSettingsContext";

import { calcularAptidao, classificarDensidade } from "../utils/woodscan";

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
  avisos?: string[];
};

function proximoNome(atual: string) {
  const match = atual.match(/^(.*?)(\d+)$/);

  if (!match) {
    return "A2";
  }

  return `${match[1]}${Number(match[2]) + 1}`;
}

export default function ResultadoScreen() {
  const params = useLocalSearchParams();

  const talhao = String(params.talhao ?? "");

  const arvore = String(params.arvore ?? "");

  const diametro = Number(params.diametro ?? 0);

  const tempo = Number(params.tempoUltrassom ?? 0);

  const velocidade = Number(params.velocidade ?? 0);

  const densidade = Number(params.densidade ?? 0);

  const origem = String(params.origem ?? "manual");

  let avisos: string[] = [];

  try {
    avisos = params.avisos ? JSON.parse(String(params.avisos)) : [];
  } catch {
    avisos = [];
  }

  const [salvando, setSalvando] = useState(false);

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  const aptidao = calcularAptidao(densidade);

  const principal = aptidao[0];

  const proximaArvore = proximoNome(arvore);

  async function salvar() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    const leitura: Leitura = {
      id: Date.now().toString(),

      talhao,
      arvore,
      diametro,

      tempoUltrassom: tempo,

      velocidade,

      densidadeEstimada: densidade,

      origem,
      avisos,

      data: new Date().toISOString(),
    };

    const indice = lista.findIndex(
      (item) =>
        item.talhao.toLowerCase() === talhao.toLowerCase() &&
        item.arvore.toLowerCase() === arvore.toLowerCase(),
    );

    if (indice >= 0) {
      leitura.id = lista[indice].id;

      lista[indice] = leitura;
    } else {
      lista.push(leitura);
    }

    await AsyncStorage.setItem("leituras", JSON.stringify(lista));

    await AsyncStorage.removeItem(`rascunho_${talhao}_${arvore}`);
  }

  async function proxima() {
    try {
      setSalvando(true);

      await salvar();

      await AsyncStorage.setItem(
        "sessao_ativa",
        JSON.stringify({
          talhao,
          proximaArvore,
          iniciadaEm: new Date().toISOString(),
        }),
      );

      router.replace({
        pathname: "/leitura",

        params: {
          talhao,
          arvore: proximaArvore,
        },
      });
    } finally {
      setSalvando(false);
    }
  }

  async function finalizar() {
    try {
      setSalvando(true);

      await salvar();

      await AsyncStorage.removeItem("sessao_ativa");

      router.replace({
        pathname: "/talhao",

        params: {
          nome: talhao,
        },
      });
    } finally {
      setSalvando(false);
    }
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

          <Text style={styles.headerTitle}>Resultado</Text>

          <Text style={styles.headerSubtitle}>
            {talhao} • {arvore}
          </Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>DENSIDADE ESTIMADA</Text>

          <View style={styles.resultRow}>
            <Text style={styles.resultValue}>≈ {densidade.toFixed(0)}</Text>

            <Text style={styles.resultUnit}>kg/m³</Text>
          </View>

          <Text style={styles.classification}>
            {classificarDensidade(densidade)}
          </Text>
        </View>

        {avisos.length > 0 && (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={21} color={colors.warning} />

            <View
              style={{
                flex: 1,
                marginLeft: 10,
              }}
            >
              <Text style={styles.warningTitle}>Observação da medição</Text>

              {avisos.map((aviso, index) => (
                <Text key={index} style={styles.warningText}>
                  • {aviso}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Uso mais indicado</Text>

        <View style={styles.useCard}>
          <Ionicons name="ribbon-outline" size={28} color={colors.yellow} />

          <View style={styles.useInfo}>
            <Text style={styles.useLabel}>MAIOR ÍNDICE DE APTIDÃO</Text>

            <Text style={styles.useTitle}>{principal.nome}</Text>

            <Text style={styles.useSubtitle}>
              Índice WoodScan: {principal.valor}%
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Dados técnicos</Text>

        <View style={styles.metrics}>
          <Metric
            label="DIÂMETRO"
            value={diametro.toFixed(1)}
            unit="cm"
            styles={styles}
          />

          <Metric
            label="VELOCIDADE"
            value={velocidade.toFixed(0)}
            unit="m/s"
            styles={styles}
          />

          <Metric
            label="ORIGEM"
            value={
              origem === "simulado"
                ? "Teste"
                : origem === "esp32"
                  ? "ESP32"
                  : "Manual"
            }
            unit=""
            styles={styles}
          />
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>PRÓXIMA AMOSTRA</Text>

          <Text style={styles.nextTitle}>
            {talhao} • {proximaArvore}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={proxima}
          disabled={salvando}
        >
          <View>
            <Text style={styles.nextButtonTitle}>Próxima leitura</Text>

            <Text style={styles.nextButtonSubtitle}>
              Salvar {arvore} e abrir {proximaArvore}
            </Text>
          </View>

          <Ionicons name="arrow-forward" size={25} color="#173F27" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.finishButton}
          onPress={finalizar}
          disabled={salvando}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={21}
            color={colors.primary}
          />

          <Text style={styles.finishText}>Finalizar coleta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, unit, styles }: any) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>

      <Text style={styles.metricValue}>{value}</Text>

      {!!unit && <Text style={styles.metricUnit}>{unit}</Text>}
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

    resultCard: {
      margin: 20,
      backgroundColor: colors.header,
      borderRadius: 22,
      padding: compacto ? 18 : 22,
    },

    resultLabel: {
      color: "#AFC1B2",
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    resultRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 5,
    },

    resultValue: {
      color: "#FFFFFF",
      fontSize: 40 * fontScale,
      fontWeight: "800",
    },

    resultUnit: {
      color: colors.yellow,
      fontSize: 13 * fontScale,
      fontWeight: "800",
      marginLeft: 6,
      marginBottom: 6,
    },

    classification: {
      color: "#B8CABB",
      fontSize: 11 * fontScale,
      marginTop: 5,
    },

    warningCard: {
      marginHorizontal: 20,
      backgroundColor: colors.warningBackground,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
    },

    warningTitle: {
      color: colors.warning,
      fontSize: 12 * fontScale,
      fontWeight: "800",
      marginBottom: 5,
    },

    warningText: {
      color: colors.textSecondary,
      fontSize: 10 * fontScale,
      lineHeight: 15 * fontScale,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 11,
    },

    useCard: {
      marginHorizontal: 20,
      backgroundColor: colors.headerSecondary,
      padding: compacto ? 15 : 18,
      borderRadius: 20,
      flexDirection: "row",
      alignItems: "center",
    },

    useInfo: {
      marginLeft: 13,
      flex: 1,
    },

    useLabel: {
      color: colors.yellow,
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    useTitle: {
      color: "#FFFFFF",
      fontSize: 18 * fontScale,
      fontWeight: "800",
    },

    useSubtitle: {
      color: "#B9CABB",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },

    metrics: {
      flexDirection: "row",
      marginHorizontal: 14,
    },

    metricCard: {
      flex: 1,
      marginHorizontal: 6,
      backgroundColor: colors.card,
      borderRadius: 17,
      padding: compacto ? 12 : 15,
      borderWidth: 1,
      borderColor: colors.border,
    },

    metricLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    metricValue: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginTop: 5,
    },

    metricUnit: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
    },

    nextCard: {
      marginHorizontal: 20,
      marginTop: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
    },

    nextLabel: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    nextTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginTop: 4,
    },

    nextButton: {
      marginHorizontal: 20,
      marginTop: 16,
      backgroundColor: colors.yellow,
      borderRadius: 20,
      padding: compacto ? 15 : 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    nextButtonTitle: {
      color: "#173F27",
      fontSize: 17 * fontScale,
      fontWeight: "800",
    },

    nextButtonSubtitle: {
      color: "#52654F",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },

    finishButton: {
      marginHorizontal: 20,
      marginTop: 11,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },

    finishText: {
      color: colors.primary,
      fontWeight: "800",
      marginLeft: 8,
    },
  });
}
