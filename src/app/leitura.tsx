import { useEffect, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { router, useLocalSearchParams } from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppSettings } from "../context/AppSettingsContext";

import {
    obterLeituraESP32,
    obterLeituraSimulada,
} from "../services/sensorService";

import {
    calcularVelocidade,
    estimarDensidade,
    validarLeitura,
} from "../utils/woodscan";

export default function LeituraScreen() {
  const params = useLocalSearchParams();

  const talhao = String(params.talhao ?? "");

  const arvore = String(params.arvore ?? "");

  const [diametro, setDiametro] = useState("");

  const [tempoUltrassom, setTempoUltrassom] = useState("");

  const [buscandoSensor, setBuscandoSensor] = useState(false);

  const [ultimaOrigem, setUltimaOrigem] = useState<
    "manual" | "simulado" | "esp32" | null
  >(null);

  const [avisosPreview, setAvisosPreview] = useState<string[]>([]);

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  useEffect(() => {
    carregarRascunho();
  }, [talhao, arvore]);

  useEffect(() => {
    atualizarValidacao();
  }, [diametro, tempoUltrassom, configuracoes.calibracao]);

  async function carregarRascunho() {
    try {
      const salvo = await AsyncStorage.getItem(`rascunho_${talhao}_${arvore}`);

      if (!salvo) return;

      const dados = JSON.parse(salvo);

      setDiametro(dados.diametro ?? "");

      setTempoUltrassom(dados.tempoUltrassom ?? "");

      if (dados.origem) {
        setUltimaOrigem(dados.origem);
      }
    } catch (erro) {
      console.log(erro);
    }
  }

  async function salvarRascunho(
    novoDiametro: string,
    novoTempo: string,
    origem: "manual" | "simulado" | "esp32" | null,
  ) {
    await AsyncStorage.setItem(
      `rascunho_${talhao}_${arvore}`,
      JSON.stringify({
        talhao,
        arvore,
        diametro: novoDiametro,
        tempoUltrassom: novoTempo,
        origem,
        atualizadoEm: new Date().toISOString(),
      }),
    );
  }

  function atualizarValidacao() {
    const d = Number(diametro.replace(",", "."));

    const t = Number(tempoUltrassom.replace(",", "."));

    if (!d || !t) {
      setAvisosPreview([]);
      return;
    }

    const velocidade = calcularVelocidade(d, t);

    const validacao = validarLeitura(
      d,
      t,
      velocidade,
      configuracoes.calibracao,
    );

    setAvisosPreview([...validacao.erros, ...validacao.avisos]);
  }

  function atualizarDiametro(valor: string) {
    setDiametro(valor);
    setUltimaOrigem("manual");

    salvarRascunho(valor, tempoUltrassom, "manual");
  }

  function atualizarTempo(valor: string) {
    setTempoUltrassom(valor);
    setUltimaOrigem("manual");

    salvarRascunho(diametro, valor, "manual");
  }

  async function simular() {
    try {
      setBuscandoSensor(true);

      const leitura = await obterLeituraSimulada();

      const d = leitura.diametro.toString();

      const t = leitura.tempoUltrassom.toString();

      setDiametro(d);
      setTempoUltrassom(t);

      setUltimaOrigem("simulado");

      await salvarRascunho(d, t, "simulado");
    } finally {
      setBuscandoSensor(false);
    }
  }

  async function buscarESP32() {
    try {
      setBuscandoSensor(true);

      const leitura = await obterLeituraESP32(configuracoes.esp32Url);

      const d = leitura.diametro.toString();

      const t = leitura.tempoUltrassom.toString();

      setDiametro(d);
      setTempoUltrassom(t);

      setUltimaOrigem("esp32");

      await salvarRascunho(d, t, "esp32");
    } catch (erro: any) {
      mostrarErro("Grampo indisponível", erro.message);
    } finally {
      setBuscandoSensor(false);
    }
  }

  function mostrarErro(titulo: string, mensagem: string) {
    if (Platform.OS === "web") {
      window.alert(`${titulo}\n\n${mensagem}`);
    } else {
      Alert.alert(titulo, mensagem);
    }
  }

  function processar() {
    const d = Number(diametro.replace(",", "."));

    const t = Number(tempoUltrassom.replace(",", "."));

    const velocidade = calcularVelocidade(d, t);

    const validacao = validarLeitura(
      d,
      t,
      velocidade,
      configuracoes.calibracao,
    );

    if (!validacao.valido) {
      mostrarErro("Leitura inválida", validacao.erros.join("\n\n"));

      return;
    }

    const densidade = estimarDensidade(velocidade, configuracoes.calibracao);

    router.push({
      pathname: "/resultado",

      params: {
        talhao,
        arvore,

        diametro: d.toString(),

        tempoUltrassom: t.toString(),

        velocidade: velocidade.toString(),

        densidade: densidade.toString(),

        origem: ultimaOrigem ?? configuracoes.modoSensor,

        avisos: JSON.stringify(validacao.avisos),
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

          <Text style={styles.headerTitle}>Leitura ultrassônica</Text>

          <Text style={styles.headerSubtitle}>
            {talhao} • {arvore}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Aquisição</Text>

        <View style={styles.sensorCard}>
          <View style={styles.sensorHeader}>
            <View style={styles.sensorIcon}>
              <Ionicons
                name={
                  configuracoes.modoSensor === "simulado"
                    ? "flask-outline"
                    : configuracoes.modoSensor === "esp32"
                      ? "wifi-outline"
                      : "create-outline"
                }
                size={25}
                color={colors.yellow}
              />
            </View>

            <View style={styles.sensorInfo}>
              <Text style={styles.sensorLabel}>
                {configuracoes.modoSensor === "simulado"
                  ? "MODO SIMULADO"
                  : configuracoes.modoSensor === "esp32"
                    ? "GRAMPO ESP32"
                    : "ENTRADA MANUAL"}
              </Text>

              <Text style={styles.sensorDescription}>
                {talhao} • {arvore}
              </Text>
            </View>
          </View>

          {configuracoes.modoSensor === "simulado" && (
            <TouchableOpacity style={styles.sensorButton} onPress={simular}>
              {buscandoSensor ? (
                <ActivityIndicator color="#173F27" />
              ) : (
                <>
                  <Ionicons name="play-outline" size={21} color="#173F27" />

                  <Text style={styles.sensorButtonText}>Simular leitura</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {configuracoes.modoSensor === "esp32" && (
            <TouchableOpacity style={styles.sensorButton} onPress={buscarESP32}>
              {buscandoSensor ? (
                <ActivityIndicator color="#173F27" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={21} color="#173F27" />

                  <Text style={styles.sensorButtonText}>
                    Buscar leitura do grampo
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Dados da medição</Text>

        <View style={styles.card}>
          <Campo
            label="DIÂMETRO / DISTÂNCIA ENTRE SENSORES"
            value={diametro}
            onChange={atualizarDiametro}
            unit="cm"
            icon="resize-outline"
            editable={configuracoes.modoSensor !== "esp32"}
            colors={colors}
            styles={styles}
          />

          <View style={{ height: 18 }} />

          <Campo
            label="TEMPO ULTRASSÔNICO"
            value={tempoUltrassom}
            onChange={atualizarTempo}
            unit="µs"
            icon="timer-outline"
            editable={configuracoes.modoSensor !== "esp32"}
            colors={colors}
            styles={styles}
          />
        </View>

        {avisosPreview.length > 0 && (
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={21} color={colors.warning} />

            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>Verifique a leitura</Text>

              {avisosPreview.map((item, index) => (
                <Text key={index} style={styles.warningText}>
                  • {item}
                </Text>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.processButton,

            (!diametro || !tempoUltrassom) && styles.disabled,
          ]}
          disabled={!diametro || !tempoUltrassom}
          onPress={processar}
        >
          <Ionicons name="analytics-outline" size={24} color="#173F27" />

          <View style={styles.buttonInfo}>
            <Text style={styles.buttonTitle}>Processar leitura</Text>

            <Text style={styles.buttonSubtitle}>
              Validar e calcular densidade
            </Text>
          </View>

          <Ionicons name="arrow-forward" size={24} color="#173F27" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Campo({
  label,
  value,
  onChange,
  unit,
  icon,
  editable,
  colors,
  styles,
}: any) {
  return (
    <>
      <Text style={styles.inputLabel}>{label}</Text>

      <View style={styles.inputContainer}>
        <Ionicons name={icon} size={21} color={colors.primary} />

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          editable={editable}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.unit}>{unit}</Text>
      </View>
    </>
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
      letterSpacing: 1.5,
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
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: compacto ? 19 : 24,
      marginBottom: 11,
    },

    sensorCard: {
      marginHorizontal: 20,
      backgroundColor: colors.headerSecondary,
      borderRadius: 20,
      padding: compacto ? 15 : 18,
    },

    sensorHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    sensorIcon: {
      width: 48,
      height: 48,
      borderRadius: 15,
      backgroundColor: colors.header,
      justifyContent: "center",
      alignItems: "center",
    },

    sensorInfo: {
      marginLeft: 13,
      flex: 1,
    },

    sensorLabel: {
      color: "#FFFFFF",
      fontSize: 11 * fontScale,
      fontWeight: "800",
    },

    sensorDescription: {
      color: "#B8CABB",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },

    sensorButton: {
      marginTop: 16,
      backgroundColor: colors.yellow,
      padding: 14,
      borderRadius: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },

    sensorButtonText: {
      color: "#173F27",
      fontWeight: "800",
      fontSize: 13 * fontScale,
    },

    card: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: compacto ? 15 : 19,
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
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
    },

    input: {
      flex: 1,
      paddingVertical: 14,
      marginLeft: 10,
      color: colors.text,
      fontSize: 15 * fontScale,
      outlineStyle: "none",
    } as any,

    unit: {
      color: colors.textMuted,
      fontWeight: "700",
    },

    warningCard: {
      marginHorizontal: 20,
      marginTop: 14,
      backgroundColor: colors.warningBackground,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "flex-start",
    },

    warningContent: {
      flex: 1,
      marginLeft: 10,
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
      marginBottom: 3,
    },

    processButton: {
      marginHorizontal: 20,
      marginTop: 22,
      backgroundColor: colors.yellow,
      borderRadius: 20,
      padding: compacto ? 15 : 18,
      flexDirection: "row",
      alignItems: "center",
    },

    buttonInfo: {
      flex: 1,
      marginLeft: 12,
    },

    buttonTitle: {
      color: "#173F27",
      fontSize: 16 * fontScale,
      fontWeight: "800",
    },

    buttonSubtitle: {
      color: "#52654F",
      fontSize: 10 * fontScale,
      marginTop: 3,
    },

    disabled: {
      opacity: 0.45,
    },
  });
}
