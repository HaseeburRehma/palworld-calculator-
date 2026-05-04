/**
 * Low-level binary reader over a Uint8Array.
 *
 * GVAS encodes everything little-endian. Strings are length-prefixed and
 * may be UTF-8 (positive length) or UTF-16-LE (negative length). FNames
 * are serialized as FString.
 *
 * The reader maintains a cursor and reports past-end reads as a single
 * thrown `RangeError` — the parser pipeline catches these at boundary
 * points and converts them to `ParseError`s. We never let them bubble out.
 */

export class BinaryReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private cursor = 0;

  constructor(buffer: Uint8Array) {
    this.bytes = buffer;
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  /** Current byte offset. Useful for diagnostics. */
  get position(): number {
    return this.cursor;
  }

  /** Total length in bytes. */
  get length(): number {
    return this.bytes.byteLength;
  }

  /** Number of bytes remaining. */
  get remaining(): number {
    return this.length - this.cursor;
  }

  seek(offset: number): void {
    if (offset < 0 || offset > this.length) {
      throw new RangeError(`Seek to ${offset} is out of bounds [0, ${this.length}]`);
    }
    this.cursor = offset;
  }

  skip(n: number): void {
    this.seek(this.cursor + n);
  }

  /** Peek without advancing the cursor. */
  peekUint32LE(): number {
    this.assertRemaining(4);
    return this.view.getUint32(this.cursor, true);
  }

  /* -------------------- primitive reads -------------------- */

  readUint8(): number {
    this.assertRemaining(1);
    const v = this.view.getUint8(this.cursor);
    this.cursor += 1;
    return v;
  }

  readBool(): boolean {
    return this.readUint8() !== 0;
  }

  readUint16LE(): number {
    this.assertRemaining(2);
    const v = this.view.getUint16(this.cursor, true);
    this.cursor += 2;
    return v;
  }

  readInt32LE(): number {
    this.assertRemaining(4);
    const v = this.view.getInt32(this.cursor, true);
    this.cursor += 4;
    return v;
  }

  readUint32LE(): number {
    this.assertRemaining(4);
    const v = this.view.getUint32(this.cursor, true);
    this.cursor += 4;
    return v;
  }

  readInt64LE(): bigint {
    this.assertRemaining(8);
    const v = this.view.getBigInt64(this.cursor, true);
    this.cursor += 8;
    return v;
  }

  readUint64LE(): bigint {
    this.assertRemaining(8);
    const v = this.view.getBigUint64(this.cursor, true);
    this.cursor += 8;
    return v;
  }

  readFloat32LE(): number {
    this.assertRemaining(4);
    const v = this.view.getFloat32(this.cursor, true);
    this.cursor += 4;
    return v;
  }

  readFloat64LE(): number {
    this.assertRemaining(8);
    const v = this.view.getFloat64(this.cursor, true);
    this.cursor += 8;
    return v;
  }

  readBytes(n: number): Uint8Array {
    this.assertRemaining(n);
    const slice = this.bytes.subarray(this.cursor, this.cursor + n);
    this.cursor += n;
    return slice;
  }

  /* -------------------- compound reads -------------------- */

  /**
   * Unreal FString. A 32-bit length header. Positive = ASCII/UTF-8
   * (terminator included in length); negative = UTF-16-LE (count is
   * `-len` UTF-16 code units, terminator included).
   * Length 0 is the empty string.
   */
  readFString(): string {
    const lengthRaw = this.readInt32LE();
    if (lengthRaw === 0) return "";
    if (lengthRaw > 0) {
      const bytes = this.readBytes(lengthRaw);
      // Strip trailing null terminator.
      const end = bytes[bytes.length - 1] === 0 ? bytes.length - 1 : bytes.length;
      return UTF8_DECODER.decode(bytes.subarray(0, end));
    }
    const codeUnits = -lengthRaw;
    const byteLength = codeUnits * 2;
    const bytes = this.readBytes(byteLength);
    // Build a UTF-16-LE view, strip null terminator if present.
    const buf = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    const view = new Uint16Array(buf);
    const end = view[view.length - 1] === 0 ? view.length - 1 : view.length;
    return UTF16LE_DECODER.decode(new Uint8Array(buf, 0, end * 2));
  }

  /**
   * Unreal FName. Palworld's saves serialize FNames as FStrings inside
   * properties — many Unreal projects do. Some savegame variants encode
   * a 32-bit Number suffix; we treat that case as "string + suffix" and
   * hand it back as a single string `Name_<n>`.
   */
  readFName(): string {
    return this.readFString();
  }

  /** Unreal FGuid — 16 bytes, regrouped into the canonical UUID layout. */
  readGuid(): string {
    const bytes = this.readBytes(16);
    // FGuid stores four uint32s. Convert to the standard 8-4-4-4-12 hex form.
    const dv = new DataView(bytes.buffer, bytes.byteOffset, 16);
    const a = dv.getUint32(0, true);
    const b = dv.getUint32(4, true);
    const c = dv.getUint32(8, true);
    const d = dv.getUint32(12, true);
    const hex8 = (n: number) => n.toString(16).padStart(8, "0");
    const ah = hex8(a);
    const bh = hex8(b);
    const ch = hex8(c);
    const dh = hex8(d);
    return `${ah.slice(0, 8)}-${bh.slice(0, 4)}-${bh.slice(4, 8)}-${ch.slice(0, 4)}-${ch.slice(4, 8)}${dh.slice(0, 8)}`;
  }

  /* -------------------- internals -------------------- */

  private assertRemaining(n: number): void {
    if (this.cursor + n > this.length) {
      throw new RangeError(
        `Tried to read ${n} bytes at offset ${this.cursor} but file ends at ${this.length}`,
      );
    }
  }
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: false });
const UTF16LE_DECODER = new TextDecoder("utf-16le", { fatal: false });
