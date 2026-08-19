import { useCallback, useState } from "react";

import {
  Alert,
  Platform,
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

type SessaoAtiva = {
  talhao: string;

  proximaArvore: string;

  iniciadaEm: string;
};

/*
==================================================
CONVERTE DADOS ANTIGOS PARA HECTARE NA INTERFACE
==================================================
*/

function formatarHectare(valor: string) {
  const texto = String(valor ?? "").trim();

  if (!texto) {
    return "Hectare";
  }

  if (texto.toLowerCase().startsWith("hectare")) {
    return texto;
  }

  const numero = texto.match(/\d+/)?.[0];

  if (numero) {
    return `Hectare ${numero}`;
  }

  return texto;
}

export default function HomeScreen() {
  const [leituras, setLeituras] = useState<Leitura[]>([]);

  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, []),
  );

  /*
  ==================================================
  CARREGAR
  ==================================================
  */

  async function carregarDados() {
    try {
      const [leiturasSalvas, sessaoSalva] = await Promise.all([
        AsyncStorage.getItem("leituras"),

        AsyncStorage.getItem("sessao_ativa"),
      ]);

      setLeituras(leiturasSalvas ? JSON.parse(leiturasSalvas) : []);

      setSessaoAtiva(sessaoSalva ? JSON.parse(sessaoSalva) : null);
    } catch (erro) {
      console.log("Erro ao carregar Home:", erro);
    }
  }

  /*
  ==================================================
  RESET
  ==================================================
  */

  async function limparAsyncStorage() {
    try {
      await AsyncStorage.clear();

      setLeituras([]);

      setSessaoAtiva(null);

      if (Platform.OS === "web") {
        window.alert("Todos os dados salvos no aplicativo foram apagados.");
      } else {
        Alert.alert(
          "Memória limpa",

          "Todos os dados salvos no aplicativo foram apagados.",
        );
      }
    } catch (erro) {
      console.log("Erro ao limpar AsyncStorage:", erro);

      if (Platform.OS === "web") {
        window.alert("Não foi possível apagar os dados.");
      } else {
        Alert.alert(
          "Erro",

          "Não foi possível apagar os dados.",
        );
      }
    }
  }

  function confirmarReset() {
    const mensagem =
      "Isso apagará todas as leituras, hectares, sessões e rascunhos armazenados neste dispositivo.";

    if (Platform.OS === "web") {
      const confirmou = window.confirm(
        "Resetar dados do aplicativo?\n\n" + mensagem,
      );

      if (confirmou) {
        limparAsyncStorage();
      }

      return;
    }

    Alert.alert(
      "Resetar dados do aplicativo?",

      mensagem,

      [
        {
          text: "Cancelar",

          style: "cancel",
        },

        {
          text: "Apagar tudo",

          style: "destructive",

          onPress: limparAsyncStorage,
        },
      ],
    );
  }

  /*
  ==================================================
  MÉTRICAS
  ==================================================
  */

  const densidadeMedia =
    leituras.length > 0
      ? leituras.reduce(
          (total, leitura) => total + leitura.densidadeEstimada,

          0,
        ) / leituras.length
      : 0;

  /*
    Mantemos o nome interno quantidadeTalhoes
    por compatibilidade.

    A interface mostra Hectares.
  */

  const quantidadeTalhoes = new Set(
    leituras.map((item) => formatarHectare(item.talhao).trim().toLowerCase()),
  ).size;

  /*
  ==================================================
  CONTINUAR SESSÃO
  ==================================================
  */

  function continuarSessao() {
    if (!sessaoAtiva) {
      return;
    }

    router.push({
      pathname: "/leitura",

      params: {
        talhao: sessaoAtiva.talhao,

        arvore: sessaoAtiva.proximaArvore,
      },
    });
  }

  /*
  ==================================================
  INTERFACE
  ==================================================
  */

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#173F27" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/*
        ============================================
        HEADER
        ============================================
        */}

        <View style={styles.header}>
          <View>
            <Text style={styles.smallTitle}>MONITORAMENTO FLORESTAL</Text>

            <Text style={styles.title}>WoodScan</Text>

            <Text style={styles.subtitle}>
              Estimativa inteligente da densidade da madeira
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoBox}
            activeOpacity={0.8}
            onPress={confirmarReset}
          >
            <Ionicons name="leaf" size={32} color="#FFDE00" />
          </TouchableOpacity>
        </View>

        {/*
        ============================================
        DISPOSITIVO
        ============================================
        */}

        <View style={styles.deviceCard}>
          <View style={styles.deviceTop}>
            <View style={styles.deviceIcon}>
              <Ionicons
                name="hardware-chip-outline"
                size={26}
                color="#FFDE00"
              />
            </View>

            <View style={styles.deviceInfo}>
              <Text style={styles.cardLabel}>DISPOSITIVO</Text>

              <Text style={styles.deviceName}>Grampo Ultrassônico</Text>
            </View>

            <View style={styles.status}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>Pronto</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.deviceStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Sensor</Text>

              <Text style={styles.statValue}>Ultrassom</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Método</Text>

              <Text style={styles.statValue}>Não invasivo</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Estado</Text>

              <Text style={styles.statValue}>Aguardando</Text>
            </View>
          </View>
        </View>

        {/*
        ============================================
        SESSÃO ATIVA
        ============================================
        */}

        {sessaoAtiva && (
          <>
            <Text style={styles.sectionTitle}>Coleta em andamento</Text>

            <View style={styles.sessionCard}>
              <View style={styles.sessionIcon}>
                <Ionicons name="play" size={22} color="#FFDE00" />
              </View>

              <View style={styles.sessionInfo}>
                <Text style={styles.sessionLabel}>SESSÃO SALVA</Text>

                <Text style={styles.sessionTitle}>
                  {formatarHectare(sessaoAtiva.talhao)}
                </Text>

                <Text style={styles.sessionSubtitle}>
                  Próxima árvore: {sessaoAtiva.proximaArvore}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.resumeButton}
              onPress={continuarSessao}
              activeOpacity={0.85}
            >
              <View>
                <Text style={styles.resumeButtonTitle}>Continuar coleta</Text>

                <Text style={styles.resumeButtonSubtitle}>
                  Abrir {sessaoAtiva.proximaArvore}
                </Text>
              </View>

              <Ionicons name="arrow-forward" size={25} color="#173F27" />
            </TouchableOpacity>
          </>
        )}

        {/*
        ============================================
        NOVA COLETA
        ============================================
        */}

        <Text style={styles.sectionTitle}>Nova análise</Text>

        <TouchableOpacity
          style={styles.mainAction}
          activeOpacity={0.85}
          onPress={() => router.push("/medicao")}
        >
          <View style={styles.mainActionIcon}>
            <Ionicons name="scan-outline" size={34} color="#173F27" />
          </View>

          <View style={styles.mainActionText}>
            <Text style={styles.mainActionTitle}>Iniciar nova coleta</Text>

            <Text style={styles.mainActionSubtitle}>
              Criar uma nova análise de hectare
            </Text>
          </View>

          <Ionicons name="arrow-forward" size={27} color="#173F27" />
        </TouchableOpacity>

        {/*
        ============================================
        VISÃO GERAL
        ============================================
        */}

        <Text style={styles.sectionTitle}>Visão geral</Text>

        <View style={styles.cardsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricIcon}>
              <Ionicons name="analytics-outline" size={24} color="#367C2B" />
            </View>

            <Text style={styles.metricValue}>
              {leituras.length ? `≈ ${densidadeMedia.toFixed(0)}` : "--"}
            </Text>

            <Text style={styles.metricUnit}>kg/m³</Text>

            <Text style={styles.metricTitle}>Densidade média</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricIcon}>
              <Ionicons name="leaf-outline" size={24} color="#367C2B" />
            </View>

            <Text style={styles.metricValue}>{leituras.length}</Text>

            <Text style={styles.metricUnit}>árvores</Text>

            <Text style={styles.metricTitle}>Amostras coletadas</Text>
          </View>
        </View>

        {/*
        ============================================
        HECTARES
        ============================================
        */}

        <View style={styles.hectareCard}>
          <View style={styles.hectareHeader}>
            <View>
              <Text style={styles.cardLabelDark}>ÁREAS MONITORADAS</Text>

              <Text style={styles.hectareTitle}>
                {quantidadeTalhoes}{" "}
                {quantidadeTalhoes === 1 ? "hectare" : "hectares"}
              </Text>
            </View>

            <Ionicons name="map-outline" size={29} color="#367C2B" />
          </View>

          <Text style={styles.hectareDescription}>
            As amostras são agrupadas por hectare para estimar a densidade média
            e o potencial de utilização da madeira.
          </Text>
        </View>

        {/*
        ============================================
        ACESSO RÁPIDO
        ============================================
        */}

        <Text style={styles.sectionTitle}>Acesso rápido</Text>

        <View style={styles.menuGrid}>
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/historico")}
          >
            <Ionicons name="time-outline" size={27} color="#367C2B" />

            <Text style={styles.menuText}>Histórico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/talhoes")}
          >
            <Ionicons name="map-outline" size={27} color="#367C2B" />

            <Text style={styles.menuText}>Hectares</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/relatorios")}
          >
            <Ionicons name="bar-chart-outline" size={27} color="#367C2B" />

            <Text style={styles.menuText}>Relatórios</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.8}
            onPress={() => router.push("/configuracoes")}
          >
            <Ionicons name="settings-outline" size={27} color="#367C2B" />

            <Text style={styles.menuText}>Configurações</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          WoodScan • Sistema de análise florestal
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: "#F3F5F1",
  },

  scrollContent: {
    paddingBottom: 40,
  },

  header: {
    backgroundColor: "#173F27",

    paddingTop: 58,

    paddingHorizontal: 24,

    paddingBottom: 32,

    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",

    borderBottomLeftRadius: 30,

    borderBottomRightRadius: 30,
  },

  smallTitle: {
    color: "#FFDE00",

    fontSize: 11,

    fontWeight: "800",

    letterSpacing: 1.8,

    marginBottom: 6,
  },

  title: {
    color: "#FFFFFF",

    fontSize: 34,

    fontWeight: "800",
  },

  subtitle: {
    color: "#D8E3D9",

    fontSize: 13,

    marginTop: 4,

    maxWidth: 270,
  },

  logoBox: {
    width: 60,

    height: 60,

    borderRadius: 18,

    backgroundColor: "#367C2B",

    justifyContent: "center",

    alignItems: "center",
  },

  deviceCard: {
    backgroundColor: "#225431",

    marginHorizontal: 20,

    marginTop: -14,

    borderRadius: 22,

    padding: 18,
  },

  deviceTop: {
    flexDirection: "row",

    alignItems: "center",
  },

  deviceIcon: {
    width: 48,

    height: 48,

    borderRadius: 15,

    backgroundColor: "#173F27",

    alignItems: "center",

    justifyContent: "center",
  },

  deviceInfo: {
    flex: 1,

    marginLeft: 13,
  },

  cardLabel: {
    color: "#A9C0AD",

    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 1.3,
  },

  deviceName: {
    color: "#FFFFFF",

    fontSize: 16,

    fontWeight: "700",

    marginTop: 3,
  },

  status: {
    flexDirection: "row",

    alignItems: "center",

    backgroundColor: "#173F27",

    paddingHorizontal: 10,

    paddingVertical: 7,

    borderRadius: 14,
  },

  statusDot: {
    width: 7,

    height: 7,

    borderRadius: 4,

    backgroundColor: "#FFDE00",

    marginRight: 6,
  },

  statusText: {
    color: "#FFFFFF",

    fontSize: 11,

    fontWeight: "700",
  },

  divider: {
    height: 1,

    backgroundColor: "#3A6845",

    marginVertical: 16,
  },

  deviceStats: {
    flexDirection: "row",
  },

  statItem: {
    flex: 1,
  },

  statLabel: {
    color: "#A7BDAA",

    fontSize: 10,
  },

  statValue: {
    color: "#FFFFFF",

    fontSize: 12,

    fontWeight: "700",

    marginTop: 3,
  },

  sectionTitle: {
    fontSize: 19,

    fontWeight: "800",

    color: "#173F27",

    marginHorizontal: 20,

    marginTop: 28,

    marginBottom: 12,
  },

  sessionCard: {
    marginHorizontal: 20,

    backgroundColor: "#225431",

    borderRadius: 20,

    padding: 17,

    flexDirection: "row",

    alignItems: "center",
  },

  sessionIcon: {
    width: 48,

    height: 48,

    borderRadius: 15,

    backgroundColor: "#173F27",

    justifyContent: "center",

    alignItems: "center",
  },

  sessionInfo: {
    marginLeft: 13,

    flex: 1,
  },

  sessionLabel: {
    color: "#FFDE00",

    fontSize: 9,

    fontWeight: "800",

    letterSpacing: 1,
  },

  sessionTitle: {
    color: "#FFFFFF",

    fontSize: 17,

    fontWeight: "800",
  },

  sessionSubtitle: {
    color: "#C2D0C4",

    fontSize: 11,

    marginTop: 3,
  },

  resumeButton: {
    marginHorizontal: 20,

    marginTop: 10,

    padding: 17,

    borderRadius: 18,

    backgroundColor: "#FFDE00",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  resumeButtonTitle: {
    color: "#173F27",

    fontSize: 16,

    fontWeight: "800",
  },

  resumeButtonSubtitle: {
    color: "#52654F",

    fontSize: 10,

    marginTop: 3,
  },

  mainAction: {
    backgroundColor: "#FFDE00",

    marginHorizontal: 20,

    borderRadius: 22,

    padding: 18,

    flexDirection: "row",

    alignItems: "center",
  },

  mainActionIcon: {
    width: 58,

    height: 58,

    borderRadius: 18,

    backgroundColor: "rgba(255,255,255,0.45)",

    alignItems: "center",

    justifyContent: "center",
  },

  mainActionText: {
    flex: 1,

    marginLeft: 14,
  },

  mainActionTitle: {
    color: "#173F27",

    fontSize: 18,

    fontWeight: "800",
  },

  mainActionSubtitle: {
    color: "#456044",

    fontSize: 12,

    marginTop: 3,
  },

  cardsRow: {
    flexDirection: "row",

    marginHorizontal: 14,
  },

  metricCard: {
    flex: 1,

    backgroundColor: "#FFFFFF",

    marginHorizontal: 6,

    padding: 17,

    borderRadius: 20,
  },

  metricIcon: {
    width: 42,

    height: 42,

    borderRadius: 13,

    backgroundColor: "#EEF5EC",

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 15,
  },

  metricValue: {
    fontSize: 27,

    fontWeight: "800",

    color: "#173F27",
  },

  metricUnit: {
    color: "#728074",

    fontSize: 11,
  },

  metricTitle: {
    color: "#3D4E40",

    fontSize: 12,

    fontWeight: "600",

    marginTop: 8,
  },

  hectareCard: {
    marginHorizontal: 20,

    marginTop: 18,

    backgroundColor: "#FFFFFF",

    borderRadius: 22,

    padding: 19,
  },

  hectareHeader: {
    flexDirection: "row",

    justifyContent: "space-between",

    alignItems: "center",
  },

  cardLabelDark: {
    color: "#7C8A7E",

    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 1.2,
  },

  hectareTitle: {
    color: "#173F27",

    fontSize: 17,

    fontWeight: "800",

    marginTop: 3,
  },

  hectareDescription: {
    color: "#667269",

    fontSize: 12,

    lineHeight: 18,

    marginTop: 15,
  },

  menuGrid: {
    flexDirection: "row",

    flexWrap: "wrap",

    marginHorizontal: 14,
  },

  menuItem: {
    width: "46%",

    backgroundColor: "#FFFFFF",

    margin: "2%",

    borderRadius: 18,

    paddingVertical: 20,

    paddingHorizontal: 17,
  },

  menuText: {
    marginTop: 9,

    color: "#173F27",

    fontSize: 13,

    fontWeight: "700",
  },

  footer: {
    color: "#9AA39B",

    textAlign: "center",

    marginTop: 35,

    fontSize: 10,
  },
});
