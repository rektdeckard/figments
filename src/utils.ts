export function prid(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(16);
}

export function assertMainThread() {
  if (!figma) {
    throw new Error(
      "FetchContoller cannot be initialized from UI thread. Set this up in your main thread."
    );
  }
}
