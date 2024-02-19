import parseGitDiff, { type AnyChunk } from "parse-git-diff";

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
  public async run(diffFile: string): Promise<HandlerResponse> {
    const summaryMap = this.genDiffSummary(diffFile);
    const summary: Summary = { add: 0, del: 0 };

    // TODO: Ignore files base on config
    for (const s of summaryMap.values()) {
      summary.add += s.add;
      summary.del += s.del;
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

  private getSize(summary: Summary): string {
    // TODO: Respect config settings
    const size = summary.add + summary.del;

    if (size >= 1000) {
      return "size/x-large";
    }

    if (size >= 500) {
      return "size/large";
    }

    if (size >= 200) {
      return "size/medium";
    }

    if (size >= 100) {
      return "size/small";
    }

    return "size/x-small";
  }
}
