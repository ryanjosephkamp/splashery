"""MIT. Remove Blender's volatile image metadata without recompressing pixels."""
import struct

def canonical_png(path):
    # Blender writes Date and RenderTime text even when the visible stamp is off.
    # Drop only textual/time metadata; keep pixel data, color profiles, and resolution.
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Expected PNG output')
    chunks = [data[:8]]
    offset = 8
    while offset < len(data):
        length = struct.unpack_from('>I', data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            raise ValueError('Truncated PNG output')
        if data[offset+4:offset+8] not in [b'tEXt', b'zTXt', b'iTXt', b'tIME']:
            chunks.append(data[offset:end])
        offset = end
    path.write_bytes(b''.join(chunks))


def canonical_jpeg(path):
    data = path.read_bytes()
    if data[:2] != b'\xff\xd8':
        raise ValueError('Expected JPEG output')
    chunks, offset = [data[:2]], 2
    while offset < len(data):
        if data[offset] != 0xff or offset+4 > len(data):
            raise ValueError('Invalid JPEG segment')
        marker = data[offset+1]
        if marker in [0xda, 0xd9]:  # Preserve all scan data and EOI verbatim.
            chunks.append(data[offset:])
            break
        length = struct.unpack_from('>H', data, offset+2)[0]
        end = offset+2+length
        if length < 2 or end > len(data):
            raise ValueError('Truncated JPEG segment')
        if marker != 0xfe:  # Blender records Date and render durations in COM segments.
            chunks.append(data[offset:end])
        offset = end
    path.write_bytes(b''.join(chunks))
