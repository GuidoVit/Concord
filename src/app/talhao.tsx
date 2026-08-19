import { useCallback, useMemo, useState } from "react";

import {
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppSettings } from "../context/AppSettingsContext";

import {
    avaliarAmostragem,
    calcularEstatisticas,
    classificarDensidade,
} from "../utils/woodscan";

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

function numeroArvore(nome: string) {
  const match = nome.match(/(\d+)$/);

  return match ? Number(match[1]) : 0;
}

export default function TalhaoScreen() {
  const params = useLocalSearchParams();

  const nome = String(params.nome ?? "");

  const [leituras, setLeituras] = useState<Leitura[]>([]);

  const [confirmarReset, setConfirmarReset] = useState(false);

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [nome]),
  );

  async function carregar() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    setLeituras(
      lista
        .filter((item) => item.talhao.toLowerCase() === nome.toLowerCase())
        .sort((a, b) => numeroArvore(a.arvore) - numeroArvore(b.arvore)),
    );
  }

  const estatisticas = useMemo(
    () => calcularEstatisticas(leituras.map((item) => item.densidadeEstimada)),
    [leituras],
  );

  const amostragem = avaliarAmostragem(
    estatisticas.quantidade,
    estatisticas.coeficienteVariacao,
  );

  const proxima = useMemo(() => {
    if (!leituras.length) {
      return "A1";
    }

    const maior = Math.max(
      ...leituras.map((item) => numeroArvore(item.arvore)),
    );

    return `A${maior + 1}`;
  }, [leituras]);

  async function continuar() {
    await AsyncStorage.setItem(
      "sessao_ativa",
      JSON.stringify({
        talhao: nome,
        proximaArvore: proxima,
        iniciadaEm: new Date().toISOString(),
      }),
    );

    router.push({
      pathname: "/leitura",

      params: {
        talhao: nome,
        arvore: proxima,
      },
    });
  }

  async function apagarTalhao() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    await AsyncStorage.setItem(
      "leituras",
      JSON.stringify(
        lista.filter(
          (item) => item.talhao.toLowerCase() !== nome.toLowerCase(),
        ),
      ),
    );

    setConfirmarReset(false);

    router.replace("/talhoes");
  }

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

          <Text style={styles.headerTitle}>{nome}</Text>

          <Text style={styles.headerSubtitle}>Análise do talhão</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>DENSIDADE MÉDIA</Text>

          <Text style={styles.summaryValue}>
            {leituras.length ? `≈ ${estatisticas.media.toFixed(0)}` : "--"}
          </Text>

          <Text style={styles.summaryUnit}>kg/m³</Text>

          <Text style={styles.summaryClass}>
            {leituras.length
              ? classificarDensidade(estatisticas.media)
              : "Sem amostras"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Qualidade da amostragem</Text>

        <View style={styles.qualityCard}>
          <View style={styles.qualityTop}>
            <View style={styles.qualityIcon}>
              <Ionicons
                name="analytics-outline"
                size={24}
                color={colors.primary}
              />
            </View>

            <View style={styles.qualityInfo}>
              <Text style={styles.qualityLabel}>AMOSTRAGEM</Text>

              <Text style={styles.qualityTitle}>{amostragem.nome}</Text>
            </View>

            <Text style={styles.qualityCount}>{leituras.length} árvores</Text>
          </View>

          <Text style={styles.qualityDescription}>{amostragem.descricao}</Text>
        </View>

        {leituras.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Variação do talhão</Text>

            <View style={styles.statsGrid}>
              <Stat
                label="MÍNIMA"
                value={`${estatisticas.minima.toFixed(0)}`}
                unit="kg/m³"
                styles={styles}
              />

              <Stat
                label="MÁXIMA"
                value={`${estatisticas.maxima.toFixed(0)}`}
                unit="kg/m³"
                styles={styles}
              />

              <Stat
                label="VARIAÇÃO"
                value={`${estatisticas.coeficienteVariacao.toFixed(1)}%`}
                unit="CV"
                styles={styles}
              />
            </View>

            {leituras.length > 1 && (
              <View style={styles.intervalCard}>
                <Text style={styles.intervalLabel}>
                  FAIXA ESTATÍSTICA DA MÉDIA
                </Text>

                <Text style={styles.intervalValue}>
                  ≈ {estatisticas.ic95Min.toFixed(0)}
                  {" – "}
                  {estatisticas.ic95Max.toFixed(0)} kg/m³
                </Text>

                <Text style={styles.intervalHelp}>
                  Intervalo aproximado de 95% baseado nas amostras coletadas.
                </Text>
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={styles.continueButton} onPress={continuar}>
          <View>
            <Text style={styles.continueTitle}>Continuar coleta</Text>

            <Text style={styles.continueSubtitle}>Iniciar {proxima}</Text>
          </View>

          <Ionicons name="arrow-forward" size={24} color="#173F27" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Árvores analisadas</Text>

        {leituras.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.treeCard}
            onPress={() =>
              router.push({
                pathname: "/leitura-detalhe",

                params: {
                  id: item.id,
                },
              })
            }
          >
            <View style={styles.treeIcon}>
              <Ionicons name="leaf-outline" size={21} color={colors.primary} />
            </View>

            <View style={styles.treeInfo}>
              <Text style={styles.treeTitle}>{item.arvore}</Text>

              <Text style={styles.treeSubtitle}>
                {item.diametro.toFixed(1)} cm • {item.velocidade.toFixed(0)} m/s
              </Text>
            </View>

            <View style={styles.treeResult}>
              <Text style={styles.treeValue}>
                ≈ {item.densidadeEstimada.toFixed(0)}
              </Text>

              <Text style={styles.treeUnit}>kg/m³</Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ))}

        {!!leituras.length && (
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => setConfirmarReset(true)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />

            <Text style={styles.manageText}>Apagar talhão</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={confirmarReset} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Apagar {nome}?</Text>

            <Text style={styles.modalText}>
              Todas as leituras deste talhão serão removidas.
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setConfirmarReset(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteConfirm}
              onPress={apagarTalhao}
            >
              <Text style={styles.deleteConfirmText}>Apagar talhão</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, unit, styles }: any) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>

      <Text style={styles.statValue}>{value}</Text>

      <Text style={styles.statUnit}>{unit}</Text>
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
      paddingBottom: 50,
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

    summaryCard: {
      margin: 20,
      backgroundColor: colors.header,
      borderRadius: 22,
      padding: 21,
    },

    summaryLabel: {
      color: "#AFC1B2",
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    summaryValue: {
      color: "#FFFFFF",
      fontSize: 38 * fontScale,
      fontWeight: "800",
      marginTop: 4,
    },

    summaryUnit: {
      color: colors.yellow,
      fontSize: 11 * fontScale,
    },

    summaryClass: {
      color: "#B8CABB",
      fontSize: 10 * fontScale,
      marginTop: 5,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: compacto ? 19 : 24,
      marginBottom: 11,
    },

    qualityCard: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 17,
      borderWidth: 1,
      borderColor: colors.border,
    },

    qualityTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    qualityIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      justifyContent: "center",
      alignItems: "center",
    },

    qualityInfo: {
      flex: 1,
      marginLeft: 11,
    },

    qualityLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    qualityTitle: {
      color: colors.text,
      fontSize: 17 * fontScale,
      fontWeight: "800",
    },

    qualityCount: {
      color: colors.primary,
      fontSize: 10 * fontScale,
      fontWeight: "800",
    },

    qualityDescription: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
      lineHeight: 16 * fontScale,
      marginTop: 13,
    },

    statsGrid: {
      flexDirection: "row",
      marginHorizontal: 14,
    },

    statCard: {
      flex: 1,
      marginHorizontal: 6,
      backgroundColor: colors.card,
      padding: compacto ? 12 : 15,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
    },

    statLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    statValue: {
      color: colors.text,
      fontSize: 19 * fontScale,
      fontWeight: "800",
      marginTop: 5,
    },

    statUnit: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
    },

    intervalCard: {
      marginHorizontal: 20,
      marginTop: 12,
      backgroundColor: colors.cardSecondary,
      borderRadius: 16,
      padding: 14,
    },

    intervalLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    intervalValue: {
      color: colors.text,
      fontSize: 17 * fontScale,
      fontWeight: "800",
      marginTop: 4,
    },

    intervalHelp: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      marginTop: 3,
    },

    continueButton: {
      marginHorizontal: 20,
      marginTop: 22,
      backgroundColor: colors.yellow,
      padding: 17,
      borderRadius: 19,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    continueTitle: {
      color: "#173F27",
      fontSize: 16 * fontScale,
      fontWeight: "800",
    },

    continueSubtitle: {
      color: "#52654F",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },

    treeCard: {
      marginHorizontal: 20,
      marginBottom: 9,
      backgroundColor: colors.card,
      borderRadius: 17,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
    },

    treeIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.cardSecondary,
      justifyContent: "center",
      alignItems: "center",
    },

    treeInfo: {
      flex: 1,
      marginLeft: 11,
    },

    treeTitle: {
      color: colors.text,
      fontSize: 14 * fontScale,
      fontWeight: "800",
    },

    treeSubtitle: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
    },

    treeResult: {
      alignItems: "flex-end",
      marginRight: 8,
    },

    treeValue: {
      color: colors.text,
      fontSize: 14 * fontScale,
      fontWeight: "800",
    },

    treeUnit: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
    },

    manageButton: {
      margin: 20,
      marginTop: 25,
      padding: 14,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
    },

    manageText: {
      color: colors.danger,
      fontWeight: "700",
      marginLeft: 7,
    },

    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      padding: 25,
    },

    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 23,
    },

    modalTitle: {
      color: colors.text,
      fontSize: 19 * fontScale,
      fontWeight: "800",
      textAlign: "center",
    },

    modalText: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
      textAlign: "center",
      marginTop: 7,
    },

    cancelButton: {
      marginTop: 20,
      backgroundColor: colors.cardSecondary,
      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    cancelText: {
      color: colors.text,
      fontWeight: "800",
    },

    deleteConfirm: {
      marginTop: 8,
      backgroundColor: colors.danger,
      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    deleteConfirmText: {
      color: "#FFFFFF",
      fontWeight: "800",
    },
  });
}
