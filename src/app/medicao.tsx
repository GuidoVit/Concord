import { useState } from "react";

import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { useAppSettings } from "../context/AppSettingsContext";

export default function MedicaoScreen() {
  const [hectare, setHectare] = useState("");
  const [arvore, setArvore] = useState("A1");

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  function tratarHectare(valor: string) {
    const somenteNumeros = valor.replace(/[^0-9]/g, "");

    setHectare(somenteNumeros);
  }

  async function iniciarLeitura() {
    const numeroHectare = hectare.trim();

    const nomeArvore = arvore.trim();

    if (!numeroHectare) {
      Alert.alert("Hectare obrigatório", "Informe o número do hectare.");

      return;
    }

    if (!nomeArvore) {
      Alert.alert("Árvore obrigatória", "Informe a identificação da árvore.");

      return;
    }

    /*
      Mantemos a propriedade "talhao"
      internamente para não quebrar
      o restante do aplicativo.

      Mas o valor salvo agora será:
      Hectare 1
      Hectare 2
      etc.
    */

    const nomeHectare = `Hectare ${numeroHectare}`;

    try {
      await AsyncStorage.setItem(
        "sessao_ativa",
        JSON.stringify({
          talhao: nomeHectare,

          proximaArvore: nomeArvore,

          iniciadaEm: new Date().toISOString(),
        }),
      );

      router.push({
        pathname: "/leitura",

        params: {
          talhao: nomeHectare,

          arvore: nomeArvore,
        },
      });
    } catch (erro) {
      console.log("Erro ao iniciar coleta:", erro);

      Alert.alert("Erro", "Não foi possível iniciar a coleta.");
    }
  }

  const podeContinuar = hectare.trim().length > 0 && arvore.trim().length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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

          <Text style={styles.headerTitle}>Nova medição</Text>

          <Text style={styles.headerSubtitle}>
            Identifique a área e a árvore
          </Text>
        </View>

        <View style={styles.stepsCard}>
          <View style={styles.step}>
            <View style={styles.stepCircleActive}>
              <Text style={styles.stepNumberActive}>1</Text>
            </View>

            <Text style={styles.stepTextActive}>Identificação</Text>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>2</Text>
            </View>

            <Text style={styles.stepText}>Leitura</Text>
          </View>

          <View style={styles.stepLine} />

          <View style={styles.step}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>3</Text>
            </View>

            <Text style={styles.stepText}>Resultado</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Identificação da amostra</Text>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>HECTARE</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="map-outline" size={21} color={colors.primary} />

            <View style={styles.hectarePrefix}>
              <Text style={styles.hectarePrefixText}>Hectare</Text>
            </View>

            <TextInput
              style={styles.hectareInput}
              value={hectare}
              onChangeText={tratarHectare}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              maxLength={5}
            />
          </View>

          <Text style={styles.fieldHelp}>Digite somente o número da área.</Text>

          <Text
            style={[
              styles.inputLabel,
              {
                marginTop: 22,
              },
            ]}
          >
            IDENTIFICAÇÃO DA ÁRVORE
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="leaf-outline" size={21} color={colors.primary} />

            <TextInput
              style={styles.input}
              value={arvore}
              onChangeText={setArvore}
              placeholder="A1"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Prévia</Text>

        <View style={styles.previewCard}>
          <View style={styles.previewIcon}>
            <Ionicons
              name="location-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.previewInfo}>
            <Text style={styles.previewLabel}>AMOSTRA A SER MEDIDA</Text>

            <Text style={styles.previewTitle}>
              {hectare ? `Hectare ${hectare}` : "Hectare --"}
              {" • "}
              {arvore || "--"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Dispositivo</Text>

        <View style={styles.deviceCard}>
          <View style={styles.deviceIcon}>
            <Ionicons
              name="hardware-chip-outline"
              size={27}
              color={colors.yellow}
            />
          </View>

          <View style={styles.deviceContent}>
            <Text style={styles.deviceLabel}>GRAMPO ULTRASSÔNICO</Text>

            <Text style={styles.deviceName}>Dispositivo de medição</Text>

            <View style={styles.connectionRow}>
              <View style={styles.connectionDot} />

              <Text style={styles.connectionText}>
                {configuracoes.modoSensor === "manual"
                  ? "Modo manual"
                  : configuracoes.modoSensor === "simulado"
                    ? "Modo simulado"
                    : "Modo ESP32"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Preparação</Text>

        <View style={styles.instructionsCard}>
          <Instruction
            number="1"
            text="Posicione o grampo ao redor do tronco."
            styles={styles}
          />

          <Instruction
            number="2"
            text="Garanta que os sensores estejam em lados opostos."
            styles={styles}
          />

          <Instruction
            number="3"
            text="Mantenha os sensores pressionados contra a superfície."
            styles={styles}
          />

          <Instruction
            number="4"
            text="Confirme o hectare e a árvore antes de iniciar."
            styles={styles}
          />
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !podeContinuar && styles.disabled]}
          disabled={!podeContinuar}
          onPress={iniciarLeitura}
        >
          <View>
            <Text style={styles.continueTitle}>Continuar para leitura</Text>

            <Text style={styles.continueSubtitle}>
              Preparar sensores ultrassônicos
            </Text>
          </View>

          <Ionicons name="arrow-forward" size={26} color="#173F27" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Instruction({ number, text, styles }: any) {
  return (
    <View style={styles.instruction}>
      <View style={styles.instructionNumber}>
        <Text style={styles.instructionNumberText}>{number}</Text>
      </View>

      <Text style={styles.instructionText}>{text}</Text>
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
      letterSpacing: 1.5,
    },

    headerTitle: {
      color: "#FFFFFF",
      fontSize: 27 * fontScale,
      fontWeight: "800",
      marginTop: 2,
    },

    headerSubtitle: {
      color: "#B9CABB",
      fontSize: 12 * fontScale,
      marginTop: 3,
    },

    stepsCard: {
      margin: 20,
      padding: compacto ? 14 : 18,
      borderRadius: 20,
      backgroundColor: colors.card,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    step: {
      alignItems: "center",
    },

    stepCircleActive: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },

    stepCircle: {
      width: 31,
      height: 31,
      borderRadius: 16,
      backgroundColor: colors.cardSecondary,
      justifyContent: "center",
      alignItems: "center",
    },

    stepNumberActive: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    stepNumber: {
      color: colors.textMuted,
      fontWeight: "800",
    },

    stepTextActive: {
      color: colors.text,
      fontSize: 9 * fontScale,
      fontWeight: "700",
      marginTop: 5,
    },

    stepText: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      marginTop: 5,
    },

    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: colors.border,
      marginHorizontal: 7,
    },

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: compacto ? 19 : 24,
      marginBottom: 11,
    },

    card: {
      backgroundColor: colors.card,
      marginHorizontal: 20,
      padding: compacto ? 15 : 19,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },

    inputLabel: {
      fontSize: 9 * fontScale,
      color: colors.textMuted,
      fontWeight: "800",
      letterSpacing: 1,
    },

    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      marginTop: 8,
      paddingHorizontal: 14,
    },

    hectarePrefix: {
      marginLeft: 10,
    },

    hectarePrefixText: {
      color: colors.text,
      fontSize: 14 * fontScale,
      fontWeight: "700",
    },

    hectareInput: {
      flex: 1,
      paddingVertical: 14,
      marginLeft: 6,
      color: colors.text,
      fontSize: 14 * fontScale,
      outlineStyle: "none",
    } as any,

    input: {
      flex: 1,
      paddingVertical: 14,
      marginLeft: 10,
      color: colors.text,
      fontSize: 14 * fontScale,
      outlineStyle: "none",
    } as any,

    fieldHelp: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      marginTop: 6,
    },

    previewCard: {
      marginHorizontal: 20,
      padding: 16,
      backgroundColor: colors.cardSecondary,
      borderRadius: 18,
      flexDirection: "row",
      alignItems: "center",
    },

    previewIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },

    previewInfo: {
      flex: 1,
      marginLeft: 11,
    },

    previewLabel: {
      color: colors.textMuted,
      fontSize: 8 * fontScale,
      fontWeight: "800",
    },

    previewTitle: {
      color: colors.text,
      fontSize: 15 * fontScale,
      fontWeight: "800",
      marginTop: 3,
    },

    deviceCard: {
      backgroundColor: colors.headerSecondary,
      marginHorizontal: 20,
      borderRadius: 20,
      padding: compacto ? 14 : 17,
      flexDirection: "row",
      alignItems: "center",
    },

    deviceIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.header,
      alignItems: "center",
      justifyContent: "center",
    },

    deviceContent: {
      flex: 1,
      marginLeft: 13,
    },

    deviceLabel: {
      color: "#A9C0AD",
      fontSize: 9 * fontScale,
      fontWeight: "800",
    },

    deviceName: {
      color: "#FFFFFF",
      fontSize: 15 * fontScale,
      fontWeight: "700",
      marginTop: 3,
    },

    connectionRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 7,
    },

    connectionDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.yellow,
      marginRight: 6,
    },

    connectionText: {
      color: "#D4DFD5",
      fontSize: 10 * fontScale,
    },

    instructionsCard: {
      backgroundColor: colors.card,
      marginHorizontal: 20,
      borderRadius: 20,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },

    instruction: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: compacto ? 11 : 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    instructionNumber: {
      width: 31,
      height: 31,
      borderRadius: 10,
      backgroundColor: colors.cardSecondary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },

    instructionNumberText: {
      color: colors.primary,
      fontWeight: "800",
    },

    instructionText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 11 * fontScale,
    },

    continueButton: {
      marginHorizontal: 20,
      marginTop: 24,
      backgroundColor: colors.yellow,
      borderRadius: 20,
      padding: compacto ? 15 : 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    disabled: {
      opacity: 0.45,
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
  });
}
