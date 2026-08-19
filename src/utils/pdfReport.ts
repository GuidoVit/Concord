import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type LeituraPDF = {
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

export type AptidaoPDF = {
  nome: string;
  valor: number;
};

export type DadosRelatorioPDF = {
  hectare: string;
  leituras: LeituraPDF[];

  densidadeMedia: number;
  densidadeMinima: number;
  densidadeMaxima: number;

  coeficienteVariacao: number;

  precisao: string;
  amostragem: string;
  classificacao: string;

  aptidao: AptidaoPDF[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 38;

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  greenDark: rgb(23 / 255, 63 / 255, 39 / 255),

  green: rgb(54 / 255, 124 / 255, 43 / 255),

  greenMedium: rgb(76 / 255, 154 / 255, 62 / 255),

  greenLight: rgb(238 / 255, 245 / 255, 236 / 255),

  greenVeryLight: rgb(247 / 255, 250 / 255, 246 / 255),

  yellow: rgb(1, 222 / 255, 0),

  white: rgb(1, 1, 1),

  text: rgb(23 / 255, 63 / 255, 39 / 255),

  muted: rgb(112 / 255, 128 / 255, 116 / 255),

  border: rgb(215 / 255, 227 / 255, 212 / 255),

  grayBar: rgb(232 / 255, 238 / 255, 230 / 255),

  notice: rgb(1, 0.98, 0.86),
};

/*
==================================================
TEXTO SEGURO PARA WINANSI
==================================================

As fontes padrão Helvetica do pdf-lib usam WinAnsi.

Por isso símbolos como:
≈
→
←
≥
≤

podem causar erro.

Aqui fazemos a conversão automática.
==================================================
*/

function limparTexto(texto: string) {
  return String(texto ?? "")
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿµ³–—]/g, "");
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  color = COLORS.text,
) {
  const seguro = limparTexto(text);

  page.drawText(seguro, {
    x,
    y,
    size,
    font,
    color,
  });
}

function larguraTexto(texto: string, font: PDFFont, size: number) {
  return font.widthOfTextAtSize(limparTexto(texto), size);
}

/*
==================================================
HEADER
==================================================
*/

function desenharCabecalho(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  hectare: string,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 118,
    width: PAGE_WIDTH,
    height: 118,
    color: COLORS.greenDark,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 124,
    width: PAGE_WIDTH,
    height: 6,
    color: COLORS.yellow,
  });

  drawText(
    page,
    "WOODSCAN",
    MARGIN,
    PAGE_HEIGHT - 42,
    10,
    fontBold,
    COLORS.yellow,
  );

  drawText(
    page,
    "Relatório de análise florestal",
    MARGIN,
    PAGE_HEIGHT - 72,
    23,
    fontBold,
    COLORS.white,
  );

  const data = new Date().toLocaleDateString("pt-BR");

  drawText(
    page,
    `${hectare} - ${data}`,
    MARGIN,
    PAGE_HEIGHT - 94,
    9,
    fontRegular,
    rgb(0.75, 0.82, 0.76),
  );
}

/*
==================================================
DENSIDADE PRINCIPAL
==================================================
*/

function desenharDensidade(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  dados: DadosRelatorioPDF,
  y: number,
) {
  const height = 88;

  page.drawRectangle({
    x: MARGIN,
    y: y - height,
    width: CONTENT_WIDTH,
    height,
    color: COLORS.greenDark,
  });

  drawText(
    page,
    "DENSIDADE MÉDIA ESTIMADA",
    MARGIN + 18,
    y - 24,
    8,
    fontBold,
    rgb(0.72, 0.79, 0.73),
  );

  const valor = `~ ${dados.densidadeMedia.toFixed(0)}`;

  drawText(page, valor, MARGIN + 18, y - 58, 30, fontBold, COLORS.white);

  const larguraValor = larguraTexto(valor, fontBold, 30);

  drawText(
    page,
    "kg/m³",
    MARGIN + 18 + larguraValor + 8,
    y - 56,
    12,
    fontBold,
    COLORS.yellow,
  );

  drawText(
    page,
    dados.classificacao,
    MARGIN + 18,
    y - 76,
    9,
    fontRegular,
    rgb(0.72, 0.79, 0.73),
  );

  return y - height - 14;
}

/*
==================================================
INDICADORES PRINCIPAIS
==================================================
*/

function desenharIndicadores(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  dados: DadosRelatorioPDF,
  y: number,
) {
  const gap = 8;

  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;

  const height = 72;

  const itens = [
    {
      titulo: "AMOSTRAS",

      valor: dados.leituras.length.toString(),

      detalhe: "árvores analisadas",
    },

    {
      titulo: "PRECISÃO",

      valor: dados.precisao,

      detalhe: "indicador operacional",
    },

    {
      titulo: "COEF. DE VARIAÇÃO",

      valor: `${dados.coeficienteVariacao.toFixed(1)}%`,

      detalhe: "menor = mais uniforme",
    },
  ];

  itens.forEach((item, index) => {
    const x = MARGIN + index * (cardWidth + gap);

    page.drawRectangle({
      x,
      y: y - height,

      width: cardWidth,

      height,

      color: COLORS.greenVeryLight,

      borderColor: COLORS.border,

      borderWidth: 0.8,
    });

    drawText(page, item.titulo, x + 12, y - 20, 7, fontBold, COLORS.muted);

    drawText(page, item.valor, x + 12, y - 45, 18, fontBold, COLORS.greenDark);

    drawText(
      page,
      item.detalhe,
      x + 12,
      y - 61,
      6.5,
      fontRegular,
      COLORS.muted,
    );
  });

  return y - height - 10;
}

/*
==================================================
INDICADORES SECUNDÁRIOS
==================================================
*/

function desenharSecundarios(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  dados: DadosRelatorioPDF,
  y: number,
) {
  const gap = 8;

  const cardWidth = (CONTENT_WIDTH - gap * 2) / 3;

  const height = 63;

  const melhor = [...dados.aptidao].sort((a, b) => b.valor - a.valor)[0];

  const itens = [
    {
      titulo: "DENSIDADE MÍNIMA",

      valor: dados.densidadeMinima.toFixed(0),

      detalhe: "kg/m³",
    },

    {
      titulo: "DENSIDADE MÁXIMA",

      valor: dados.densidadeMaxima.toFixed(0),

      detalhe: "kg/m³",
    },

    {
      titulo: "USO PRINCIPAL",

      valor: melhor?.nome ?? "--",

      detalhe: melhor ? `${melhor.valor}% de índice` : "",
    },
  ];

  itens.forEach((item, index) => {
    const x = MARGIN + index * (cardWidth + gap);

    page.drawRectangle({
      x,
      y: y - height,

      width: cardWidth,

      height,

      color: COLORS.white,

      borderColor: COLORS.border,

      borderWidth: 0.8,
    });

    drawText(page, item.titulo, x + 12, y - 18, 6.5, fontBold, COLORS.muted);

    let valor = item.valor;

    if (valor.length > 19) {
      valor = valor.slice(0, 18) + ".";
    }

    drawText(
      page,
      valor,
      x + 12,
      y - 41,
      valor.length > 12 ? 11 : 17,
      fontBold,
      COLORS.greenDark,
    );

    drawText(
      page,
      item.detalhe,
      x + 12,
      y - 55,
      6.5,
      fontRegular,
      COLORS.muted,
    );
  });

  return y - height - 15;
}

/*
==================================================
APTIDÃO
==================================================
*/

function desenharAptidao(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  aptidao: AptidaoPDF[],
  y: number,
) {
  drawText(
    page,
    "Aptidão estimada por produto",
    MARGIN,
    y,
    15,
    fontBold,
    COLORS.greenDark,
  );

  y -= 16;

  const height = aptidao.length * 31 + 22;

  page.drawRectangle({
    x: MARGIN,
    y: y - height,

    width: CONTENT_WIDTH,

    height,

    color: COLORS.white,

    borderColor: COLORS.border,

    borderWidth: 0.8,
  });

  let linhaY = y - 23;

  aptidao.forEach((item) => {
    drawText(
      page,
      item.nome,
      MARGIN + 15,
      linhaY,
      8.5,
      fontRegular,
      COLORS.greenDark,
    );

    const percentual = `${item.valor}%`;

    const largura = larguraTexto(percentual, fontBold, 8.5);

    drawText(
      page,
      percentual,
      PAGE_WIDTH - MARGIN - 15 - largura,
      linhaY,
      8.5,
      fontBold,
      COLORS.greenDark,
    );

    const trackX = MARGIN + 15;

    const trackY = linhaY - 11;

    const trackWidth = CONTENT_WIDTH - 30;

    page.drawRectangle({
      x: trackX,
      y: trackY,
      width: trackWidth,
      height: 6,
      color: COLORS.grayBar,
    });

    const percentualNormalizado = Math.max(0, Math.min(100, item.valor));

    const preenchido = trackWidth * (percentualNormalizado / 100);

    page.drawRectangle({
      x: trackX,
      y: trackY,
      width: preenchido,
      height: 6,
      color: COLORS.greenMedium,
    });

    const marcadorX = Math.min(
      trackX + preenchido - 2,

      trackX + trackWidth - 4,
    );

    if (preenchido > 3) {
      page.drawRectangle({
        x: marcadorX,

        y: trackY - 1,

        width: 4,

        height: 8,

        color: COLORS.yellow,
      });
    }

    linhaY -= 31;
  });

  return y - height - 17;
}

/*
==================================================
TABELA
==================================================
*/

const TABLE_WIDTHS = [55, 82, 88, 100, 110, 84];

function desenharTabelaCabecalho(page: PDFPage, fontBold: PDFFont, y: number) {
  const labels = [
    "Árvore",
    "Diâmetro",
    "Tempo",
    "Velocidade",
    "Densidade",
    "Origem",
  ];

  let x = MARGIN;

  labels.forEach((label, index) => {
    page.drawRectangle({
      x,
      y: y - 22,

      width: TABLE_WIDTHS[index],

      height: 22,

      color: COLORS.greenDark,
    });

    drawText(page, label, x + 5, y - 14, 6.5, fontBold, COLORS.white);

    x += TABLE_WIDTHS[index];
  });

  return y - 22;
}

function desenharTabelaLinha(
  page: PDFPage,
  fontRegular: PDFFont,
  leitura: LeituraPDF,
  y: number,
  index: number,
) {
  const values = [
    leitura.arvore,

    `${leitura.diametro.toFixed(1)} cm`,

    `${leitura.tempoUltrassom.toFixed(1)} µs`,

    `${leitura.velocidade.toFixed(0)} m/s`,

    `${leitura.densidadeEstimada.toFixed(0)} kg/m³`,

    leitura.origem === "simulado"
      ? "Simulado"
      : leitura.origem === "esp32"
        ? "ESP32"
        : "Manual",
  ];

  let x = MARGIN;

  const background = index % 2 === 0 ? COLORS.greenVeryLight : COLORS.white;

  values.forEach((value, col) => {
    page.drawRectangle({
      x,
      y: y - 20,

      width: TABLE_WIDTHS[col],

      height: 20,

      color: background,

      borderColor: COLORS.border,

      borderWidth: 0.3,
    });

    drawText(page, value, x + 5, y - 13, 6.5, fontRegular, COLORS.text);

    x += TABLE_WIDTHS[col];
  });

  return y - 20;
}

/*
==================================================
OBSERVAÇÃO
==================================================
*/

function desenharObservacao(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  y: number,
) {
  const height = 44;

  page.drawRectangle({
    x: MARGIN,

    y: y - height,

    width: CONTENT_WIDTH,

    height,

    color: COLORS.notice,
  });

  page.drawRectangle({
    x: MARGIN,

    y: y - height,

    width: 5,

    height,

    color: COLORS.yellow,
  });

  drawText(
    page,
    "Observação",
    MARGIN + 14,
    y - 16,
    7.5,
    fontBold,
    COLORS.greenDark,
  );

  drawText(
    page,
    "Os resultados são estimativas operacionais e não substituem ensaios laboratoriais ou certificação estrutural.",
    MARGIN + 14,
    y - 30,
    6.5,
    fontRegular,
    COLORS.greenDark,
  );

  return y - height;
}

/*
==================================================
RODAPÉ
==================================================
*/

function desenharRodape(
  page: PDFPage,
  fontRegular: PDFFont,
  pagina: number,
  total: number,
) {
  page.drawLine({
    start: {
      x: MARGIN,
      y: 28,
    },

    end: {
      x: PAGE_WIDTH - MARGIN,

      y: 28,
    },

    thickness: 0.5,

    color: COLORS.border,
  });

  drawText(
    page,
    "WoodScan - Sistema de análise florestal - Projeto acadêmico",
    MARGIN,
    15,
    6,
    fontRegular,
    COLORS.muted,
  );

  const texto = `${pagina}/${total}`;

  const largura = larguraTexto(texto, fontRegular, 6);

  drawText(
    page,
    texto,
    PAGE_WIDTH - MARGIN - largura,
    15,
    6,
    fontRegular,
    COLORS.muted,
  );
}

/*
==================================================
GERAÇÃO DO PDF
==================================================
*/

export async function gerarRelatorioPDF(dados: DadosRelatorioPDF) {
  const pdfDoc = await PDFDocument.create();

  pdfDoc.setTitle(`WoodScan - ${dados.hectare}`);

  pdfDoc.setAuthor("WoodScan");

  pdfDoc.setSubject("Relatório de análise florestal");

  pdfDoc.setCreator("WoodScan");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  /*
  ================================================
  PÁGINA 1
  ================================================
  */

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  desenharCabecalho(page, fontBold, fontRegular, dados.hectare);

  let y = PAGE_HEIGHT - 150;

  y = desenharDensidade(page, fontBold, fontRegular, dados, y);

  y = desenharIndicadores(page, fontBold, fontRegular, dados, y);

  y = desenharSecundarios(page, fontBold, fontRegular, dados, y);

  const aptidaoOrdenada = [...dados.aptidao]
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);

  y = desenharAptidao(page, fontBold, fontRegular, aptidaoOrdenada, y);

  /*
  ================================================
  LEITURAS NA PRIMEIRA PÁGINA
  ================================================
  */

  let indiceLeitura = 0;

  if (y > 145) {
    drawText(
      page,
      "Leituras consideradas",
      MARGIN,
      y,
      15,
      fontBold,
      COLORS.greenDark,
    );

    y -= 14;

    y = desenharTabelaCabecalho(page, fontBold, y);

    while (indiceLeitura < dados.leituras.length && y > 90) {
      y = desenharTabelaLinha(
        page,
        fontRegular,
        dados.leituras[indiceLeitura],
        y,
        indiceLeitura,
      );

      indiceLeitura++;
    }
  }

  if (y > 75) {
    y -= 10;

    desenharObservacao(page, fontBold, fontRegular, y);
  }

  /*
  ================================================
  PÁGINAS EXTRAS
  ================================================
  */

  while (indiceLeitura < dados.leituras.length) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    page.drawRectangle({
      x: 0,

      y: PAGE_HEIGHT - 72,

      width: PAGE_WIDTH,

      height: 72,

      color: COLORS.greenDark,
    });

    page.drawRectangle({
      x: 0,

      y: PAGE_HEIGHT - 77,

      width: PAGE_WIDTH,

      height: 5,

      color: COLORS.yellow,
    });

    drawText(
      page,
      "WOODSCAN",
      MARGIN,
      PAGE_HEIGHT - 30,
      9,
      fontBold,
      COLORS.yellow,
    );

    drawText(
      page,
      `Leituras - ${dados.hectare}`,
      MARGIN,
      PAGE_HEIGHT - 53,
      18,
      fontBold,
      COLORS.white,
    );

    y = PAGE_HEIGHT - 105;

    y = desenharTabelaCabecalho(page, fontBold, y);

    while (indiceLeitura < dados.leituras.length && y > 55) {
      y = desenharTabelaLinha(
        page,
        fontRegular,
        dados.leituras[indiceLeitura],
        y,
        indiceLeitura,
      );

      indiceLeitura++;
    }
  }

  /*
  ================================================
  RODAPÉS
  ================================================
  */

  const paginas = pdfDoc.getPages();

  paginas.forEach((paginaAtual, index) => {
    desenharRodape(paginaAtual, fontRegular, index + 1, paginas.length);
  });

  return await pdfDoc.save();
}
