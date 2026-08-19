export type LeituraSensor = {
  diametro: number;
  tempoUltrassom: number;
  origem: "simulado" | "esp32";
  timestamp: string;
};

function aleatorio(minimo: number, maximo: number) {
  return Math.random() * (maximo - minimo) + minimo;
}

export async function obterLeituraSimulada(): Promise<LeituraSensor> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const diametro = aleatorio(25, 45);

  const velocidade = aleatorio(1600, 3200);

  const distancia = diametro / 100;

  const tempo = (distancia / velocidade) * 1_000_000;

  return {
    diametro: Number(diametro.toFixed(1)),

    tempoUltrassom: Number(tempo.toFixed(1)),

    origem: "simulado",

    timestamp: new Date().toISOString(),
  };
}

export async function obterLeituraESP32(
  baseUrl: string,
): Promise<LeituraSensor> {
  const controller = new AbortController();

  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const url = baseUrl.replace(/\/+$/, "");

    const resposta = await fetch(`${url}/leitura`, {
      signal: controller.signal,
    });

    if (!resposta.ok) {
      throw new Error("O ESP32 respondeu com erro.");
    }

    const dados = await resposta.json();

    if (
      typeof dados.diametro !== "number" ||
      typeof dados.tempoUltrassom !== "number"
    ) {
      throw new Error("Formato de leitura inválido.");
    }

    return {
      diametro: dados.diametro,

      tempoUltrassom: dados.tempoUltrassom,

      origem: "esp32",

      timestamp: new Date().toISOString(),
    };
  } catch {
    throw new Error("Não foi possível conectar ao grampo ESP32.");
  } finally {
    clearTimeout(timeout);
  }
}
