import { useCallback, useMemo, useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Modal,
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

import ExcelJS from "exceljs";

import * as Sharing from "expo-sharing";

import * as FileSystem from "expo-file-system/legacy";

import { encode } from "base64-arraybuffer";

import { useAppSettings } from "../context/AppSettingsContext";

import {
    avaliarAmostragem,
    calcularAptidao,
    calcularEstatisticas,
    classificarDensidade,
} from "../utils/woodscan";

/*
==================================================
TIPOS
==================================================
*/

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

type GrupoArea = {
  nome: string;

  leituras: Leitura[];
};

/*
==================================================
PRECISÃO
==================================================
*/

function calcularPrecisao(quantidade: number, cv: number) {
  if (quantidade < 3) {
    return {
      nome: "Baixa",

      descricao: "Poucas amostras para uma estimativa consistente.",
    };
  }

  if (quantidade >= 10 && cv <= 10) {
    return {
      nome: "Alta",

      descricao: "Boa consistência entre as amostras coletadas.",
    };
  }

  if (quantidade >= 5 && cv <= 20) {
    return {
      nome: "Média",

      descricao: "Variação moderada entre as amostras.",
    };
  }

  return {
    nome: "Baixa",

    descricao: "Há alta variação ou poucas amostras.",
  };
}

/*
==================================================
COMPATIBILIDADE TALHÃO -> HECTARE
==================================================
*/

function nomeHectare(valor: string) {
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

/*
==================================================
DATA DA LEITURA
==================================================
*/

function formatarData(data: string) {
  try {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return data;
  }
}

/*
==================================================
NOME DO ARQUIVO
==================================================
*/

function gerarNomeArquivo(
  hectare: string,

  extensao: "pdf" | "xlsx",
) {
  const agora = new Date();

  const dia = String(agora.getDate()).padStart(2, "0");

  const mes = String(agora.getMonth() + 1).padStart(2, "0");

  const ano = agora.getFullYear();

  const hora = String(agora.getHours()).padStart(2, "0");

  const minuto = String(agora.getMinutes()).padStart(2, "0");

  const hectareSeguro = hectare
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    `WoodScan_${hectareSeguro}` +
    `_${dia}-${mes}-${ano}` +
    `_${hora}-${minuto}` +
    `.${extensao}`
  );
}

/*
==================================================
REMOVE EXTENSÃO
==================================================
*/

function removerExtensao(nomeArquivo: string) {
  return nomeArquivo.replace(/\.[^/.]+$/, "");
}

/*
==================================================
BASE64
==================================================
*/

function bytesParaBase64(bytes: Uint8Array) {
  const copia = Uint8Array.from(bytes);

  return encode(copia.buffer as ArrayBuffer);
}

/*
==================================================
SALVAR NO CELULAR
==================================================
*/

async function salvarArquivoMobile({
  nomeArquivo,
  base64,
  mimeType,
}: {
  nomeArquivo: string;

  base64: string;

  mimeType: string;
}) {
  /*
  ================================================
  ANDROID
  ================================================
  */

  if (Platform.OS === "android") {
    try {
      const SAF = FileSystem.StorageAccessFramework;

      const permissao = await SAF.requestDirectoryPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert("Salvamento cancelado", "Nenhuma pasta foi selecionada.");

        return false;
      }

      const nomeSemExtensao = removerExtensao(nomeArquivo);

      const arquivoUri = await SAF.createFileAsync(
        permissao.directoryUri,
        nomeSemExtensao,
        mimeType,
      );

      await FileSystem.writeAsStringAsync(arquivoUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      Alert.alert(
        "Arquivo salvo",
        "O relatório foi salvo na pasta selecionada.",
      );

      return true;
    } catch (erro) {
      console.log("Erro ao salvar no Android:", erro);

      Alert.alert("Não foi possível salvar", "Tente selecionar outra pasta.");

      return false;
    }
  }

  /*
  ================================================
  IOS
  ================================================
  */

  if (Platform.OS === "ios") {
    try {
      const caminho = `${FileSystem.cacheDirectory}${nomeArquivo}`;

      await FileSystem.writeAsStringAsync(caminho, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const disponivel = await Sharing.isAvailableAsync();

      if (!disponivel) {
        Alert.alert(
          "Compartilhamento indisponível",
          "Não foi possível abrir o menu para salvar o arquivo.",
        );

        return false;
      }

      await Sharing.shareAsync(caminho, {
        mimeType,

        dialogTitle: "Salvar relatório WoodScan",
      });

      return true;
    } catch (erro) {
      console.log("Erro ao salvar no iPhone:", erro);

      Alert.alert("Erro", "Não foi possível preparar o arquivo.");

      return false;
    }
  }

  return false;
}

/*
==================================================
TELA
==================================================
*/

export default function RelatoriosScreen() {
  const [areas, setAreas] = useState<GrupoArea[]>([]);

  const [selecionado, setSelecionado] = useState("");

  const [infoCV, setInfoCV] = useState(false);

  const [infoPrecisao, setInfoPrecisao] = useState(false);

  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);

  const { configuracoes, colors, fontScale } = useAppSettings();

  const styles = criarStyles(
    colors,
    fontScale,
    configuracoes.interfaceCompacta,
  );

  /*
  ================================================
  CARREGAR LEITURAS
  ================================================
  */

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, []),
  );

  async function carregar() {
    try {
      const salvo = await AsyncStorage.getItem("leituras");

      const lista: Leitura[] = salvo ? JSON.parse(salvo) : [];

      const mapa: Record<string, Leitura[]> = {};

      lista.forEach((item) => {
        const hectare = nomeHectare(item.talhao);

        if (!mapa[hectare]) {
          mapa[hectare] = [];
        }

        mapa[hectare].push({
          ...item,

          talhao: hectare,
        });
      });

      const grupos = Object.entries(mapa).map(([nome, leituras]) => ({
        nome,

        leituras,
      }));

      grupos.sort((a, b) =>
        a.nome.localeCompare(
          b.nome,

          "pt-BR",

          {
            numeric: true,
          },
        ),
      );

      setAreas(grupos);

      if (grupos.length) {
        const existe = grupos.some((grupo) => grupo.nome === selecionado);

        if (!existe) {
          setSelecionado(grupos[0].nome);
        }
      } else {
        setSelecionado("");
      }
    } catch (erro) {
      console.log("Erro ao carregar relatórios:", erro);
    }
  }

  /*
  ================================================
  HECTARE ATUAL
  ================================================
  */

  const atual = areas.find((item) => item.nome === selecionado);

  /*
  ================================================
  ESTATÍSTICAS
  ================================================
  */

  const estatisticas = useMemo(
    () =>
      calcularEstatisticas(
        atual?.leituras.map((item) => item.densidadeEstimada) ?? [],
      ),

    [atual],
  );

  const amostragem = avaliarAmostragem(
    estatisticas.quantidade,

    estatisticas.coeficienteVariacao,
  );

  const precisao = calcularPrecisao(
    estatisticas.quantidade,

    estatisticas.coeficienteVariacao,
  );

  const aptidao = estatisticas.quantidade
    ? calcularAptidao(estatisticas.media)
    : [];

  const aptidaoOrdenada = useMemo(
    () => [...aptidao].sort((a, b) => b.valor - a.valor),

    [aptidao],
  );

  const melhorUso = aptidaoOrdenada[0] ?? null;

  /*
  ================================================
  PDF
  ================================================
  */

  async function exportarPDF() {
    if (!atual) {
      return;
    }

    try {
      setExportando("pdf");

      const { gerarRelatorioPDF } = await import("../utils/pdfReport");

      const resultado = await gerarRelatorioPDF({
        hectare: atual.nome,

        leituras: atual.leituras,

        densidadeMedia: estatisticas.media,

        densidadeMinima: estatisticas.minima,

        densidadeMaxima: estatisticas.maxima,

        coeficienteVariacao: estatisticas.coeficienteVariacao,

        precisao: precisao.nome,

        amostragem: amostragem.nome,

        classificacao: classificarDensidade(estatisticas.media),

        aptidao: aptidaoOrdenada,
      });

      const bytes = Uint8Array.from(resultado);

      const nomeArquivo = gerarNomeArquivo(
        atual.nome,

        "pdf",
      );

      /*
      ----------------------------------------------
      WEB
      ----------------------------------------------
      */

      if (Platform.OS === "web") {
        const copia = Uint8Array.from(bytes);

        const buffer = copia.buffer as ArrayBuffer;

        const blob = new Blob(
          [buffer],

          {
            type: "application/pdf",
          },
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download = nomeArquivo;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(
          () => {
            URL.revokeObjectURL(url);
          },

          1000,
        );

        return;
      }

      /*
      ----------------------------------------------
      MOBILE
      ----------------------------------------------
      */

      const base64 = bytesParaBase64(bytes);

      await salvarArquivoMobile({
        nomeArquivo,

        base64,

        mimeType: "application/pdf",
      });
    } catch (erro) {
      console.log("Erro ao gerar PDF:", erro);

      Alert.alert("Erro", "Não foi possível gerar o PDF.");
    } finally {
      setExportando(null);
    }
  }

  /*
  ================================================
  EXCEL
  ================================================
  */

  async function exportarExcel() {
    if (!atual) {
      return;
    }

    try {
      setExportando("excel");

      const workbook = new ExcelJS.Workbook();

      workbook.creator = "WoodScan";

      workbook.company = "WoodScan";

      workbook.title = `WoodScan - ${atual.nome}`;

      workbook.subject = `Relatório florestal - ${atual.nome}`;

      workbook.created = new Date();

      /*
      ==============================================
      CORES
      ==============================================
      */

      const VERDE_ESCURO = "FF173F27";

      const VERDE = "FF367C2B";

      const VERDE_CLARO = "FFE7F0E4";

      const VERDE_MUITO_CLARO = "FFF4F8F2";

      const AMARELO = "FFFFDE00";

      const BRANCO = "FFFFFFFF";

      const BORDA = "FFD1DFCD";

      const TEXTO = "FF173F27";

      /*
      ==============================================
      ABA RESUMO
      ==============================================
      */

      const resumo = workbook.addWorksheet(
        "Resumo",

        {
          views: [
            {
              showGridLines: false,
            },
          ],
        },
      );

      resumo.columns = [
        {
          width: 34,
        },

        {
          width: 40,
        },

        {
          width: 18,
        },
      ];

      resumo.mergeCells("A1:C2");

      const titulo = resumo.getCell("A1");

      titulo.value = "WOODSCAN";

      titulo.font = {
        bold: true,

        size: 25,

        color: {
          argb: BRANCO,
        },
      };

      titulo.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: VERDE_ESCURO,
        },
      };

      titulo.alignment = {
        vertical: "middle",
      };

      titulo.border = {
        bottom: {
          style: "thick",

          color: {
            argb: AMARELO,
          },
        },
      };

      resumo.getRow(1).height = 30;

      resumo.getRow(2).height = 16;

      resumo.mergeCells("A3:C3");

      const subtitulo = resumo.getCell("A3");

      subtitulo.value = `RELATÓRIO DE ANÁLISE FLORESTAL • ${atual.nome}`;

      subtitulo.font = {
        bold: true,

        size: 12,

        color: {
          argb: VERDE_ESCURO,
        },
      };

      subtitulo.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: AMARELO,
        },
      };

      subtitulo.alignment = {
        vertical: "middle",
      };

      resumo.getRow(3).height = 25;

      resumo.addRow([]);

      const header = resumo.addRow(["Indicador", "Resultado", "Unidade"]);

      header.height = 27;

      header.eachCell((cell) => {
        cell.fill = {
          type: "pattern",

          pattern: "solid",

          fgColor: {
            argb: VERDE,
          },
        };

        cell.font = {
          bold: true,

          color: {
            argb: BRANCO,
          },
        };

        cell.alignment = {
          vertical: "middle",
        };
      });

      const dadosResumo: (string | number)[][] = [
        ["Hectare", atual.nome, ""],

        ["Número de amostras", estatisticas.quantidade, "árvores"],

        ["Densidade média", Number(estatisticas.media.toFixed(1)), "kg/m³"],

        ["Densidade mínima", Number(estatisticas.minima.toFixed(1)), "kg/m³"],

        ["Densidade máxima", Number(estatisticas.maxima.toFixed(1)), "kg/m³"],

        [
          "Coeficiente de Variação",

          Number(estatisticas.coeficienteVariacao.toFixed(1)),

          "%",
        ],

        ["Precisão", precisao.nome, ""],

        ["Amostragem", amostragem.nome, ""],

        ["Classificação", classificarDensidade(estatisticas.media), ""],

        ["Uso principal", melhorUso?.nome ?? "--", ""],

        ["Índice do uso principal", melhorUso?.valor ?? 0, "%"],
      ];

      dadosResumo.forEach((linha, index) => {
        const row = resumo.addRow(linha);

        row.height = 24;

        const fundo = index % 2 === 0 ? VERDE_MUITO_CLARO : VERDE_CLARO;

        row.eachCell(
          {
            includeEmpty: true,
          },

          (cell) => {
            cell.fill = {
              type: "pattern",

              pattern: "solid",

              fgColor: {
                argb: fundo,
              },
            };

            cell.font = {
              color: {
                argb: TEXTO,
              },
            };

            cell.alignment = {
              vertical: "middle",

              wrapText: true,
            };

            cell.border = {
              bottom: {
                style: "thin",

                color: {
                  argb: BORDA,
                },
              },
            };
          },
        );

        row.getCell(1).font = {
          bold: true,

          color: {
            argb: VERDE_ESCURO,
          },
        };
      });

      /*
      ==============================================
      OBSERVAÇÃO
      ==============================================
      */

      resumo.addRow([]);

      const obsRow = resumo.rowCount + 1;

      resumo.mergeCells(`A${obsRow}:C${obsRow}`);

      const obs = resumo.getCell(`A${obsRow}`);

      obs.value =
        "Observação: os resultados apresentados são estimativas operacionais do WoodScan e devem ser calibrados com dados reais antes de aplicações técnicas definitivas.";

      obs.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: "FFFFF6C7",
        },
      };

      obs.font = {
        italic: true,

        color: {
          argb: VERDE_ESCURO,
        },
      };

      obs.alignment = {
        vertical: "middle",

        wrapText: true,
      };

      obs.border = {
        left: {
          style: "thick",

          color: {
            argb: AMARELO,
          },
        },
      };

      resumo.getRow(obsRow).height = 42;

      /*
      ==============================================
      ABA LEITURAS
      ==============================================
      */

      const leiturasSheet = workbook.addWorksheet(
        "Leituras",

        {
          views: [
            {
              showGridLines: false,

              state: "frozen",

              ySplit: 4,
            },
          ],
        },
      );

      leiturasSheet.columns = [
        {
          width: 17,
        },

        {
          width: 12,
        },

        {
          width: 18,
        },

        {
          width: 23,
        },

        {
          width: 22,
        },

        {
          width: 28,
        },

        {
          width: 16,
        },

        {
          width: 23,
        },
      ];

      leiturasSheet.mergeCells("A1:H2");

      const tituloLeituras = leiturasSheet.getCell("A1");

      tituloLeituras.value = `WOODSCAN • ${atual.nome}`;

      tituloLeituras.font = {
        bold: true,

        size: 23,

        color: {
          argb: BRANCO,
        },
      };

      tituloLeituras.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: VERDE_ESCURO,
        },
      };

      tituloLeituras.alignment = {
        vertical: "middle",
      };

      tituloLeituras.border = {
        bottom: {
          style: "thick",

          color: {
            argb: AMARELO,
          },
        },
      };

      leiturasSheet.addRow([]);

      const headerLeituras = leiturasSheet.addRow([
        "Hectare",

        "Árvore",

        "Diâmetro (cm)",

        "Tempo (µs)",

        "Velocidade (m/s)",

        "Densidade (kg/m³)",

        "Origem",

        "Data",
      ]);

      headerLeituras.height = 30;

      headerLeituras.eachCell((cell) => {
        cell.fill = {
          type: "pattern",

          pattern: "solid",

          fgColor: {
            argb: VERDE,
          },
        };

        cell.font = {
          bold: true,

          color: {
            argb: BRANCO,
          },
        };

        cell.alignment = {
          vertical: "middle",

          horizontal: "center",

          wrapText: true,
        };
      });

      atual.leituras.forEach((item, index) => {
        const row = leiturasSheet.addRow([
          atual.nome,

          item.arvore,

          Number(item.diametro.toFixed(1)),

          Number(item.tempoUltrassom.toFixed(1)),

          Number(item.velocidade.toFixed(0)),

          Number(item.densidadeEstimada.toFixed(0)),

          item.origem === "esp32"
            ? "ESP32"
            : item.origem === "simulado"
              ? "Simulado"
              : "Manual",

          formatarData(item.data),
        ]);

        row.height = 24;

        const fundo = index % 2 === 0 ? VERDE_MUITO_CLARO : VERDE_CLARO;

        row.eachCell(
          {
            includeEmpty: true,
          },

          (cell) => {
            cell.fill = {
              type: "pattern",

              pattern: "solid",

              fgColor: {
                argb: fundo,
              },
            };

            cell.font = {
              color: {
                argb: TEXTO,
              },
            };

            cell.alignment = {
              vertical: "middle",

              horizontal: "center",
            };

            cell.border = {
              bottom: {
                style: "thin",

                color: {
                  argb: BORDA,
                },
              },
            };
          },
        );
      });

      if (atual.leituras.length > 0) {
        leiturasSheet.autoFilter = {
          from: {
            row: 4,

            column: 1,
          },

          to: {
            row: 4,

            column: 8,
          },
        };
      }

      /*
      ==============================================
      ABA APTIDÃO
      ==============================================
      */

      const aptidaoSheet = workbook.addWorksheet(
        "Aptidão",

        {
          views: [
            {
              showGridLines: false,
            },
          ],
        },
      );

      aptidaoSheet.columns = [
        {
          width: 38,
        },

        {
          width: 22,
        },

        {
          width: 42,
        },
      ];

      aptidaoSheet.mergeCells("A1:C2");

      const aptTitulo = aptidaoSheet.getCell("A1");

      aptTitulo.value = `APTIDÃO ESTIMADA • ${atual.nome}`;

      aptTitulo.fill = {
        type: "pattern",

        pattern: "solid",

        fgColor: {
          argb: VERDE_ESCURO,
        },
      };

      aptTitulo.font = {
        bold: true,

        size: 22,

        color: {
          argb: BRANCO,
        },
      };

      aptTitulo.border = {
        bottom: {
          style: "thick",

          color: {
            argb: AMARELO,
          },
        },
      };

      aptTitulo.alignment = {
        vertical: "middle",
      };

      aptidaoSheet.addRow([]);

      const aptHeader = aptidaoSheet.addRow([
        "Produto / destinação",

        "Índice WoodScan",

        "Representação",
      ]);

      aptHeader.height = 27;

      aptHeader.eachCell((cell) => {
        cell.fill = {
          type: "pattern",

          pattern: "solid",

          fgColor: {
            argb: VERDE,
          },
        };

        cell.font = {
          bold: true,

          color: {
            argb: BRANCO,
          },
        };

        cell.alignment = {
          horizontal: "center",

          vertical: "middle",
        };
      });

      aptidaoOrdenada.forEach((item, index) => {
        const blocos = Math.max(
          0,

          Math.min(
            20,

            Math.round(item.valor / 5),
          ),
        );

        const barra = "█".repeat(blocos);

        const vazio = "░".repeat(20 - blocos);

        const row = aptidaoSheet.addRow([
          item.nome,

          item.valor / 100,

          `${barra}${vazio}`,
        ]);

        row.height = 25;

        row.getCell(2).numFmt = "0%";

        const fundo = index % 2 === 0 ? VERDE_MUITO_CLARO : VERDE_CLARO;

        row.eachCell(
          {
            includeEmpty: true,
          },

          (cell) => {
            cell.fill = {
              type: "pattern",

              pattern: "solid",

              fgColor: {
                argb: fundo,
              },
            };

            cell.font = {
              color: {
                argb: TEXTO,
              },
            };

            cell.alignment = {
              vertical: "middle",
            };

            cell.border = {
              bottom: {
                style: "thin",

                color: {
                  argb: BORDA,
                },
              },
            };
          },
        );

        row.getCell(3).font = {
          bold: true,

          color: {
            argb: VERDE,
          },
        };
      });

      /*
      ==============================================
      GERAR ARQUIVO
      ==============================================
      */

      const resultado = await workbook.xlsx.writeBuffer();

      const bytes =
        resultado instanceof ArrayBuffer
          ? new Uint8Array(resultado)
          : Uint8Array.from(resultado as Uint8Array);

      const nomeArquivo = gerarNomeArquivo(
        atual.nome,

        "xlsx",
      );

      /*
      ----------------------------------------------
      WEB
      ----------------------------------------------
      */

      if (Platform.OS === "web") {
        const copia = Uint8Array.from(bytes);

        const buffer = copia.buffer as ArrayBuffer;

        const blob = new Blob(
          [buffer],

          {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;

        link.download = nomeArquivo;

        document.body.appendChild(link);

        link.click();

        link.remove();

        setTimeout(
          () => {
            URL.revokeObjectURL(url);
          },

          1000,
        );

        return;
      }

      /*
      ----------------------------------------------
      MOBILE
      ----------------------------------------------
      */

      const base64 = bytesParaBase64(bytes);

      await salvarArquivoMobile({
        nomeArquivo,

        base64,

        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (erro) {
      console.log("Erro ao gerar Excel:", erro);

      Alert.alert("Erro", "Não foi possível gerar a planilha.");
    } finally {
      setExportando(null);
    }
  }

  /*
  ================================================
  INTERFACE
  ================================================
  */

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.header} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/*
        ============================================
        HEADER
        ============================================
        */}

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

          <Text style={styles.headerTitle}>Relatórios</Text>

          <Text style={styles.headerSubtitle}>
            Análise dos hectares coletados
          </Text>
        </View>

        {/*
        ============================================
        SEM DADOS
        ============================================
        */}

        {!areas.length ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="bar-chart-outline"
              size={35}
              color={colors.primary}
            />

            <Text style={styles.emptyTitle}>Sem dados para analisar</Text>

            <Text style={styles.emptyText}>
              Faça algumas leituras para gerar os relatórios.
            </Text>
          </View>
        ) : (
          <>
            {/*
            ========================================
            HECTARES
            ========================================
            */}

            <Text style={styles.sectionTitle}>Escolha o hectare</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selector}
            >
              {areas.map((item) => {
                const ativo = selecionado === item.nome;

                return (
                  <TouchableOpacity
                    key={item.nome}
                    style={[styles.chip, ativo && styles.chipActive]}
                    onPress={() => setSelecionado(item.nome)}
                  >
                    <Text
                      style={[styles.chipText, ativo && styles.chipTextActive]}
                    >
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/*
            ========================================
            RESUMO
            ========================================
            */}

            <Text style={styles.sectionTitle}>Resumo</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryLabel}>DENSIDADE MÉDIA</Text>

                <Ionicons name="leaf-outline" size={24} color={colors.yellow} />
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryValue}>
                  ≈ {estatisticas.media.toFixed(0)}
                </Text>

                <Text style={styles.summaryUnit}>kg/m³</Text>
              </View>

              <Text style={styles.summaryClass}>
                {classificarDensidade(estatisticas.media)}
              </Text>
            </View>

            {/*
            ========================================
            INDICADORES
            ========================================
            */}

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>AMOSTRAS</Text>

                <Text style={styles.metricValue}>
                  {estatisticas.quantidade}
                </Text>

                <Text style={styles.metricHelp}>árvores analisadas</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.labelRow}>
                  <Text style={styles.metricLabel}>PRECISÃO</Text>

                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() => setInfoPrecisao(true)}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.metricValue}>{precisao.nome}</Text>

                <Text style={styles.metricHelp}>estimativa</Text>
              </View>
            </View>

            {/*
            ========================================
            COEFICIENTE DE VARIAÇÃO
            ========================================
            */}

            <View style={styles.cvCard}>
              <View style={styles.cvLeft}>
                <View style={styles.labelRow}>
                  <Text style={styles.metricLabel}>
                    COEFICIENTE DE VARIAÇÃO
                  </Text>

                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() => setInfoCV(true)}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.cvHelp}>
                  Valores menores indicam maior uniformidade entre as amostras.
                </Text>
              </View>

              <Text style={styles.cvValue}>
                {estatisticas.coeficienteVariacao.toFixed(1)}%
              </Text>
            </View>

            {/*
            ========================================
            AMOSTRAGEM
            ========================================
            */}

            <View style={styles.samplingCard}>
              <View style={styles.samplingIcon}>
                <Ionicons
                  name="layers-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.samplingInfo}>
                <Text style={styles.samplingLabel}>AMOSTRAGEM</Text>

                <Text style={styles.samplingTitle}>{amostragem.nome}</Text>

                <Text style={styles.samplingDescription}>
                  {amostragem.descricao}
                </Text>
              </View>
            </View>

            {/*
            ========================================
            APTIDÃO
            ========================================
            */}

            <Text style={styles.sectionTitle}>Aptidão por produto</Text>

            <View style={styles.chartCard}>
              {aptidaoOrdenada.map((item) => (
                <View key={item.nome} style={styles.chartItem}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartLabel}>{item.nome}</Text>

                    <Text style={styles.chartValue}>{item.valor}%</Text>
                  </View>

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,

                        {
                          width: `${Math.max(
                            0,

                            Math.min(
                              100,

                              item.valor,
                            ),
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.chartNotice}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color={colors.primary}
                />

                <Text style={styles.chartNoticeText}>
                  Os valores representam índices comparativos de aptidão do
                  WoodScan.
                </Text>
              </View>
            </View>

            {/*
            ========================================
            VARIAÇÃO
            ========================================
            */}

            <Text style={styles.sectionTitle}>Variação observada</Text>

            <View style={styles.rangeCard}>
              <View style={styles.rangeSide}>
                <Text style={styles.rangeLabel}>MENOR</Text>

                <Text style={styles.rangeValue}>
                  {estatisticas.minima.toFixed(0)}
                </Text>

                <Text style={styles.rangeUnit}>kg/m³</Text>
              </View>

              <View style={styles.rangeCenter}>
                <Ionicons
                  name="arrow-forward"
                  size={22}
                  color={colors.primary}
                />

                <Text style={styles.rangeAmplitude}>
                  amplitude {estatisticas.amplitude.toFixed(0)}
                </Text>
              </View>

              <View style={styles.rangeSideRight}>
                <Text style={styles.rangeLabel}>MAIOR</Text>

                <Text style={styles.rangeValue}>
                  {estatisticas.maxima.toFixed(0)}
                </Text>

                <Text style={styles.rangeUnit}>kg/m³</Text>
              </View>
            </View>

            {/*
            ========================================
            EXPORTAR
            ========================================
            */}

            <Text style={styles.sectionTitle}>Exportar relatório</Text>

            <View style={styles.exportCard}>
              <Text style={styles.exportHeading}>{atual?.nome}</Text>

              <Text style={styles.exportDescription}>
                Escolha o formato desejado.
              </Text>

              {/*
              EXCEL
              */}

              <TouchableOpacity
                style={styles.excelButton}
                onPress={exportarExcel}
                disabled={exportando !== null}
                activeOpacity={0.8}
              >
                <View style={styles.exportIcon}>
                  <Ionicons
                    name="grid-outline"
                    size={23}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.exportInfo}>
                  <Text style={styles.excelTitle}>Planilha Excel</Text>

                  <Text style={styles.excelSubtitle}>
                    Salvar .xlsx no dispositivo
                  </Text>
                </View>

                {exportando === "excel" ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={21}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>

              {/*
              PDF
              */}

              <TouchableOpacity
                style={styles.pdfButton}
                onPress={exportarPDF}
                disabled={exportando !== null}
                activeOpacity={0.8}
              >
                <View style={styles.pdfIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={23}
                    color="#FFFFFF"
                  />
                </View>

                <View style={styles.exportInfo}>
                  <Text style={styles.pdfTitle}>Relatório PDF</Text>

                  <Text style={styles.pdfSubtitle}>
                    Salvar .pdf no dispositivo
                  </Text>
                </View>

                {exportando === "pdf" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="download-outline" size={21} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              {/*
              DICA MOBILE
              */}

              {Platform.OS !== "web" && (
                <View style={styles.mobileTip}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={17}
                    color={colors.primary}
                  />

                  <Text style={styles.mobileTipText}>
                    No Android você poderá escolher a pasta. No iPhone use
                    “Salvar em Arquivos”.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/*
      ==============================================
      MODAL CV
      ==============================================
      */}

      <InfoModal
        visible={infoCV}
        onClose={() => setInfoCV(false)}
        title="Coeficiente de Variação"
        text="Indica quanto as densidades estimadas variam entre as árvores. Quanto menor o percentual, mais uniformes são as amostras."
        colors={colors}
        styles={styles}
      />

      {/*
      ==============================================
      MODAL PRECISÃO
      ==============================================
      */}

      <InfoModal
        visible={infoPrecisao}
        onClose={() => setInfoPrecisao(false)}
        title="Precisão"
        text="Indicador operacional baseado na quantidade de amostras e na variação entre elas. Mais amostras consistentes aumentam a confiança na estimativa."
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

/*
==================================================
MODAL
==================================================
*/

function InfoModal({ visible, onClose, title, text, colors, styles }: any) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.modalBackground}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons
              name="information-circle-outline"
              size={29}
              color={colors.primary}
            />
          </View>

          <Text style={styles.modalTitle}>{title}</Text>

          <Text style={styles.modalText}>{text}</Text>

          <TouchableOpacity style={styles.modalButton} onPress={onClose}>
            <Text style={styles.modalButtonText}>Entendi</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/*
==================================================
ESTILOS
==================================================
*/

function criarStyles(
  colors: any,

  fontScale: number,

  compacto: boolean,
) {
  return StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor: colors.background,
    },

    content: {
      paddingBottom: 60,
    },

    /*
    HEADER
    */

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

    /*
    TÍTULOS
    */

    sectionTitle: {
      color: colors.text,

      fontSize: 18 * fontScale,

      fontWeight: "800",

      marginHorizontal: 20,

      marginTop: compacto ? 20 : 26,

      marginBottom: 11,
    },

    /*
    EMPTY
    */

    emptyCard: {
      margin: 20,

      padding: 30,

      backgroundColor: colors.card,

      borderRadius: 22,

      alignItems: "center",

      borderWidth: 1,

      borderColor: colors.border,
    },

    emptyTitle: {
      color: colors.text,

      fontSize: 17 * fontScale,

      fontWeight: "800",

      marginTop: 12,
    },

    emptyText: {
      color: colors.textMuted,

      fontSize: 10 * fontScale,

      marginTop: 5,

      textAlign: "center",
    },

    /*
    SELECTOR
    */

    selector: {
      paddingHorizontal: 20,

      gap: 8,
    },

    chip: {
      backgroundColor: colors.card,

      borderWidth: 1,

      borderColor: colors.border,

      paddingHorizontal: 16,

      paddingVertical: 10,

      borderRadius: 14,
    },

    chipActive: {
      backgroundColor: colors.header,

      borderColor: colors.primary,
    },

    chipText: {
      color: colors.textMuted,

      fontSize: 11 * fontScale,

      fontWeight: "700",
    },

    chipTextActive: {
      color: "#FFFFFF",
    },

    /*
    RESUMO
    */

    summaryCard: {
      marginHorizontal: 20,

      backgroundColor: colors.header,

      borderRadius: 22,

      padding: compacto ? 18 : 22,
    },

    summaryTop: {
      flexDirection: "row",

      justifyContent: "space-between",

      alignItems: "center",
    },

    summaryLabel: {
      color: "#AFC1B2",

      fontSize: 9 * fontScale,

      fontWeight: "800",

      letterSpacing: 0.5,
    },

    summaryRow: {
      flexDirection: "row",

      alignItems: "flex-end",

      marginTop: 5,
    },

    summaryValue: {
      color: "#FFFFFF",

      fontSize: 38 * fontScale,

      fontWeight: "800",
    },

    summaryUnit: {
      color: colors.yellow,

      fontSize: 13 * fontScale,

      fontWeight: "800",

      marginLeft: 6,

      marginBottom: 6,
    },

    summaryClass: {
      color: "#B8CABB",

      fontSize: 11 * fontScale,

      marginTop: 4,
    },

    /*
    METRICAS
    */

    metricsRow: {
      flexDirection: "row",

      marginHorizontal: 14,

      marginTop: 12,
    },

    metricCard: {
      flex: 1,

      marginHorizontal: 6,

      minHeight: 112,

      backgroundColor: colors.card,

      borderRadius: 18,

      padding: 15,

      borderWidth: 1,

      borderColor: colors.border,
    },

    metricLabel: {
      color: colors.textMuted,

      fontSize: 9 * fontScale,

      fontWeight: "800",

      letterSpacing: 0.3,
    },

    metricValue: {
      color: colors.text,

      fontSize: 22 * fontScale,

      fontWeight: "800",

      marginTop: 8,
    },

    metricHelp: {
      color: colors.textMuted,

      fontSize: 9 * fontScale,

      marginTop: 4,
    },

    labelRow: {
      flexDirection: "row",

      alignItems: "center",

      gap: 4,
    },

    infoButton: {
      padding: 2,
    },

    /*
    CV
    */

    cvCard: {
      marginHorizontal: 20,

      marginTop: 12,

      backgroundColor: colors.card,

      borderRadius: 18,

      padding: 16,

      borderWidth: 1,

      borderColor: colors.border,

      flexDirection: "row",

      alignItems: "center",
    },

    cvLeft: {
      flex: 1,

      paddingRight: 12,
    },

    cvValue: {
      color: colors.text,

      fontSize: 23 * fontScale,

      fontWeight: "800",
    },

    cvHelp: {
      color: colors.textMuted,

      fontSize: 9 * fontScale,

      lineHeight: 14 * fontScale,

      marginTop: 5,
    },

    /*
    AMOSTRAGEM
    */

    samplingCard: {
      marginHorizontal: 20,

      marginTop: 12,

      padding: 15,

      backgroundColor: colors.cardSecondary,

      borderRadius: 17,

      flexDirection: "row",

      alignItems: "center",
    },

    samplingIcon: {
      width: 44,

      height: 44,

      borderRadius: 14,

      backgroundColor: colors.card,

      alignItems: "center",

      justifyContent: "center",
    },

    samplingInfo: {
      flex: 1,

      marginLeft: 11,
    },

    samplingLabel: {
      color: colors.textMuted,

      fontSize: 8 * fontScale,

      fontWeight: "800",
    },

    samplingTitle: {
      color: colors.text,

      fontSize: 15 * fontScale,

      fontWeight: "800",

      marginTop: 2,
    },

    samplingDescription: {
      color: colors.textMuted,

      fontSize: 9 * fontScale,

      lineHeight: 14 * fontScale,

      marginTop: 3,
    },

    /*
    GRAFICO
    */

    chartCard: {
      marginHorizontal: 20,

      backgroundColor: colors.card,

      borderRadius: 22,

      padding: 18,

      borderWidth: 1,

      borderColor: colors.border,
    },

    chartItem: {
      marginBottom: 18,
    },

    chartHeader: {
      flexDirection: "row",

      justifyContent: "space-between",

      alignItems: "center",

      marginBottom: 7,
    },

    chartLabel: {
      flex: 1,

      paddingRight: 10,

      color: colors.textSecondary,

      fontSize: 12 * fontScale,

      fontWeight: "700",
    },

    chartValue: {
      color: colors.text,

      fontSize: 12 * fontScale,

      fontWeight: "800",
    },

    barTrack: {
      height: 11,

      backgroundColor: colors.cardSecondary,

      borderRadius: 6,

      overflow: "hidden",
    },

    barFill: {
      height: 11,

      backgroundColor: colors.primary,

      borderRadius: 6,
    },

    chartNotice: {
      marginTop: 3,

      flexDirection: "row",

      alignItems: "flex-start",

      padding: 11,

      borderRadius: 13,

      backgroundColor: colors.cardSecondary,
    },

    chartNoticeText: {
      flex: 1,

      marginLeft: 7,

      color: colors.textMuted,

      fontSize: 9 * fontScale,

      lineHeight: 14 * fontScale,
    },

    /*
    RANGE
    */

    rangeCard: {
      marginHorizontal: 20,

      padding: 17,

      backgroundColor: colors.card,

      borderRadius: 18,

      borderWidth: 1,

      borderColor: colors.border,

      flexDirection: "row",

      alignItems: "center",
    },

    rangeSide: {
      flex: 1,

      alignItems: "flex-start",
    },

    rangeSideRight: {
      flex: 1,

      alignItems: "flex-end",
    },

    rangeCenter: {
      alignItems: "center",

      paddingHorizontal: 10,
    },

    rangeLabel: {
      color: colors.textMuted,

      fontSize: 8 * fontScale,

      fontWeight: "800",
    },

    rangeValue: {
      color: colors.text,

      fontSize: 20 * fontScale,

      fontWeight: "800",

      marginTop: 3,
    },

    rangeUnit: {
      color: colors.textMuted,

      fontSize: 8 * fontScale,
    },

    rangeAmplitude: {
      color: colors.textMuted,

      fontSize: 8 * fontScale,

      marginTop: 4,
    },

    /*
    EXPORT
    */

    exportCard: {
      marginHorizontal: 20,

      padding: 17,

      backgroundColor: colors.card,

      borderRadius: 22,

      borderWidth: 1,

      borderColor: colors.border,
    },

    exportHeading: {
      color: colors.text,

      fontSize: 16 * fontScale,

      fontWeight: "800",
    },

    exportDescription: {
      color: colors.textMuted,

      fontSize: 10 * fontScale,

      marginTop: 3,

      marginBottom: 14,
    },

    excelButton: {
      flexDirection: "row",

      alignItems: "center",

      backgroundColor: colors.cardSecondary,

      padding: 14,

      borderRadius: 16,

      borderWidth: 1,

      borderColor: colors.border,
    },

    exportIcon: {
      width: 45,

      height: 45,

      borderRadius: 14,

      backgroundColor: colors.card,

      justifyContent: "center",

      alignItems: "center",
    },

    exportInfo: {
      flex: 1,

      marginLeft: 11,

      marginRight: 8,
    },

    excelTitle: {
      color: colors.text,

      fontSize: 13 * fontScale,

      fontWeight: "800",
    },

    excelSubtitle: {
      color: colors.textMuted,

      fontSize: 9 * fontScale,

      lineHeight: 13 * fontScale,

      marginTop: 3,
    },

    pdfButton: {
      flexDirection: "row",

      alignItems: "center",

      backgroundColor: colors.headerSecondary,

      padding: 14,

      borderRadius: 16,

      marginTop: 9,
    },

    pdfIcon: {
      width: 45,

      height: 45,

      borderRadius: 14,

      backgroundColor: colors.header,

      justifyContent: "center",

      alignItems: "center",
    },

    pdfTitle: {
      color: "#FFFFFF",

      fontSize: 13 * fontScale,

      fontWeight: "800",
    },

    pdfSubtitle: {
      color: "#B9CABB",

      fontSize: 9 * fontScale,

      lineHeight: 13 * fontScale,

      marginTop: 3,
    },

    /*
    MOBILE TIP
    */

    mobileTip: {
      marginTop: 12,

      padding: 11,

      borderRadius: 13,

      flexDirection: "row",

      alignItems: "flex-start",

      backgroundColor: colors.cardSecondary,
    },

    mobileTipText: {
      flex: 1,

      marginLeft: 7,

      color: colors.textMuted,

      fontSize: 9 * fontScale,

      lineHeight: 14 * fontScale,
    },

    /*
    MODAL
    */

    modalBackground: {
      flex: 1,

      backgroundColor: "rgba(0,0,0,0.65)",

      justifyContent: "center",

      padding: 25,
    },

    modalCard: {
      backgroundColor: colors.card,

      borderRadius: 23,

      padding: 23,

      alignItems: "center",

      borderWidth: 1,

      borderColor: colors.border,
    },

    modalIcon: {
      width: 55,

      height: 55,

      borderRadius: 18,

      backgroundColor: colors.cardSecondary,

      justifyContent: "center",

      alignItems: "center",
    },

    modalTitle: {
      color: colors.text,

      fontSize: 18 * fontScale,

      fontWeight: "800",

      marginTop: 13,

      textAlign: "center",
    },

    modalText: {
      color: colors.textMuted,

      fontSize: 10 * fontScale,

      lineHeight: 16 * fontScale,

      textAlign: "center",

      marginTop: 7,
    },

    modalButton: {
      width: "100%",

      marginTop: 20,

      padding: 14,

      borderRadius: 14,

      backgroundColor: colors.primary,

      alignItems: "center",
    },

    modalButtonText: {
      color: "#FFFFFF",

      fontWeight: "800",
    },
  });
}
