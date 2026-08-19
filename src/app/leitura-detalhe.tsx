import { useCallback, useState } from "react";

import {
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppSettings } from "../context/AppSettingsContext";

import {
    calcularVelocidade,
    estimarDensidade,
    validarLeitura,
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
  origem?: string;
  avisos?: string[];
};

export default function LeituraDetalheScreen() {
  const params = useLocalSearchParams();

  const id = String(params.id ?? "");

  const [leitura, setLeitura] = useState<Leitura | null>(null);

  const [diametro, setDiametro] = useState("");

  const [tempo, setTempo] = useState("");

  const [confirmarExcluir, setConfirmarExcluir] = useState(false);

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(colors, fontScale);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [id]),
  );

  async function carregar() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    const encontrada = lista.find((item) => item.id === id);

    if (!encontrada) {
      router.back();
      return;
    }

    setLeitura(encontrada);

    setDiametro(encontrada.diametro.toString());

    setTempo(encontrada.tempoUltrassom.toString());
  }

  async function salvarAlteracoes() {
    if (!leitura) return;

    const d = Number(diametro.replace(",", "."));

    const t = Number(tempo.replace(",", "."));

    const velocidade = calcularVelocidade(d, t);

    const validacao = validarLeitura(
      d,
      t,
      velocidade,
      configuracoes.calibracao,
    );

    if (!validacao.valido) {
      return;
    }

    const densidade = estimarDensidade(velocidade, configuracoes.calibracao);

    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    const atualizada = lista.map((item) =>
      item.id === id
        ? {
            ...item,

            diametro: d,

            tempoUltrassom: t,

            velocidade,

            densidadeEstimada: densidade,

            avisos: validacao.avisos,
          }
        : item,
    );

    await AsyncStorage.setItem("leituras", JSON.stringify(atualizada));

    router.back();
  }

  async function excluir() {
    const salvo = await AsyncStorage.getItem("leituras");

    const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

    const restantes = lista.filter((item) => item.id !== id);

    await AsyncStorage.setItem("leituras", JSON.stringify(restantes));

    setConfirmarExcluir(false);

    router.back();
  }

  if (!leitura) {
    return <View style={styles.container} />;
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

          <Text style={styles.headerTitle}>{leitura.arvore}</Text>

          <Text style={styles.headerSubtitle}>{leitura.talhao}</Text>
        </View>

        <Text style={styles.sectionTitle}>Corrigir medição</Text>

        <View style={styles.card}>
          <Campo
            titulo="DIÂMETRO"
            valor={diametro}
            onChange={setDiametro}
            unidade="cm"
            styles={styles}
          />

          <View style={{ height: 18 }} />

          <Campo
            titulo="TEMPO ULTRASSÔNICO"
            valor={tempo}
            onChange={setTempo}
            unidade="µs"
            styles={styles}
          />
        </View>

        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>RESULTADO ATUAL</Text>

          <Text style={styles.currentValue}>
            ≈ {leitura.densidadeEstimada.toFixed(0)} kg/m³
          </Text>

          <Text style={styles.currentHelp}>
            Ao salvar, velocidade e densidade serão recalculadas
            automaticamente.
          </Text>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={salvarAlteracoes}>
          <Text style={styles.saveText}>Salvar correção</Text>

          <Ionicons name="checkmark" size={22} color="#173F27" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => setConfirmarExcluir(true)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />

          <Text style={styles.deleteText}>Excluir esta leitura</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={confirmarExcluir} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.modalCard}>
            <Ionicons name="warning-outline" size={35} color={colors.danger} />

            <Text style={styles.modalTitle}>Excluir {leitura.arvore}?</Text>

            <Text style={styles.modalText}>
              Apenas esta leitura será apagada. As outras árvores do talhão
              permanecerão salvas.
            </Text>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setConfirmarExcluir(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmButton} onPress={excluir}>
              <Text style={styles.confirmText}>Excluir leitura</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Campo({ titulo, valor, onChange, unidade, styles }: any) {
  return (
    <>
      <Text style={styles.inputLabel}>{titulo}</Text>

      <View style={styles.inputContainer}>
        <TextInput
          value={valor}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <Text style={styles.unit}>{unidade}</Text>
      </View>
    </>
  );
}

function criarStyles(colors: any, fontScale: number) {
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

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      margin: 20,
      marginBottom: 11,
    },

    card: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },

    inputLabel: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    inputContainer: {
      marginTop: 8,
      backgroundColor: colors.input,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },

    input: {
      flex: 1,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 15 * fontScale,
      outlineStyle: "none",
    } as any,

    unit: {
      color: colors.textMuted,
    },

    currentCard: {
      marginHorizontal: 20,
      marginTop: 16,
      backgroundColor: colors.headerSecondary,
      borderRadius: 18,
      padding: 17,
    },

    currentLabel: {
      color: colors.yellow,
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    currentValue: {
      color: "#FFFFFF",
      fontSize: 22 * fontScale,
      fontWeight: "800",
      marginTop: 4,
    },

    currentHelp: {
      color: "#B9CABB",
      fontSize: 9 * fontScale,
      marginTop: 5,
    },

    saveButton: {
      marginHorizontal: 20,
      marginTop: 20,
      backgroundColor: colors.yellow,
      padding: 17,
      borderRadius: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    saveText: {
      color: "#173F27",
      fontSize: 15 * fontScale,
      fontWeight: "800",
    },

    deleteButton: {
      marginHorizontal: 20,
      marginTop: 10,
      padding: 15,
      borderRadius: 16,
      backgroundColor: colors.dangerBackground,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },

    deleteText: {
      color: colors.danger,
      fontWeight: "800",
      marginLeft: 8,
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
      padding: 24,
      alignItems: "center",
    },

    modalTitle: {
      color: colors.text,
      fontSize: 19 * fontScale,
      fontWeight: "800",
      marginTop: 12,
    },

    modalText: {
      color: colors.textMuted,
      textAlign: "center",
      fontSize: 10 * fontScale,
      lineHeight: 16 * fontScale,
      marginTop: 7,
    },

    cancelButton: {
      width: "100%",
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      marginTop: 20,
      alignItems: "center",
    },

    cancelText: {
      color: colors.text,
      fontWeight: "800",
    },

    confirmButton: {
      width: "100%",
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.danger,
      marginTop: 8,
      alignItems: "center",
    },

    confirmText: {
      color: "#FFFFFF",
      fontWeight: "800",
    },
  });
}
