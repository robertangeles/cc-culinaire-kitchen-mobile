---
title: Antoine GGUF — quantization pipeline + llama.rn version pin
category: decision
created: 2026-04-30
updated: 2026-04-30
related: [[antoine]], [[llama-rn-inference-params]]
---

The fine-tuned Antoine weights are quantized via mainline `llama.cpp`'s `convert_hf_to_gguf.py` to a `gemma4`-architecture GGUF. To load this file, the app must run on `llama.rn` ≥ `0.12.0-rc.3` (when the bundled llama.cpp picked up `LLM_ARCH_GEMMA4`).

> **Correction (2026-04-30):** an earlier version of this page claimed `gemma4` was a non-standard Unsloth architecture and that the model needed to be re-quantized as `gemma3n`. That was wrong. `gemma4` IS a valid mainline llama.cpp architecture, added in build **b8637 on 2026-04-02**. The actual prior failure was a `convert_hf_to_gguf.py` `torchvision` circular import that corrupted the tokenizer write step — same architecture, broken vocab. With the torchvision fix applied to the conversion script, the new file loads cleanly.

## What we know now

| Fact                                                                                            | Source                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `gemma4` is valid mainline llama.cpp arch                                                       | `node_modules/llama.rn/cpp/llama-arch.h` enumerates `LLM_ARCH_GEMMA4`; mainline added it in build **b8637 (2026-04-02)** |
| `llama.rn@0.11.5` (released 2026-03-22) lacks gemma4                                            | Bundled llama.cpp source pre-dates b8637; no `LLM_ARCH_GEMMA4` symbol                                                    |
| `llama.rn@0.12.0-rc.9` (released 2026-04-17) has gemma4                                         | Inspected `cpp/llama-arch.{h,cpp}` in the npm tarball — confirms `LLM_ARCH_GEMMA4` registered with name `"gemma4"`       |
| 0.12.0-rc.3 (2026-04-03) is the first RC after b8637                                            | npm release timeline; not separately verified — use rc.9 as the safer pin                                                |
| The R2-hosted Antoine GGUF declares `general.architecture = "gemma4"`                           | `gguf-py` host-side metadata read on the new file                                                                        |
| The R2-hosted GGUF carries `tokenizer.ggml.model = "gemma4"`, 514906 merges, all special tokens | Same `gguf-py` read; matches the count expected from the corrected conversion run                                        |

## Active pin

[package.json](package.json) — `"llama.rn": "0.12.0-rc.9"` (a release candidate, not stable). Reasons:

- The `gemma4` arch isn't in any stable llama.rn release yet — the latest stable is `0.11.5` and predates b8637.
- 0.12.0-rc.9 has been out since 2026-04-17, ~2 weeks of community soak time at the time of pinning.
- API surface used by `inferenceService.ts` (`initLlama`, `releaseAllLlama`, `LlamaContext.completion`, `toggleNativeLog`, `addNativeLogListener`, `TokenData`) is unchanged from 0.11.5 — confirmed by the 94/94 passing tests post-upgrade.

When llama.rn ships 0.12.0 stable (or a later stable that includes b8637), bump the pin and drop the RC.

## Quantization procedure (the corrected version of this script)

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
git log -1 --format="%H %s"   # capture the SHA you used; record in the wiki log
pip install -r requirements.txt

# Run the conversion. If it errors with a torchvision circular import,
# upgrade torchvision (or downgrade torch/torchvision to a known-compatible
# pair) BEFORE proceeding — the previous failure mode was the converter
# writing a corrupted tokenizer when the import resolved partially.
python convert_hf_to_gguf.py /path/to/antoine-fine-tuned-hf-format \
  --outfile antoine-f16.gguf \
  --outtype f16

cmake -B build && cmake --build build --target llama-quantize
./build/bin/llama-quantize antoine-f16.gguf antoine-Q4_K_M.gguf Q4_K_M
sha256sum antoine-Q4_K_M.gguf
```

### Sanity check before uploading to R2

```bash
python -c "
from gguf import GGUFReader
r = GGUFReader('antoine-Q4_K_M.gguf')
arch = bytes(r.fields['general.architecture'].parts[r.fields['general.architecture'].data[0]]).decode()
tk   = bytes(r.fields['tokenizer.ggml.model'].parts[r.fields['tokenizer.ggml.model'].data[0]]).decode()
merges_field = r.fields.get('tokenizer.ggml.merges')
print(f'arch:               {arch}')
print(f'tokenizer.model:    {tk}')
print(f'total tensors:      {len(r.tensors)}')
print(f'token merges count: {len(merges_field.data) if merges_field else None}')
"
```

Expected: `arch: gemma4`, `tokenizer.model: gemma4`, `total tensors: 720`, merges count > 500,000 (the previous broken file had a corrupt merges array). All four must match before R2 upload.

## What the host-side `scripts/patch-gguf-arch.py` is good for now

Nothing related to gemma4 — that script was written under the wrong premise that gemma4 was non-standard. **Do not run it on a known-good gemma4 file.** It now lives only as a historical reference for how to walk a GGUF's metadata via `gguf-py`. The header at the top of the file should be amended to say so, or the file deleted entirely.

## Future-proofing

- When llama.rn ships a stable release ≥ 0.12.0, bump the pin and drop `-rc.9`.
- When mainline llama.cpp adds `gemma5` (or whatever's next), the same loop reapplies: check `cpp/llama-arch.{h,cpp}` in the bundled source, find a llama.rn release whose snapshot includes the new arch, pin to it.
- Consider a CI check that reads the active R2-hosted GGUF's metadata at build time and asserts the bundled llama.rn supports the declared architecture. Cheap insurance against a future "ship a model the runtime can't load" failure.

## See also

- [[antoine]] — the model artefact + lifecycle
- [[llama-rn-inference-params]] — runtime parameters for inference
- `scripts/patch-gguf-arch.py` — historical, do not run; kept as a `gguf-py` walking reference
