import { Storage } from "../../src";

main();
function main() {
  Storage.createController("channel_a").enable();
  Storage.createController("channel_b").enable();

  figma.showUI(__html__, { width: 600, height: 400, themeColors: false });
}
