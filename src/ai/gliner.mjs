// Single-document span inference for GLiNER v2.1, using its published ONNX inputs.
// Token preparation follows GLiNER / GLiNER.js (see THIRD_PARTY_AI.md).
export class LocalDetector {
  constructor(ort, tokenizer, session) {
    Object.assign(this, { ort, tokenizer, session });
  }
  async detect(text, labels) {
    const words = [
      ...text.matchAll(/[\p{L}\p{N}_]+(?:[-_][\p{L}\p{N}_]+)*|\S/gu),
    ];
    if (!words.length || !labels.length) return [];
    const prompt = labels
      .flatMap((label) => ["<<ENT>>", label])
      .concat("<<SEP>>");
    const ids = [this.tokenizer.cls_token_id ?? 1],
      mask = [0];
    [...prompt, ...words.map((m) => m[0])].forEach((word, i) => {
      const encoded = this.tokenizer.encode(word, {
        add_special_tokens: false,
      });
      encoded.forEach((id, j) => {
        ids.push(id);
        mask.push(i >= prompt.length && j === 0 ? i - prompt.length + 1 : 0);
      });
    });
    ids.push(this.tokenizer.sep_token_id);
    mask.push(0);
    if (ids.length > 512)
      throw new Error("Passage trop long pour le modèle local.");
    const spans = [],
      valid = [];
    for (let i = 0; i < words.length; i++)
      for (let w = 0; w < 12; w++) {
        spans.push(i, Math.min(i + w, words.length - 1));
        valid.push(i + w < words.length ? 1 : 0);
      }
    const tensor = (data, dims, type = "int64") =>
      new this.ort.Tensor(
        type,
        type === "int64"
          ? BigInt64Array.from(data, BigInt)
          : Uint8Array.from(data),
        dims,
      );
    const output = await this.session.run({
      input_ids: tensor(ids, [1, ids.length]),
      attention_mask: tensor(
        ids.map(() => 1),
        [1, ids.length],
      ),
      words_mask: tensor(mask, [1, ids.length]),
      text_lengths: tensor([words.length], [1, 1]),
      span_idx: tensor(spans, [1, words.length * 12, 2]),
      span_mask: tensor(valid, [1, words.length * 12], "bool"),
    });
    const data = output.logits.data,
      results = [];
    for (let i = 0; i < words.length; i++)
      for (let w = 0; w < 12 && i + w < words.length; w++)
        for (let c = 0; c < labels.length; c++) {
          const score =
            1 / (1 + Math.exp(-data[(i * 12 + w) * labels.length + c]));
          if (score < 0.4) continue;
          const start = words[i].index,
            end = words[i + w].index + words[i + w][0].length;
          results.push({
            start,
            end,
            text: text.slice(start, end),
            label: labels[c],
            score,
            source: "model",
          });
        }
    Object.values(output).forEach((t) => t.dispose?.());
    const chosen = [];
    for (const e of results.sort((a, b) => b.score - a.score))
      if (!chosen.some((x) => x.start < e.end && x.end > e.start))
        chosen.push(e);
    return chosen.sort((a, b) => a.start - b.start);
  }
}
