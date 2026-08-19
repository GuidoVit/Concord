import { useState } from "react";

import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppSettings } from "../context/AppSettingsContext";

import {
    obterLeituraESP32,
    obterLeituraSimulada,
} from "../services/sensorService";

export default function DiagnosticoScreen() {
  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(colors, fontScale);

  const [testando, setTestando] = useState(false);

  const [resultado, setResultado] = useState<any>(null);

  async function testar() {
    setTestando(true);
    setResultado(null);

    const inicio = Date.now();

    try {
      const dados =
        configuracoes.modoSensor === "esp32"
          ? await obterLeituraESP32(configuracoes.esp32Url)
          : await obterLeituraSimulada();

      setResultado({
        sucesso: true,
        latencia: Date.now() - inicio,
        dados,
      });
    } catch (erro: any) {
      setResultado({
        sucesso: false,
        latencia: Date.now() - inicio,
        mensagem: erro.message,
      });
    } finally {
      setTestando(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <ScrollView>
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

          <Text style={styles.headerTitle}>Diagnóstico</Text>

          <Text style={styles.headerSubtitle}>Comunicação e sensores</Text>
        </View>

        <Text style={styles.sectionTitle}>Configuração atual</Text>

        <View style={styles.card}>
          <Linha
            label="Modo"
            value={configuracoes.modoSensor}
            styles={styles}
          />

          <Linha label="ESP32" value={configuracoes.esp32Url} styles={styles} />

          <Linha label="Endpoint" value="/leitura" styles={styles} />
        </View>

        <TouchableOpacity
          style={styles.testButton}
          onPress={testar}
          disabled={testando}
        >
          {testando ? (
            <ActivityIndicator color="#173F27" />
          ) : (
            <>
              <Ionicons name="pulse-outline" size={22} color="#173F27" />

              <Text style={styles.testText}>Testar dispositivo</Text>
            </>
          )}
        </TouchableOpacity>

        {resultado && (
          <>
            <Text style={styles.sectionTitle}>Resultado</Text>

            <View
              style={[
                styles.resultCard,

                resultado.sucesso ? styles.success : styles.error,
              ]}
            >
              <Text style={styles.resultTitle}>
                {resultado.sucesso ? "Comunicação OK" : "Falha na comunicação"}
              </Text>

              <Text style={styles.resultText}>
                Latência: {resultado.latencia} ms
              </Text>

              {resultado.sucesso && (
                <>
                  <Text style={styles.resultText}>
                    Diâmetro: {resultado.dados.diametro} cm
                  </Text>

                  <Text style={styles.resultText}>
                    Tempo: {resultado.dados.tempoUltrassom} µs
                  </Text>
                </>
              )}

              {!resultado.sucesso && (
                <Text style={styles.resultText}>{resultado.mensagem}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Linha({ label, value, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>

      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function criarStyles(colors: any, fontScale: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
    },

    rowLabel: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
    },

    rowValue: {
      color: colors.text,
      fontSize: 10 * fontScale,
      fontWeight: "700",
      maxWidth: "65%",
    },

    testButton: {
      margin: 20,
      backgroundColor: colors.yellow,
      borderRadius: 18,
      padding: 17,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },

    testText: {
      color: "#173F27",
      fontWeight: "800",
    },

    resultCard: {
      marginHorizontal: 20,
      padding: 18,
      borderRadius: 18,
    },

    success: {
      backgroundColor: colors.successBackground,
    },

    error: {
      backgroundColor: colors.dangerBackground,
    },

    resultTitle: {
      color: colors.text,
      fontSize: 15 * fontScale,
      fontWeight: "800",
    },

    resultText: {
      color: colors.textSecondary,
      fontSize: 10 * fontScale,
      marginTop: 6,
    },
  });
}
