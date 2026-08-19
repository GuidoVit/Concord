export type CalibracaoWoodScan = {
  velocidadeMin: number;
  velocidadeMax: number;
  densidadeMin: number;
  densidadeMax: number;
};

export type EstatisticasTalhao = {
  quantidade: number;
  media: number;
  minima: number;
  maxima: number;
  amplitude: number;
  desvioPadrao: number;
  coeficienteVariacao: number;
  erroPadrao: number;
  ic95Min: number;
  ic95Max: number;
};

export type Aptidao = {
  nome: string;
  valor: number;
};

export const CALIBRACAO_PADRAO: CalibracaoWoodScan = {
  velocidadeMin: 1000,
  velocidadeMax: 3500,
  densidadeMin: 400,
  densidadeMax: 700,
};

export function calcularVelocidade(diametroCm: number, tempoUs: number) {
  if (diametroCm <= 0 || tempoUs <= 0) {
    return 0;
  }

  const distanciaMetros = diametroCm / 100;
  const tempoSegundos = tempoUs / 1_000_000;

  return distanciaMetros / tempoSegundos;
}

export function estimarDensidade(
  velocidade: number,
  calibracao: CalibracaoWoodScan,
) {
  const intervaloVelocidade =
    calibracao.velocidadeMax - calibracao.velocidadeMin;

  if (intervaloVelocidade <= 0) {
    return calibracao.densidadeMin;
  }

  const normalizado = Math.max(
    0,
    Math.min(1, (velocidade - calibracao.velocidadeMin) / intervaloVelocidade),
  );

  return (
    calibracao.densidadeMin +
    normalizado * (calibracao.densidadeMax - calibracao.densidadeMin)
  );
}

export function validarLeitura(
  diametro: number,
  tempo: number,
  velocidade: number,
  calibracao: CalibracaoWoodScan,
) {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!Number.isFinite(diametro) || diametro <= 0) {
    erros.push("O diâmetro deve ser maior que zero.");
  }

  if (!Number.isFinite(tempo) || tempo <= 0) {
    erros.push("O tempo ultrassônico deve ser maior que zero.");
  }

  if (diametro > 0 && (diametro < 5 || diametro > 150)) {
    avisos.push(
      "O diâmetro está fora da faixa operacional esperada de 5 a 150 cm.",
    );
  }

  if (tempo > 0 && (tempo < 20 || tempo > 3000)) {
    avisos.push(
      "O tempo ultrassônico está fora da faixa operacional esperada.",
    );
  }

  if (velocidade > 0 && (velocidade < 300 || velocidade > 7000)) {
    erros.push(
      "A velocidade calculada está muito fora de uma faixa fisicamente plausível. Verifique a medição.",
    );
  } else if (
    velocidade > 0 &&
    (velocidade < calibracao.velocidadeMin ||
      velocidade > calibracao.velocidadeMax)
  ) {
    avisos.push(
      "A velocidade está fora da faixa de calibração atual do WoodScan.",
    );
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

export function calcularEstatisticas(valores: number[]): EstatisticasTalhao {
  if (!valores.length) {
    return {
      quantidade: 0,
      media: 0,
      minima: 0,
      maxima: 0,
      amplitude: 0,
      desvioPadrao: 0,
      coeficienteVariacao: 0,
      erroPadrao: 0,
      ic95Min: 0,
      ic95Max: 0,
    };
  }

  const quantidade = valores.length;

  const media = valores.reduce((soma, valor) => soma + valor, 0) / quantidade;

  const minima = Math.min(...valores);
  const maxima = Math.max(...valores);
  const amplitude = maxima - minima;

  let desvioPadrao = 0;

  if (quantidade > 1) {
    const variancia =
      valores.reduce((soma, valor) => soma + Math.pow(valor - media, 2), 0) /
      (quantidade - 1);

    desvioPadrao = Math.sqrt(variancia);
  }

  const coeficienteVariacao = media > 0 ? (desvioPadrao / media) * 100 : 0;

  const erroPadrao = quantidade > 1 ? desvioPadrao / Math.sqrt(quantidade) : 0;

  const margem95 = 1.96 * erroPadrao;

  return {
    quantidade,
    media,
    minima,
    maxima,
    amplitude,
    desvioPadrao,
    coeficienteVariacao,
    erroPadrao,
    ic95Min: Math.max(0, media - margem95),
    ic95Max: media + margem95,
  };
}

export function avaliarAmostragem(
  quantidade: number,
  coeficienteVariacao: number,
) {
  let nivel = 0;

  if (quantidade >= 20) {
    nivel = 3;
  } else if (quantidade >= 10) {
    nivel = 2;
  } else if (quantidade >= 5) {
    nivel = 1;
  }

  if (coeficienteVariacao > 25 && nivel > 0) {
    nivel -= 1;
  }

  const niveis = [
    {
      nome: "Baixa",
      descricao:
        "Poucas amostras. Use o resultado apenas como indicação inicial.",
    },
    {
      nome: "Inicial",
      descricao: "A amostragem já permite observar tendências do talhão.",
    },
    {
      nome: "Adequada",
      descricao: "Boa quantidade de árvores para uma estimativa operacional.",
    },
    {
      nome: "Boa",
      descricao:
        "Amostragem ampla para comparação operacional dentro do talhão.",
    },
  ];

  return niveis[nivel];
}

export function classificarDensidade(densidade: number) {
  if (densidade < 450) {
    return "Baixa densidade";
  }

  if (densidade < 550) {
    return "Densidade média";
  }

  if (densidade < 650) {
    return "Média-alta densidade";
  }

  return "Alta densidade";
}

export function calcularAptidao(densidade: number): Aptidao[] {
  if (densidade < 450) {
    return [
      { nome: "Papel e celulose", valor: 95 },
      { nome: "Painéis leves", valor: 85 },
      { nome: "Mobiliário", valor: 40 },
      { nome: "Madeira serrada", valor: 35 },
      { nome: "Energia", valor: 30 },
      { nome: "Potencial estrutural", valor: 20 },
    ];
  }

  if (densidade < 550) {
    return [
      { nome: "Mobiliário", valor: 85 },
      { nome: "Madeira serrada", valor: 80 },
      { nome: "Papel e celulose", valor: 75 },
      { nome: "Painéis", valor: 75 },
      { nome: "Energia", valor: 50 },
      { nome: "Potencial estrutural", valor: 45 },
    ];
  }

  if (densidade < 650) {
    return [
      { nome: "Mobiliário", valor: 95 },
      { nome: "Madeira serrada", valor: 90 },
      { nome: "Pisos", valor: 85 },
      { nome: "Potencial estrutural", valor: 75 },
      { nome: "Energia", valor: 70 },
      { nome: "Papel e celulose", valor: 45 },
    ];
  }

  return [
    { nome: "Pisos", valor: 95 },
    { nome: "Madeira serrada", valor: 95 },
    { nome: "Mobiliário", valor: 90 },
    { nome: "Energia", valor: 90 },
    { nome: "Potencial estrutural", valor: 85 },
    { nome: "Papel e celulose", valor: 30 },
  ];
}
