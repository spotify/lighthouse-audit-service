declare module 'lighthouse' {
  export interface LHR {
    fetchTime: string;
    userAgent: string;
    finalUrl: string;
    lighthouseVersion: string;
    configSettings: {
      emulatedFormFactor: string;
    };
    categories: Record<string, LighthouseCategory>;
  }
  export interface LighthouseCategory {
    id: string;
    score: number;
    title: string;
    auditRefs: {
      id: string;
      group: string;
      weight: number;
    }[];
    description: string;
    manualDescription: string;
  }
  export interface LighthouseOptions {
    chromeFlags?: string[];
    port?: number;
    disableStorageReset?: boolean;
    emulatedFormFactor?: string;
  }
  export interface LighthouseConfig {}
  export interface LighthouseResponse {
    report: string;
    lhr: LHR;
  }
  export function lighthouse(
    url: string,
    opts: LighthouseOptions,
  ): Promise<LighthouseResponse>;
  export function lighthouse(
    url: string,
    opts: LighthouseOptions,
    config: LighthouseConfig | null,
  ): Promise<LighthouseResponse>;
  export default lighthouse;
}
