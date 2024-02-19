import parseGitDiff, { type AnyChunk } from "parse-git-diff";
import { ConfigType } from "./config";
import picomatch from "picomatch";

export interface HandlerResponse {
  label: string | null;
  comment: string | null;
}

export interface Summary {
  add: number;
  del: number;
}

function summarizeChunk(chunk: AnyChunk): Summary {
  let add = 0;
  let del = 0;

  // Don't have any information for line change. Treating that as a rename
  if (chunk.type === "BinaryFilesChunk") {
    return { add, del };
  }

  for (const change of chunk.changes) {
    if (change.type === "AddedLine") {
      add++;
    }

    if (change.type === "DeletedLine") {
      del++;
    }
  }

  return { add, del };
}

export class Handler {
  public constructor(private readonly config: ConfigType) {}

  public async run(diffFile: string): Promise<HandlerResponse> {
    const summaryMap = this.genDiffSummary(diffFile);
    const summary: Summary = { add: 0, del: 0 };

    const matcher = picomatch(this.config.ignore);

    for (const [filepath, sum] of summaryMap) {
      if (matcher(filepath)) {
        continue;
      }

      summary.add += sum.add;
      summary.del += sum.del;
    }

    const size = this.getSize(summary);

    return {
      comment: null,
      label: size,
    };
  }

  private genDiffSummary(diffFile: string) {
    const diff = parseGitDiff(diffFile);

    const summary = new Map<string, Summary>();

    for (const file of diff.files) {
      const filename = file.type === "RenamedFile" ? file.pathAfter : file.path;

      let add = 0;
      let del = 0;

      for (const chunk of file.chunks) {
        const summary = summarizeChunk(chunk);
        add += summary.add;
        del += summary.del;
      }

      summary.set(filename, { add, del });
    }

    return summary;
  }

  private getSize(summary: Summary): string | null {
    const size = summary.add + summary.del;

    for (const preset of this.config.labels) {
      if (size >= preset.threshold) {
        return preset.name;
      }
    }

    return null;
  }
}
