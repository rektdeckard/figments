import { Fetch, Storage } from "../../src";

(function main() {
  Fetch.controller.enable();
  Storage.createController("observed").enable();
  Storage.createController("async").enable();

  figma.showUI(__html__, { width: 600, height: 800, themeColors: false });
})();
