import os from "node:os";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import Jimp from "jimp";

const rl = readline.createInterface(stdin);

const IMAGE_REGEX = /_Gi=69[;,]OK/g;
const LOCAL_REGEX = /_Gi=31[;,]OK/g;
export async function hasImageSupport(): Promise<boolean> {
  stdin.setRawMode(true);
  stdin.resume();
  let data = "";
  stdin.on("data", function (chunk) {
    data += chunk.toString();
  });

  const subprocess = childProcess.spawn(
    `printf`,
    [`\\033_Gi=69,s=1,v=1,a=q,t=d,f=24;AAAA\\033\\\\\\033[c`],
    {
      stdio: [stdin, stdout, "pipe"],
    }
  );

  const all = await new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(data);
      stdin.pause();
      subprocess.kill();
    }, 20);
  });

  // clear line
  rl.write("", { ctrl: true, name: "u" });

  return IMAGE_REGEX.test(all);
}
export async function hasLocalSupport(): Promise<boolean> {
  // create a temp file that will hold a 1x1 image
  const image = new Jimp(1, 1, "#00000077");
  const tmpFilePath = path.join(
    os.tmpdir(),
    `.tmp.kitty.${Math.random().toString().slice(2) || "0"}`
  );
  image.write(tmpFilePath);

  stdin.setRawMode(true);
  stdin.resume();
  let data = "";
  stdin.on("data", function (chunk) {
    data += chunk.toString();
  });

  const subprocess = childProcess.spawn(
    `printf`,
    [
      `${`\\033_Gi=31,s=1,v=1,a=q,t=t;${Buffer.from(tmpFilePath).toString(
        "base64"
      )}\\033\\\\`}`,
    ],
    {
      stdio: [stdin, stdout, "pipe"],
    }
  );

  const all = await new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve(data);
      stdin.pause();
      subprocess.kill();
    }, 20);
  });

  // clear line
  rl.write("", { ctrl: true, name: "u" });

  return LOCAL_REGEX.test(all);
}

export async function drawImageFromUrl(pngBuffer: Buffer): Promise<void> {
  const tmpFilePath = path.join(
    os.tmpdir(),
    `.tmp.kitty.${Math.random().toString().slice(2) || "0"}.png`
  );
  fs.writeFileSync(tmpFilePath, pngBuffer);
  const subprocess = childProcess.spawn(
    `printf`,
    [
      `\\033_Gf=100,t=t,a=T,X=4,Y=4;${Buffer.from(tmpFilePath).toString(
        "base64"
      )}\\033\\\\`,
    ],
    {
      stdio: ["pipe", "inherit", "pipe"],
    }
  );
  await new Promise((resolve) => {
    setTimeout(() => {
      childProcess.spawnSync(`printf`, [`\n`], {
        stdio: ["pipe", "inherit", "pipe"],
      });
      resolve(undefined);
      subprocess.kill();
    }, 20);
  });
}

export async function drawImageFromBuffer(pngBuffer: Buffer): Promise<void> {
  const asBase64 = pngBuffer.toString("base64");
  const chunks: string[] = [];
  for (let i = 0; i < asBase64.length; i += 256) {
    chunks.push(asBase64.slice(i, i + 256));
  }
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    childProcess.spawnSync(
      `printf`,
      [
        `\\033_Gf=100,m=${
          i === chunks.length - 1 ? 0 : 1
        },a=T,X=4,Y=4;${chunk}\\033\\\\`,
      ],
      {
        stdio: ["pipe", "inherit", "pipe"],
      }
    );
  }
  childProcess.spawnSync(`printf`, [`\n`], {
    stdio: "inherit",
  });
}

/// Returns the terminal's support for the Kitty graphics protocol.
export type KittySupport = "local" | "remote" | "none";

let kittySupport: KittySupport | undefined;

export const getKittySupport = async (): Promise<KittySupport> => {
  if (kittySupport === undefined) {
    kittySupport = (await hasImageSupport())
      ? (await hasLocalSupport())
        ? "local"
        : "remote"
      : "none";
  }
  stdin.destroy();
  return kittySupport;
};

type Options<T = never> = {
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  fallback: () => T;
};

export class UnsupportedTerminalError extends Error {
  constructor() {
    super("Terminal must support Kitty graphics protocol");
    this.name = "UnsupportedTerminalError";
  }
}

function unsupported(): never {
  throw new UnsupportedTerminalError();
}

export const terminalKittyImage = async <T = never>(
  image: string | Buffer,
  options: Partial<Options<T>> = {}
): Promise<undefined | T> => {
  const fallback = options.fallback ?? unsupported;
  const kittySupport: KittySupport = await getKittySupport();
  const imagePath = path.resolve(process.cwd(), image.toString());

  let pngBuffer: Buffer;
  if (typeof image === "string") {
    const image = await Jimp.read(imagePath);
    if (options?.preserveAspectRatio === false) {
      image.resize(options.width ?? Jimp.AUTO, options.height ?? Jimp.AUTO);
    } else {
      image.scaleToFit(options.width ?? 600, options.height ?? 600);
    }
    pngBuffer = await image.getBufferAsync("image/png");
  } else {
    pngBuffer = image;
  }

  if (kittySupport === "local" && typeof image === "string") {
    await drawImageFromUrl(pngBuffer);
    return;
  } else if (kittySupport !== "none") {
    await drawImageFromBuffer(pngBuffer);
    return;
  }

  return fallback();
};
