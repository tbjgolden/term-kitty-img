#!/usr/bin/env node --no-warnings

import { terminalKittyImage } from "term-kitty-img";
import { Command } from "commander";
import fs from "node:fs";
const program = new Command();

program
  .name("term-kitty-img")
  .description("CLI to print an image in Kitty terminals")
  .argument("<string>", "string to split")
  .option("-s <number>", "simple (width=n, height=n, preserve)")
  .option("--width <number>", "set image width")
  .option("--height <number>", "set image height")
  .option("--stretch", "disable aspect-ratio preservation");

program.parse();

const opts = program.opts();
const out: any = {
  callback: () => {
    console.error("Environment does not support kitty images");
    process.exit(1);
  },
};
if (opts.s !== undefined) {
  if (Number.isNaN(parseInt(opts.s))) {
    throw new Error("size must be a number");
  } else {
    const size = parseInt(opts.s);
    out.width = size;
    out.height = size;
    out.stretch = false;
  }
} else {
  if (opts.width !== undefined) {
    if (Number.isNaN(parseInt(opts.width))) {
      throw new Error("width must be a number");
    } else {
      out.width = parseInt(opts.width);
    }
  }
  if (opts.height !== undefined) {
    if (Number.isNaN(parseInt(opts.height))) {
      throw new Error("height must be a number");
    } else {
      out.height = parseInt(opts.height);
    }
  }
  if (opts.stretch) {
    out.preserveAspectRatio = !opts.stretch;
  }
}
const filePath = program.args[0];
if (!fs.existsSync(filePath)) {
  throw new Error("file does not exist");
}

terminalKittyImage(filePath, out);
