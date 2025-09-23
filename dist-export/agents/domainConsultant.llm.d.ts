type Req = {
  documentText: string;
  domain?: string;
  personas?: string[];
};
type Res = any;
export declare function consultDomainLLM(req: Req): Promise<Res>;
export {};
//# sourceMappingURL=domainConsultant.llm.d.ts.map
