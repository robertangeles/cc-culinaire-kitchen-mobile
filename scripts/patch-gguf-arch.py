#!/usr/bin/env python3
"""
HISTORICAL ARTEFACT — DO NOT RUN ON LIVE FILES

This script was written 2026-04-29 under a wrong premise: that the
Antoine GGUF's `general.architecture = "gemma4"` was a non-standard
Unsloth label that needed renaming to mainline `gemma3n`.

That premise was wrong. `gemma4` IS a valid mainline llama.cpp
architecture, added in build b8637 on 2026-04-02. The actual prior
failure was a `convert_hf_to_gguf.py` torchvision circular import
that corrupted the tokenizer write step — same architecture, broken
vocab. With the torchvision fix applied, the new GGUF on R2 loads
cleanly in any llama.rn release whose bundled llama.cpp is ≥ b8637
(currently `0.12.0-rc.3` and later; we're pinned to `0.12.0-rc.9`).

The file is kept here only as a working reference for how to walk a
GGUF's metadata + tensors via `gguf-py`. If you need to do similar
metadata surgery for some OTHER reason, copy the structure but not
the assumptions.

See: `wiki/decisions/model-quantization-must-be-mainline.md` for the
full corrected story.

Original (now-incorrect) docstring:
  Patch a GGUF file's architecture from `gemma4` to `gemma3n`. Renames:
    - general.architecture value:  "gemma4"  -> "gemma3n"
    - all keys with prefix "gemma4." -> "gemma3n."
    - tokenizer.ggml.model value:  "gemma4"  -> "gemma3n"
  Tensor data + all other keys are copied verbatim.
"""

import sys
sys.exit(
    "patch-gguf-arch.py is obsolete. gemma4 is a valid mainline "
    "llama.cpp architecture; do not rename it. See "
    "wiki/decisions/model-quantization-must-be-mainline.md."
)
# Original implementation preserved below for reference; the early
# sys.exit() above prevents accidental execution.

import sys
import time
from pathlib import Path

from gguf import GGUFReader, GGUFWriter, GGUFValueType


OLD_ARCH = "gemma4"
NEW_ARCH = "gemma3n"
OLD_KEY_PREFIX = f"{OLD_ARCH}."
NEW_KEY_PREFIX = f"{NEW_ARCH}."

# `tokenizer.ggml.model` accepts vocab-format names ("llama", "gpt2",
# "bert", etc), not architecture names. Gemma family uses sentencepiece
# llama-style — value is "llama". Earlier attempt set this to "gemma3n"
# which produced `unknown tokenizer: 'gemma3n'` from llama.cpp.
NEW_TOKENIZER_MODEL = "llama"


def patch(input_path: Path, output_path: Path) -> None:
    print(f"reading {input_path} ({input_path.stat().st_size / 1e9:.2f} GB)")
    t0 = time.time()
    reader = GGUFReader(str(input_path))
    print(f"read in {time.time() - t0:.1f}s — {len(reader.fields)} kv pairs, "
          f"{len(reader.tensors)} tensors")

    # Verify the input has the architecture name we expect to patch.
    arch_field = reader.fields.get("general.architecture")
    if arch_field is None:
        sys.exit("error: input has no general.architecture field — refusing to patch")
    arch_value = bytes(arch_field.parts[arch_field.data[0]]).decode("utf-8")
    if arch_value != OLD_ARCH:
        sys.exit(f"error: input architecture is {arch_value!r}, "
                 f"expected {OLD_ARCH!r} — refusing to patch")
    print(f"confirmed: input architecture = {arch_value!r}")

    writer = GGUFWriter(str(output_path), arch=NEW_ARCH)
    renamed_keys = []
    copied_keys = []

    for key, field in reader.fields.items():
        # Skip keys the writer will set for us based on `arch`.
        if key in ("general.architecture", "GGUF.version",
                   "GGUF.tensor_count", "GGUF.kv_count"):
            continue

        new_key = key
        if key.startswith(OLD_KEY_PREFIX):
            new_key = NEW_KEY_PREFIX + key[len(OLD_KEY_PREFIX):]
            renamed_keys.append((key, new_key))
        else:
            copied_keys.append(key)

        value_type = field.types[0] if field.types else None
        if value_type is None:
            print(f"  warn: skipping {key} — unknown value type")
            continue

        # Extract the value from the field's parts. The decoding
        # depends on the type. For arrays, types is [ARRAY, element_type].
        if value_type == GGUFValueType.ARRAY:
            elem_type = field.types[1]
            count = len(field.data)
            if elem_type == GGUFValueType.STRING:
                values = [bytes(field.parts[idx]).decode("utf-8") for idx in field.data]
                writer.add_array(new_key, values)
            else:
                values = [field.parts[idx].tolist()[0] if hasattr(field.parts[idx], "tolist")
                          else field.parts[idx] for idx in field.data]
                # Flatten if numpy returns lists
                values = [v[0] if isinstance(v, list) else v for v in values]
                writer.add_array(new_key, values)
        elif value_type == GGUFValueType.STRING:
            value = bytes(field.parts[field.data[0]]).decode("utf-8")
            # Patch the tokenizer.ggml.model value too — but to the
            # vocab-format name ("llama"), not the architecture name.
            if key == "tokenizer.ggml.model" and value == OLD_ARCH:
                print(f"  patching tokenizer.ggml.model: {value!r} -> {NEW_TOKENIZER_MODEL!r}")
                value = NEW_TOKENIZER_MODEL
            writer.add_string(new_key, value)
        elif value_type in (GGUFValueType.UINT8, GGUFValueType.UINT16,
                            GGUFValueType.UINT32, GGUFValueType.UINT64,
                            GGUFValueType.INT8, GGUFValueType.INT16,
                            GGUFValueType.INT32, GGUFValueType.INT64):
            value = int(field.parts[field.data[0]][0])
            _add_scalar(writer, value_type, new_key, value)
        elif value_type in (GGUFValueType.FLOAT32, GGUFValueType.FLOAT64):
            value = float(field.parts[field.data[0]][0])
            _add_scalar(writer, value_type, new_key, value)
        elif value_type == GGUFValueType.BOOL:
            value = bool(field.parts[field.data[0]][0])
            writer.add_bool(new_key, value)
        else:
            print(f"  warn: skipping {key} — unsupported value type {value_type}")

    print(f"renamed {len(renamed_keys)} keys "
          f"(e.g. {renamed_keys[0][0]!r} -> {renamed_keys[0][1]!r})" if renamed_keys else "no keys renamed")
    print(f"copied {len(copied_keys)} keys verbatim")

    print(f"writing {len(reader.tensors)} tensor info entries")
    for tensor in reader.tensors:
        # tensor.data is a uint8 ndarray of raw quantized bytes; its
        # .shape is the byte shape, which is what add_tensor expects
        # when raw_dtype is set. Don't pass raw_shape — the writer
        # derives it from tensor.data.shape and converts to logical
        # shape via quant_shape_from_byte_shape internally.
        writer.add_tensor(tensor.name, tensor.data,
                          raw_dtype=tensor.tensor_type)

    print("flushing header + kv data...")
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()

    elapsed = time.time() - t0
    out_size = output_path.stat().st_size
    print(f"done in {elapsed:.1f}s — wrote {out_size / 1e9:.2f} GB "
          f"to {output_path}")


def _add_scalar(writer, value_type, key, value):
    if value_type == GGUFValueType.UINT8:
        writer.add_uint8(key, value)
    elif value_type == GGUFValueType.UINT16:
        writer.add_uint16(key, value)
    elif value_type == GGUFValueType.UINT32:
        writer.add_uint32(key, value)
    elif value_type == GGUFValueType.UINT64:
        writer.add_uint64(key, value)
    elif value_type == GGUFValueType.INT8:
        writer.add_int8(key, value)
    elif value_type == GGUFValueType.INT16:
        writer.add_int16(key, value)
    elif value_type == GGUFValueType.INT32:
        writer.add_int32(key, value)
    elif value_type == GGUFValueType.INT64:
        writer.add_int64(key, value)
    elif value_type == GGUFValueType.FLOAT32:
        writer.add_float32(key, value)
    elif value_type == GGUFValueType.FLOAT64:
        writer.add_float64(key, value)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(f"usage: {sys.argv[0]} <input.gguf> <output.gguf>")
    patch(Path(sys.argv[1]), Path(sys.argv[2]))
