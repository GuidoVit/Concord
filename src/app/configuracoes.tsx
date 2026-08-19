import { useState } from "react";

import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppSettings } from "../context/AppSettingsContext";

export default function ConfiguracoesScreen() {
  const {
    configuracoes,

    setTema,
    setTextoMaior,
    setInterfaceCompacta,

    setModoSensor,
    setEsp32Url,

    setCalibracao,
    resetCalibracao,

    colors,
    fontScale,
  } = useAppSettings();

  const styles = criarStyles(colors, fontScale);

  const [url, setUrl] = useState(configuracoes.esp32Url);

  function numero(valor: string) {
    return Number(valor.replace(",", "."));
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

          <Text style={styles.headerTitle}>Configurações</Text>
        </View>

        <Text style={styles.sectionTitle}>Interface</Text>

        <View style={styles.card}>
          <Text style={styles.label}>TEMA</Text>

          <View style={styles.segment}>
            <Option
              label="Claro"
              active={configuracoes.tema === "claro"}
              onPress={() => setTema("claro")}
              styles={styles}
            />

            <Option
              label="Escuro"
              active={configuracoes.tema === "escuro"}
              onPress={() => setTema("escuro")}
              styles={styles}
            />
          </View>

          <View style={styles.divider} />

          <SwitchRow
            label="Texto maior"
            value={configuracoes.textoMaior}
            onValue={setTextoMaior}
            styles={styles}
          />

          <SwitchRow
            label="Interface compacta"
            value={configuracoes.interfaceCompacta}
            onValue={setInterfaceCompacta}
            styles={styles}
          />
        </View>

        <Text style={styles.sectionTitle}>Sensor</Text>

        <View style={styles.card}>
          {[
            ["Manual", "manual"],
            ["Simulado", "simulado"],
            ["ESP32", "esp32"],
          ].map(([label, value]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.sensorOption,

                configuracoes.modoSensor === value && styles.sensorActive,
              ]}
              onPress={() => setModoSensor(value as any)}
            >
              <Text
                style={[
                  styles.sensorText,

                  configuracoes.modoSensor === value && styles.sensorTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.label, { marginTop: 18 }]}>
            ENDEREÇO DO ESP32
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              onEndEditing={() => setEsp32Url(url.trim())}
              style={styles.input}
              placeholder="http://192.168.1.100"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={styles.diagnosticButton}
            onPress={() => router.push("/diagnostico")}
          >
            <Ionicons name="pulse-outline" size={20} color={colors.primary} />

            <Text style={styles.diagnosticText}>
              Diagnóstico do dispositivo
            </Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Calibração</Text>

        <View style={styles.card}>
          <Text style={styles.help}>
            Estes valores definem a conversão operacional entre velocidade
            ultrassônica e densidade estimada.
          </Text>

          <CalibrationInput
            label="VELOCIDADE MÍNIMA"
            value={configuracoes.calibracao.velocidadeMin}
            unit="m/s"
            onChange={(valor: string) =>
              setCalibracao({
                velocidadeMin: numero(valor),
              })
            }
            styles={styles}
          />

          <CalibrationInput
            label="VELOCIDADE MÁXIMA"
            value={configuracoes.calibracao.velocidadeMax}
            unit="m/s"
            onChange={(valor: string) =>
              setCalibracao({
                velocidadeMax: numero(valor),
              })
            }
            styles={styles}
          />

          <CalibrationInput
            label="DENSIDADE MÍNIMA"
            value={configuracoes.calibracao.densidadeMin}
            unit="kg/m³"
            onChange={(valor: string) =>
              setCalibracao({
                densidadeMin: numero(valor),
              })
            }
            styles={styles}
          />

          <CalibrationInput
            label="DENSIDADE MÁXIMA"
            value={configuracoes.calibracao.densidadeMax}
            unit="kg/m³"
            onChange={(valor: string) =>
              setCalibracao({
                densidadeMax: numero(valor),
              })
            }
            styles={styles}
          />

          <TouchableOpacity
            style={styles.resetCalibration}
            onPress={resetCalibracao}
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />

            <Text style={styles.resetCalibrationText}>
              Restaurar calibração padrão
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Sobre</Text>

        <View style={styles.card}>
          <Text style={styles.aboutTitle}>WoodScan</Text>

          <Text style={styles.aboutText}>
            Sistema de estimativa ultrassônica para análise operacional da
            madeira.
          </Text>

          <View style={styles.divider} />

          <Text style={styles.aboutText}>Projeto John Deere • FIAP</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Option({ label, active, onPress, styles }: any) {
  return (
    <TouchableOpacity
      style={[styles.option, active && styles.optionActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, active && styles.optionTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SwitchRow({ label, value, onValue, styles }: any) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{label}</Text>

      <Switch value={value} onValueChange={onValue} />
    </View>
  );
}

function CalibrationInput({ label, value, unit, onChange, styles }: any) {
  const [local, setLocal] = useState(String(value));

  return (
    <View style={styles.calibrationRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>

        <View style={styles.calibrationInput}>
          <TextInput
            value={local}
            onChangeText={setLocal}
            onEndEditing={() => onChange(local)}
            keyboardType="decimal-pad"
            style={styles.calibrationText}
          />

          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

function criarStyles(colors: any, fontScale: number) {
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

    sectionTitle: {
      color: colors.text,
      fontSize: 18 * fontScale,
      fontWeight: "800",
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 11,
    },

    card: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 18,
    },

    label: {
      color: colors.textMuted,
      fontSize: 9 * fontScale,
      fontWeight: "800",
      marginBottom: 8,
    },

    segment: {
      flexDirection: "row",
      gap: 8,
    },

    option: {
      flex: 1,
      padding: 12,
      alignItems: "center",
      backgroundColor: colors.cardSecondary,
      borderRadius: 13,
    },

    optionActive: {
      backgroundColor: colors.primary,
    },

    optionText: {
      color: colors.textMuted,
      fontWeight: "700",
    },

    optionTextActive: {
      color: "#FFFFFF",
    },

    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 16,
    },

    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 7,
    },

    switchText: {
      color: colors.text,
      fontSize: 12 * fontScale,
      fontWeight: "700",
    },

    sensorOption: {
      padding: 13,
      borderRadius: 14,
      backgroundColor: colors.cardSecondary,
      marginBottom: 8,
    },

    sensorActive: {
      backgroundColor: colors.headerSecondary,
    },

    sensorText: {
      color: colors.text,
      fontWeight: "700",
    },

    sensorTextActive: {
      color: "#FFFFFF",
    },

    inputContainer: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      paddingHorizontal: 12,
    },

    input: {
      color: colors.text,
      paddingVertical: 12,
      outlineStyle: "none",
    } as any,

    diagnosticButton: {
      marginTop: 14,
      backgroundColor: colors.cardSecondary,
      borderRadius: 14,
      padding: 13,
      flexDirection: "row",
      alignItems: "center",
    },

    diagnosticText: {
      color: colors.text,
      flex: 1,
      marginLeft: 9,
      fontWeight: "700",
    },

    help: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
      lineHeight: 16 * fontScale,
      marginBottom: 16,
    },

    calibrationRow: {
      marginBottom: 14,
    },

    calibrationInput: {
      backgroundColor: colors.input,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
    },

    calibrationText: {
      flex: 1,
      color: colors.text,
      paddingVertical: 12,
      outlineStyle: "none",
    } as any,

    unit: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
    },

    resetCalibration: {
      marginTop: 4,
      padding: 13,
      borderRadius: 13,
      backgroundColor: colors.cardSecondary,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },

    resetCalibrationText: {
      color: colors.primary,
      fontWeight: "700",
      marginLeft: 7,
      fontSize: 10 * fontScale,
    },

    aboutTitle: {
      color: colors.text,
      fontSize: 17 * fontScale,
      fontWeight: "800",
    },

    aboutText: {
      color: colors.textMuted,
      fontSize: 10 * fontScale,
      marginTop: 5,
    },
  });
}
