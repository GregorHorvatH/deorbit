"""Builds the relief map src/render/assets/relief.png from NOAA ETOPO1 (public domain, https://www.ncei.noaa.gov/products/etopo-global-relief-model).

Input: the CSV that NOAA's ERDDAP serves for dataset `etopo180` at a stride of 15 (a 0.25 degree grid):
  https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.csv?altitude[(-90):15:(90)][(-180):15:(180)]
Run:   python3 -I scripts/build_relief.py <that csv>
Output: a 1440 x 720 equirectangular 8-bit RGB PNG (top row = north, left column = -180 degrees):
  R  hill shading, light from the north-west; 128 = flat ground (the shader multiplies the colours by it)
  G  height of the land, sqrt-scaled: 0 = sea level ... 255 = 6000 m and more
  B  depth of the sea, sqrt-scaled:   0 = the shore ... 255 = 6000 m and more
Standard library only; the CSV is read as numbers and nothing in it is executed."""

import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "render", "assets", "relief.png")
W, H = 1440, 720
STEP = 0.25  # degrees
LAND_EXAGGERATION, SEA_EXAGGERATION = 6.0, 14.0
LIGHT_AZIMUTH, LIGHT_ALTITUDE = math.radians(315), math.radians(40)  # the usual: light from the north-west
M_PER_DEG = 111320.0


def read_grid(path):
    """Node values: nodes[j][i] for latitude -90 + j*STEP (j = 0..720) and longitude -180 + i*STEP (i = 0..1440)."""
    nodes = [[0.0] * (W + 1) for _ in range(H + 1)]
    with open(path) as f:
        f.readline()
        f.readline()  # the two header lines (names, units)
        for line in f:
            lat, lon, alt = line.split(",")
            j = round((float(lat) + 90) / STEP)
            i = round((float(lon) + 180) / STEP)
            nodes[j][i] = float(alt)
    return nodes


def cells(nodes):
    """Values at the pixel centres (the mean of the four surrounding nodes), north up: z[y][x]."""
    z = [[0.0] * W for _ in range(H)]
    for y in range(H):
        j = H - 1 - y  # row y = 0 is the northernmost; its cell lies between nodes j and j+1
        a, b = nodes[j], nodes[j + 1]
        for x in range(W):
            z[y][x] = (a[x] + a[x + 1] + b[x] + b[x + 1]) / 4
    return z


def shade(z):
    """Hill shading (0..1) with a different vertical exaggeration over land and over sea."""
    sin_alt, cos_alt = math.sin(LIGHT_ALTITUDE), math.cos(LIGHT_ALTITUDE)
    out = [[0.0] * W for _ in range(H)]
    for y in range(H):
        lat = 90 - (y + 0.5) * STEP
        dx = STEP * M_PER_DEG * max(0.05, math.cos(math.radians(lat)))  # metres between neighbours east-west
        dy = STEP * M_PER_DEG
        up, dn = z[max(0, y - 1)], z[min(H - 1, y + 1)]
        row = z[y]
        for x in range(W):
            e, w = row[(x + 1) % W], row[x - 1]
            ex = LAND_EXAGGERATION if row[x] > 0 else SEA_EXAGGERATION
            dzdx = (e - w) / (2 * dx) * ex
            dzdy = (up[x] - dn[x]) / (2 * dy) * ex  # up is north
            slope = math.atan(math.hypot(dzdx, dzdy))
            aspect = math.atan2(dzdy, -dzdx)
            s = sin_alt * math.cos(slope) + cos_alt * math.sin(slope) * math.cos(LIGHT_AZIMUTH - aspect)
            out[y][x] = max(0.0, s)
    return out


def png(rows, w, h):
    """An 8-bit RGB PNG; every row uses the 'Up' filter, which compresses smooth maps well."""
    raw = bytearray()
    prev = bytes(w * 3)
    for r in rows:
        raw.append(2)
        raw += bytes((r[i] - prev[i]) & 255 for i in range(w * 3))
        prev = r

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


# The maps are quantised: fewer distinct values compress much better (a PNG is not gzipped on the wire), and the eye
# cannot tell 64 steps of height or 32 steps of shading from 256.
SHADE_LEVELS, HEIGHT_LEVELS = 32, 64


def q(v, levels):
    step = 256 / levels
    return max(0, min(255, int(round(v / step)) * round(step)))


def main(csv_path):
    z = cells(read_grid(csv_path))
    s = shade(z)
    flat = math.sin(LIGHT_ALTITUDE)
    rows = []
    for y in range(H):
        r = bytearray(W * 3)
        for x in range(W):
            h = z[y][x]
            r[3 * x] = q(128 * s[y][x] / flat, SHADE_LEVELS)
            r[3 * x + 1] = q(255 * math.sqrt(min(h, 6000.0) / 6000.0), HEIGHT_LEVELS) if h > 0 else 0
            r[3 * x + 2] = q(255 * math.sqrt(min(-h, 6000.0) / 6000.0), HEIGHT_LEVELS) if h < 0 else 0
        rows.append(bytes(r))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = png(rows, W, H)
    with open(OUT, "wb") as f:
        f.write(data)
    hi = max(max(r) for r in z)
    lo = min(min(r) for r in z)
    print("wrote %s: %d x %d, %d bytes; highest %d m, deepest %d m" % (OUT, W, H, len(data), hi, lo))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
