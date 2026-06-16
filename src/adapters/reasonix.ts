import { AcpAdapter } from "./acp-adapter.js"

export class ReasonixAdapter extends AcpAdapter {
  readonly id = "reasonix"
  readonly name = "Reasonix"
  readonly capabilities = ["research", "analysis"]
  readonly command = process.env.REASONIX_PATH ?? "reasonix"
  readonly acpArgs = ["acp"]

  protected versionCommand(): string {
    return `${this.command} --version`
  }
}
