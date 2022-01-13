export interface FoundrySystemManifest {
  name: string;
  title: string;
  description: string;
  version: string;
  minimumCoreVersion: string;
  compatibleCoreVersion: string;
  author: string;
  esmodules: string[];
  scripts: string[];
  styles: string[];
  packs: {
    name: string;
    label: string;
    system: string;
    module?: string;
    path: string;
    type: "Actor" | "Item" | "JournalEntry" | "Macro" | "RollTable";
    private?: boolean;
    folder?: string;
  }[];
  languages: {
    lang: string;
    name: string;
    path: string;
  }[];
  socket: string;
  templateVersion: string | number;
  initiative: string;
  gridDistance: string;
  gridUnits: string | number;
  url: string;
  manifest: string;
  download: string;
}
