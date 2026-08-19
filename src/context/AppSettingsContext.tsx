import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { CALIBRACAO_PADRAO, CalibracaoWoodScan } from "../utils/woodscan";

export type TemaApp = "claro" | "escuro";

export type ModoSensor = "manual" | "simulado" | "esp32";

type Configuracoes = {
  tema: TemaApp;
  textoMaior: boolean;
  interfaceCompacta: boolean;
  modoSensor: ModoSensor;
  esp32Url: string;
  calibracao: CalibracaoWoodScan;
};

type ContextType = {
  configuracoes: Configuracoes;

  setTema: (tema: TemaApp) => Promise<void>;

  setTextoMaior: (valor: boolean) => Promise<void>;

  setInterfaceCompacta: (valor: boolean) => Promise<void>;

  setModoSensor: (modo: ModoSensor) => Promise<void>;

  setEsp32Url: (url: string) => Promise<void>;

  setCalibracao: (valores: Partial<CalibracaoWoodScan>) => Promise<void>;

  resetCalibracao: () => Promise<void>;

  colors: any;
  fontScale: number;
};

const CONFIG_KEY = "woodscan_configuracoes";

const configuracoesPadrao: Configuracoes = {
  tema: "claro",
  textoMaior: false,
  interfaceCompacta: false,
  modoSensor: "manual",
  esp32Url: "http://192.168.1.100",
  calibracao: CALIBRACAO_PADRAO,
};

const AppSettingsContext = createContext<ContextType | null>(null);

export function AppSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [configuracoes, setConfiguracoes] =
    useState<Configuracoes>(configuracoesPadrao);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      const dados = await AsyncStorage.getItem(CONFIG_KEY);

      if (!dados) return;

      const salvas = JSON.parse(dados);

      setConfiguracoes({
        ...configuracoesPadrao,
        ...salvas,

        calibracao: {
          ...CALIBRACAO_PADRAO,
          ...(salvas.calibracao ?? {}),
        },
      });
    } catch (erro) {
      console.log("Erro ao carregar configurações:", erro);
    }
  }

  async function salvar(novas: Configuracoes) {
    setConfiguracoes(novas);

    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(novas));
  }

  async function setTema(tema: TemaApp) {
    await salvar({
      ...configuracoes,
      tema,
    });
  }

  async function setTextoMaior(valor: boolean) {
    await salvar({
      ...configuracoes,
      textoMaior: valor,
    });
  }

  async function setInterfaceCompacta(valor: boolean) {
    await salvar({
      ...configuracoes,
      interfaceCompacta: valor,
    });
  }

  async function setModoSensor(modo: ModoSensor) {
    await salvar({
      ...configuracoes,
      modoSensor: modo,
    });
  }

  async function setEsp32Url(esp32Url: string) {
    await salvar({
      ...configuracoes,
      esp32Url,
    });
  }

  async function setCalibracao(valores: Partial<CalibracaoWoodScan>) {
    await salvar({
      ...configuracoes,

      calibracao: {
        ...configuracoes.calibracao,
        ...valores,
      },
    });
  }

  async function resetCalibracao() {
    await salvar({
      ...configuracoes,
      calibracao: {
        ...CALIBRACAO_PADRAO,
      },
    });
  }

  const colors = useMemo(() => {
    if (configuracoes.tema === "escuro") {
      return {
        background: "#101713",
        card: "#18221B",
        cardSecondary: "#1D2920",

        header: "#0D1F14",
        headerSecondary: "#173F27",

        primary: "#4C9A3E",
        yellow: "#FFDE00",

        text: "#F2F6F2",
        textSecondary: "#CFD8D0",
        textMuted: "#8F9C92",

        border: "#29372D",
        input: "#202D23",

        successBackground: "#183120",

        warningBackground: "#332E12",
        warning: "#FFDE00",

        dangerBackground: "#351A18",
        danger: "#FF6B5E",
      };
    }

    return {
      background: "#F3F5F1",
      card: "#FFFFFF",
      cardSecondary: "#EEF5EC",

      header: "#173F27",
      headerSecondary: "#225431",

      primary: "#367C2B",
      yellow: "#FFDE00",

      text: "#173F27",
      textSecondary: "#4E5E51",
      textMuted: "#7D897F",

      border: "#DDE6DA",
      input: "#F4F7F2",

      successBackground: "#EEF5EC",

      warningBackground: "#FFF9D8",
      warning: "#806B00",

      dangerBackground: "#FFF5F4",
      danger: "#B42318",
    };
  }, [configuracoes.tema]);

  const fontScale = configuracoes.textoMaior ? 1.12 : 1;

  return (
    <AppSettingsContext.Provider
      value={{
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
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error(
      "useAppSettings precisa estar dentro de AppSettingsProvider",
    );
  }

  return context;
}
