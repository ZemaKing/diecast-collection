// Generates the app/PWA icons in public/ from public/favicon.svg (the single source).
// Run after changing the SVG: `npm run icons`. Outputs are committed.
//
// - icon-192.png / icon-512.png: the SVG as-is (rounded square, transparent corners), manifest purpose "any"
// - icon-maskable-512.png: logo shrunk into the 80% safe zone on a full-bleed background, purpose "maskable"
//   (Android/Samsung crop it to their own shape — without it the launcher shrinks the "any" icon onto a plate)
// - apple-touch-icon.png: 180px, opaque (iOS applies its own mask and blackens transparency)
// - favicon.ico: 16/32/48 PNG-in-ICO fallback for browsers without SVG favicons
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "public/favicon.svg";
const BACKGROUND = "#051631"; // the SVG's own plate colour

const svg = await readFile(SOURCE);
const render = (size) => sharp(svg, { density: 300 }).resize(size, size);

async function onPlate(size, logoScale) {
	const logo = await render(Math.round(size * logoScale)).png().toBuffer();
	return sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
		.composite([{ input: logo, gravity: "center" }])
		.png()
		.toBuffer();
}

function toIco(pngs) {
	const header = Buffer.alloc(6 + 16 * pngs.length);
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(pngs.length, 4);
	let offset = header.length;
	pngs.forEach(({ size, data }, i) => {
		const entry = 6 + 16 * i;
		header[entry] = size % 256;
		header[entry + 1] = size % 256;
		header.writeUInt16LE(1, entry + 4); // colour planes
		header.writeUInt16LE(32, entry + 6); // bits per pixel
		header.writeUInt32LE(data.length, entry + 8);
		header.writeUInt32LE(offset, entry + 12);
		offset += data.length;
	});
	return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const outputs = {
	"public/icon-192.png": await render(192).png().toBuffer(),
	"public/icon-512.png": await render(512).png().toBuffer(),
	"public/icon-maskable-512.png": await onPlate(512, 0.72),
	"public/apple-touch-icon.png": await onPlate(180, 0.9),
	"public/favicon.ico": toIco(
		await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await render(size).png().toBuffer() }))),
	),
};

for (const [path, data] of Object.entries(outputs)) {
	await writeFile(path, data);
	console.log(`${path} (${data.length} bytes)`);
}
