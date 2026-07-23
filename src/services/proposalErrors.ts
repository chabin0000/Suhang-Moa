export class ProposalSubmitError extends Error {
  readonly code: "validation" | "logout-required" | "submission-failed";

  constructor(code: ProposalSubmitError["code"], message: string) {
    super(message);
    this.name = "ProposalSubmitError";
    this.code = code;
  }
}
